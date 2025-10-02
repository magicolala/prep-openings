import { useCallback, useEffect, useMemo, useState } from "react";
import UsernameForm from "./ui/components/UsernameForm";
import OpeningTreeColumn from "./ui/components/OpeningTreeColumn";
import PrepSheetView from "./ui/components/PrepSheetView";
import { ExperienceToolbar } from "./ui/components/ExperienceToolbar";
import { VoiceInterface, type VoiceStatus } from "./ui/components/VoiceInterface";
import { JourneyNavigator, type JourneyChapter } from "./ui/components/JourneyNavigator";
import { AchievementPanel } from "./ui/components/AchievementPanel";
import { useVoiceAssistant } from "./ui/hooks/useVoiceAssistant";
import { ChessComService } from "./services/ChessComService";
import { LichessExplorerService } from "./services/LichessExplorerService";
import { OpeningAnalyzer } from "./usecases/OpeningAnalyzer";
import { useExperiencePreferences } from "./ui/providers/ExperiencePreferences";
import type { OpeningTreeResult, OpeningFenNode, PrepSheet } from "./domain/models";

const CHAPTERS: JourneyChapter[] = [
  {
    id: "context",
    label: "Brief",
    title: "Prï¿½pare l'expï¿½rience",
    summary: "Personnalise l'ambiance, choisis ton thï¿½me, active le mode ï¿½co pour une empreinte lï¿½gï¿½re.",
  },
  {
    id: "scouting",
    label: "Collecte",
    title: "Scanning en temps rï¿½el",
    summary: "Rï¿½cupï¿½ration intelligente des parties rï¿½centes, IA qui filtre les signaux faibles.",
  },
  {
    id: "analysis",
    label: "Analyse",
    title: "Cartographie des ouvertures",
    summary: "Visualisation abstraite : intensitï¿½, halo, moves clï¿½s. Navigation hybride scroll + gestures.",
  },
  {
    id: "prep",
    label: "Plan",
    title: "Prep sheet augmentï¿½",
    summary: "Fuites dï¿½tectï¿½es, rï¿½ponses recommandï¿½es, storytelling interactif pour mï¿½moriser.",
  },
];

const ACCENT_PRESETS = [
  { keywords: ["violet", "pourpre", "indigo"], hue: 248, label: "violet" },
  { keywords: ["corail", "rose", "magenta"], hue: 18, label: "corail" },
  { keywords: ["emeraude", "vert", "jade"], hue: 150, label: "émeraude" },
  { keywords: ["soleil", "or", "gold"], hue: 46, label: "solaire" },
  { keywords: ["ocean", "bleu", "azur"], hue: 205, label: "océan" },
] as const;


export default function App() {
  const chessCom = useMemo(() => new ChessComService(), []);
  const explorer = useMemo(() => new LichessExplorerService(), []);
  const analyzer = useMemo(() => new OpeningAnalyzer(), []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [tree, setTree] = useState<OpeningTreeResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<OpeningFenNode | null>(null);
  const [prepSheet, setPrepSheet] = useState<PrepSheet | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [exploredNodes, setExploredNodes] = useState<Set<string>>(() => new Set());
  const [manualChapter, setManualChapter] = useState<string | null>(null);

  const {
    appearance,
    setAppearance,
    accentHue,
    setAccentHue,
    motion,
    setMotion,
    density,
    setDensity,
    ecoMode,
    toggleEcoMode,
    voiceEnabled,
    toggleVoice,
  } = useExperiencePreferences();

  const [lastRun, setLastRun] = useState<{ you: string; opponent: string } | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  useEffect(() => {
    if (loading) {
      setAssistantMessage("Je rï¿½cupï¿½re vos parties en prioritï¿½ pour un scouting pertinent.");
      return;
    }
    if (prepLoading) {
      setAssistantMessage("Je scrute Lichess Explorer pour trouver des patterns exploitables.");
      return;
    }
    if (tree && !selectedNode) {
      setAssistantMessage("Explore les lignes dï¿½tectï¿½es et clique pour gï¿½nï¿½rer ta prep sheet.");
      return;
    }
    if (prepSheet && prepSheet.leaks.length === 0) {
      setAssistantMessage("Cette ligne semble saine. Continue ï¿½ scroller ou teste une autre entrï¿½e.");
      return;
    }
    setAssistantMessage(null);
  }, [loading, prepLoading, tree, selectedNode, prepSheet]);

  const computedChapter = useMemo(() => {
    if (prepSheet || prepLoading) return "prep";
    if (tree) return "analysis";
    if (loading) return "scouting";
    return "context";
  }, [prepSheet, prepLoading, tree, loading]);

  const [activeChapter, setActiveChapter] = useState<string>(computedChapter);

  useEffect(() => {
    if (!manualChapter) {
      setActiveChapter(computedChapter);
    } else if (manualChapter === computedChapter) {
      setManualChapter(null);
    }
  }, [computedChapter, manualChapter]);
  useEffect(() => {
    if (!manualChapter) return;
    const timer = window.setTimeout(() => setManualChapter(null), 8000);
    return () => window.clearTimeout(timer);
  }, [manualChapter]);

  const leaksDetected = prepSheet?.leaks.length ?? 0;
  const nodesExplored = exploredNodes.size;

  const run = useCallback(async (youRaw: string, opponentRaw: string) => {
    const you = youRaw.trim();
    const opponent = opponentRaw.trim();
    setError(null);
    setPrepError(null);
    setTree(null);
    setSelectedNode(null);
    setPrepSheet(null);
    setDebugLines([]);
    if (!you || !opponent) {
      setError("Renseigne les deux pseudos pour lancer l'analyse.");
      return;
    }
    setLoading(true);
    try {
      const [yourGames, oppGames] = await Promise.all([
        chessCom.getRecentGames(you, 4),
        chessCom.getRecentGames(opponent, 4),
      ]);
      const openingTree = analyzer.buildOpeningTree({
        you: { username: you },
        opponent: { username: opponent },
        yourGames,
        oppGames,
        plyWindow: [8, 12],
        maxPlies: 20,
      });

      const debug: string[] = [];
      debug.push(`[debug] ${you} games rï¿½cupï¿½rï¿½es: ${yourGames.length}`);
      debug.push(`[debug] ${opponent} games rï¿½cupï¿½rï¿½es: ${oppGames.length}`);
      debug.push(
        `[debug] Nï¿½uds adversaire - blancs: ${openingTree.opponent.byColor.white.length}, noirs: ${openingTree.opponent.byColor.black.length}`
      );
      debug.push(
        `[debug] Nï¿½uds perso - blancs: ${openingTree.you.byColor.white.length}, noirs: ${openingTree.you.byColor.black.length}`
      );
      if (openingTree.meta?.cutoffEpochMs) {
        const cutoffIso = new Date(openingTree.meta.cutoffEpochMs).toISOString().split("T")[0];
        debug.push(`[debug] Fenï¿½tre recentielle cible: depuis ${cutoffIso}`);
      }
      if (openingTree.meta?.opponentUsedFallback) {
        debug.push(`[debug] ${opponent} sans volume <4 mois -> fallback historique complet`);
      }
      if (openingTree.meta?.youUsedFallback) {
        debug.push(`[debug] ${you} sans volume <4 mois -> fallback historique complet`);
      }
      if (openingTree.meta?.opponentRelaxedWindow) {
        const scope = openingTree.meta?.opponentCutoffApplied ? "<4 mois" : "historique complet";
        debug.push(`[debug] ${opponent} fenï¿½tre coups ï¿½tendue (4-16, base ${scope})`);
      }
      if (openingTree.meta?.youRelaxedWindow) {
        const scope = openingTree.meta?.youCutoffApplied ? "<4 mois" : "historique complet";
        debug.push(`[debug] ${you} fenï¿½tre coups ï¿½tendue (4-16, base ${scope})`);
      }
      setDebugLines(debug);

      setTree(openingTree);
      setLastRun({ you, opponent });
      setExploredNodes(new Set());
      const opponentNodeCount = openingTree.opponent.byColor.white.length + openingTree.opponent.byColor.black.length;
      if (opponentNodeCount === 0) {
        const baseReason = openingTree.meta?.opponentCutoffApplied
          ? "Pas assez de parties rï¿½centes (4 mois) pour dessiner un arbre"
          : "Aucune partie exploitable mï¿½me en remontant l'historique";
        const adjustments: string[] = [];
        if (openingTree.meta?.opponentRelaxedWindow) adjustments.push("fenï¿½tre coups 4-16");
        if (openingTree.meta?.opponentUsedFallback) adjustments.push("historique complet");
        const detailSuffix = adjustments.length ? ` Ajustements: ${adjustments.join(", ")}.` : "";
        setPrepError(
          `${baseReason}. (opp games: ${oppGames.length}, opp nodes: ${opponentNodeCount}).${detailSuffix}`
        );
      }
    } catch (e: unknown) {
      console.error("[App.run] failed", e);
      setDebugLines((lines) => [...lines, `[debug] run error: ${String(e)}`]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [analyzer, chessCom]);

  const handleSelectNode = useCallback(async (node: OpeningFenNode) => {
    if (!tree) return;
    setPrepError(null);
    setSelectedNode(node);
    setPrepSheet(null);
    setPrepLoading(true);
    setExploredNodes((prev) => {
      const next = new Set(prev);
      next.add(node.id);
      return next;
    });
    try {
      const sheet = await analyzer.createPrepSheet({
        node,
        opponentTree: tree.opponent,
        yourIndex: tree.you.index,
        explorer,
      });
      if (!sheet.leaks.length) {
        setPrepError("Pas de fuite flagrante sur cette ligne, mais continue ta prep !");
      }
      setPrepSheet(sheet);
    } catch (e: unknown) {
      console.error("[App.handleSelectNode] failed", e);
      setDebugLines((lines) => [...lines, `[debug] prep fetch error: ${String(e)}`]);
      setPrepError(e instanceof Error ? e.message : String(e));
    } finally {
      setPrepLoading(false);
    }
  };

  const toggleVoiceListening = () => {
    setVoiceStatus((prev) => {
      if (prev === "listening") {
        setVoiceTranscript("");
        setVoiceResponse(null);
        return "idle";
      }
      setVoiceTranscript("");
      setVoiceResponse(null);
      return "listening";
    });
  };

  const statusCards = (
    <div className="status-stack">
      {loading && (
        <div className="status-card is-loading">
          <span aria-hidden>?</span>
          <div>
            <strong>Collecte Chess.com</strong>
            <p>Je croise vos parties rï¿½centes pour dresser le profil stratï¿½gique.</p>
          </div>
        </div>
      )}
      {error && (
        <div className="status-card is-error" role="alert">
          <span aria-hidden>??</span>
          <div>
            <strong>Oups</strong>
            <p>{error}</p>
          </div>
        </div>
      )}
      {prepLoading && (
        <div className="status-card is-loading">
          <span aria-hidden>??</span>
          <div>
            <strong>Explorer Lichess</strong>
            <p>Je rï¿½cupï¿½re la thï¿½orie rï¿½cente et des modï¿½les pour ta ligne.</p>
          </div>
        </div>
      )}
      {prepError && !prepLoading && (
        <div className="status-card is-warning" role="alert">
          <span aria-hidden>??</span>
          <div>
            <strong>Signal</strong>
            <p>{prepError}</p>
          </div>
        </div>
      )}
      {!loading && !error && !tree && (
        <div className="status-card is-info">
          <span aria-hidden>??</span>
          <div>
            <strong>Entre deux pseudos</strong>
            <p>On reconstruit la cartographie d'ouvertures rï¿½cemment jouï¿½es.</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="experience-shell" data-state={activeChapter}>
      <header className="experience-header">
        <div className="experience-header__top">
          <div className="experience-brand">
            <span className="experience-brand__pulse" aria-hidden />
            <div>
              <p className="micro-tag">Prep openings 2025</p>
              <h1>Expï¿½rience augmentï¿½e d'analyse d'ouvertures</h1>
            </div>
          </div>
          <ExperienceToolbar
            onToggleVoice={toggleVoiceListening}
            voiceListening={voiceStatus === "listening"}
            voiceSupported={voiceSupported}
          />
        </div>
        <JourneyNavigator
          chapters={CHAPTERS}
          activeId={activeChapter}
          onSelect={(id) => {
            setManualChapter(id);
            setActiveChapter(id);
          }}
        />
      </header>

      <main className="experience-body">
        <section className="experience-story" aria-live="polite">
          {(() => {
            switch (activeChapter) {
              case "scouting":
                return (
                  <article className="story-card">
                    <h2>Scouting automatique</h2>
                    <p>
                      L'IA nettoie les donnï¿½es Chess.com, dï¿½tecte les sï¿½ries rï¿½centes et prï¿½pare une cartographie ï¿½co-conï¿½ue pour toi.
                    </p>
                    <ul>
                      <li>Filtre temporel dynamique (4 mois par dï¿½faut)</li>
                      <li>Fallback historique si volume insuffisant</li>
                      <li>Respect des droits humains : data publique uniquement</li>
                    </ul>
                  </article>
                );
              case "analysis":
                return (
                  <article className="story-card">
                    <h2>Navigation innovante</h2>
                    <p>
                      Scroll vertical pour les chapitres, horizontal pour zoomer dans une ligne. Les halos colorï¿½s rï¿½vï¿½lent la dangerositï¿½.
                    </p>
                    <ul>
                      <li>Micro-interactions tactiles et clavier</li>
                      <li>Visualisation abstraite plutï¿½t que tableaux</li>
                      <li>Personnalisation : densitï¿½ adaptative, motion maï¿½trisï¿½e</li>
                    </ul>
                  </article>
                );
              case "prep":
                return (
                  <article className="story-card">
                    <h2>Storytelling interactif</h2>
                    <p>
                      Chaque fuite devient un mini-scenario : score adverse, recommandations, parties de rï¿½fï¿½rence. Laisse-toi guider.
                    </p>
                    <ul>
                      <li>Badges dï¿½bloquï¿½s en temps rï¿½el</li>
                      <li>Mode sombre optimisï¿½ pour sessions nocturnes</li>
                      <li>Mode vocal accessible pour naviguer mains libres</li>
                    </ul>
                  </article>
                );
              default:
                return (
                  <article className="story-card">
                    <h2>Expï¿½rience augmentï¿½e</h2>
                    <p>
                      Personnalise ton interface, choisis ton ambiance, active l'assistant vocal. On raconte ton histoire d'ï¿½checs de maniï¿½re immersive.
                    </p>
                    <ul>
                      <li>Accessibilitï¿½ renforcï¿½e (WCAG 2.2 AA+)</li>
                      <li>Durabilitï¿½ numï¿½rique : mode ï¿½co, assets lï¿½gers</li>
                      <li>Emotion design : palettes adaptatives, micro feedbacks</li>
                    </ul>
                  </article>
                );
            }
          })()}
        </section>

        <section className="experience-workspace">
          <UsernameForm onRun={run} assistantMessage={assistantMessage} />
          {statusCards}

          {tree && (
            <div className="line-board" aria-live="polite">
              <OpeningTreeColumn
                color="white"
                nodes={tree.opponent.byColor.white}
                activeNodeId={selectedNode?.id ?? null}
                onSelect={handleSelectNode}
              />
              <OpeningTreeColumn
                color="black"
                nodes={tree.opponent.byColor.black}
                activeNodeId={selectedNode?.id ?? null}
                onSelect={handleSelectNode}
              />
            </div>
          )}

          {prepSheet && selectedNode && <PrepSheetView sheet={prepSheet} node={selectedNode} />}
        </section>

        <aside className="experience-aside">
          <VoiceInterface
            status={voiceStatus}
            transcript={voiceTranscript}
            assistantMessage={voiceResponse}
            suggestions={[
              "Rï¿½cupï¿½re mes parties rapides",
              "Analyse l'adversaire",
              "Active le mode sombre",
            ]}
            onSuggestion={(command) => setVoiceTranscript(command)}
            error={voiceStatus === "error" ? voiceResponse : null}
          />

          <AchievementPanel
            leaksFound={leaksDetected}
            nodesExplored={nodesExplored}
            ecoMode={ecoMode}
            voiceEnabled={voiceEnabled}
          />

          {debugLines.length > 0 && (
            <details className="debug-block">
              <summary>Debug</summary>
              <pre>{debugLines.join("\n")}</pre>
            </details>
          )}
        </aside>
      </main>

      <footer className="experience-footer">
        <div>
          <strong>Respect & durabilitï¿½</strong>
          <p>
            Empreinte carbone suivie, dark mode optimisï¿½, ressources compressï¿½es. Tu gardes le contrï¿½le sur tes donnï¿½es.
          </p>
        </div>
        <div>
          <strong>Accessibilitï¿½</strong>
          <p>Contrastes ï¿½levï¿½s, zones cliquables ï¿½largies, navigation vocale, alt text systï¿½matique.</p>
        </div>
        <div>
          <strong>Gamification responsable</strong>
          <p>Badges liï¿½s ï¿½ la progression stratï¿½gique, feedback instantanï¿½, classement optionnel.</p>
        </div>
      </footer>
    </div>
  );
}









