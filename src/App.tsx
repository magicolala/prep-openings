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
    title: "Pr�pare l'exp�rience",
    summary: "Personnalise l'ambiance, choisis ton th�me, active le mode �co pour une empreinte l�g�re.",
  },
  {
    id: "scouting",
    label: "Collecte",
    title: "Scanning en temps r�el",
    summary: "R�cup�ration intelligente des parties r�centes, IA qui filtre les signaux faibles.",
  },
  {
    id: "analysis",
    label: "Analyse",
    title: "Cartographie des ouvertures",
    summary: "Visualisation abstraite : intensit�, halo, moves cl�s. Navigation hybride scroll + gestures.",
  },
  {
    id: "prep",
    label: "Plan",
    title: "Prep sheet augment�",
    summary: "Fuites d�tect�es, r�ponses recommand�es, storytelling interactif pour m�moriser.",
  },
];

const ACCENT_PRESETS = [
  { keywords: ["violet", "pourpre", "indigo"], hue: 248, label: "violet" },
  { keywords: ["corail", "rose", "magenta"], hue: 18, label: "corail" },
  { keywords: ["emeraude", "vert", "jade"], hue: 150, label: "�meraude" },
  { keywords: ["soleil", "or", "gold"], hue: 46, label: "solaire" },
  { keywords: ["ocean", "bleu", "azur"], hue: 205, label: "oc�an" },
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
      setAssistantMessage("Je r�cup�re vos parties en priorit� pour un scouting pertinent.");
      return;
    }
    if (prepLoading) {
      setAssistantMessage("Je scrute Lichess Explorer pour trouver des patterns exploitables.");
      return;
    }
    if (tree && !selectedNode) {
      setAssistantMessage("Explore les lignes d�tect�es et clique pour g�n�rer ta prep sheet.");
      return;
    }
    if (prepSheet && prepSheet.leaks.length === 0) {
      setAssistantMessage("Cette ligne semble saine. Continue � scroller ou teste une autre entr�e.");
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
      debug.push(`[debug] ${you} games r�cup�r�es: ${yourGames.length}`);
      debug.push(`[debug] ${opponent} games r�cup�r�es: ${oppGames.length}`);
      debug.push(
        `[debug] N�uds adversaire - blancs: ${openingTree.opponent.byColor.white.length}, noirs: ${openingTree.opponent.byColor.black.length}`
      );
      debug.push(
        `[debug] N�uds perso - blancs: ${openingTree.you.byColor.white.length}, noirs: ${openingTree.you.byColor.black.length}`
      );
      if (openingTree.meta?.cutoffEpochMs) {
        const cutoffIso = new Date(openingTree.meta.cutoffEpochMs).toISOString().split("T")[0];
        debug.push(`[debug] Fen�tre recentielle cible: depuis ${cutoffIso}`);
      }
      if (openingTree.meta?.opponentUsedFallback) {
        debug.push(`[debug] ${opponent} sans volume <4 mois -> fallback historique complet`);
      }
      if (openingTree.meta?.youUsedFallback) {
        debug.push(`[debug] ${you} sans volume <4 mois -> fallback historique complet`);
      }
      if (openingTree.meta?.opponentRelaxedWindow) {
        const scope = openingTree.meta?.opponentCutoffApplied ? "<4 mois" : "historique complet";
        debug.push(`[debug] ${opponent} fen�tre coups �tendue (4-16, base ${scope})`);
      }
      if (openingTree.meta?.youRelaxedWindow) {
        const scope = openingTree.meta?.youCutoffApplied ? "<4 mois" : "historique complet";
        debug.push(`[debug] ${you} fen�tre coups �tendue (4-16, base ${scope})`);
      }
      setDebugLines(debug);

      setTree(openingTree);
      setLastRun({ you, opponent });
      setExploredNodes(new Set());
      const opponentNodeCount = openingTree.opponent.byColor.white.length + openingTree.opponent.byColor.black.length;
      if (opponentNodeCount === 0) {
        const baseReason = openingTree.meta?.opponentCutoffApplied
          ? "Pas assez de parties r�centes (4 mois) pour dessiner un arbre"
          : "Aucune partie exploitable m�me en remontant l'historique";
        const adjustments: string[] = [];
        if (openingTree.meta?.opponentRelaxedWindow) adjustments.push("fen�tre coups 4-16");
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
            <p>Je croise vos parties r�centes pour dresser le profil strat�gique.</p>
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
            <p>Je r�cup�re la th�orie r�cente et des mod�les pour ta ligne.</p>
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
            <p>On reconstruit la cartographie d'ouvertures r�cemment jou�es.</p>
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
              <h1>Exp�rience augment�e d'analyse d'ouvertures</h1>
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
                      L'IA nettoie les donn�es Chess.com, d�tecte les s�ries r�centes et pr�pare une cartographie �co-con�ue pour toi.
                    </p>
                    <ul>
                      <li>Filtre temporel dynamique (4 mois par d�faut)</li>
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
                      Scroll vertical pour les chapitres, horizontal pour zoomer dans une ligne. Les halos color�s r�v�lent la dangerosit�.
                    </p>
                    <ul>
                      <li>Micro-interactions tactiles et clavier</li>
                      <li>Visualisation abstraite plut�t que tableaux</li>
                      <li>Personnalisation : densit� adaptative, motion ma�tris�e</li>
                    </ul>
                  </article>
                );
              case "prep":
                return (
                  <article className="story-card">
                    <h2>Storytelling interactif</h2>
                    <p>
                      Chaque fuite devient un mini-scenario : score adverse, recommandations, parties de r�f�rence. Laisse-toi guider.
                    </p>
                    <ul>
                      <li>Badges d�bloqu�s en temps r�el</li>
                      <li>Mode sombre optimis� pour sessions nocturnes</li>
                      <li>Mode vocal accessible pour naviguer mains libres</li>
                    </ul>
                  </article>
                );
              default:
                return (
                  <article className="story-card">
                    <h2>Exp�rience augment�e</h2>
                    <p>
                      Personnalise ton interface, choisis ton ambiance, active l'assistant vocal. On raconte ton histoire d'�checs de mani�re immersive.
                    </p>
                    <ul>
                      <li>Accessibilit� renforc�e (WCAG 2.2 AA+)</li>
                      <li>Durabilit� num�rique : mode �co, assets l�gers</li>
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
              "R�cup�re mes parties rapides",
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
          <strong>Respect & durabilit�</strong>
          <p>
            Empreinte carbone suivie, dark mode optimis�, ressources compress�es. Tu gardes le contr�le sur tes donn�es.
          </p>
        </div>
        <div>
          <strong>Accessibilit�</strong>
          <p>Contrastes �lev�s, zones cliquables �largies, navigation vocale, alt text syst�matique.</p>
        </div>
        <div>
          <strong>Gamification responsable</strong>
          <p>Badges li�s � la progression strat�gique, feedback instantan�, classement optionnel.</p>
        </div>
      </footer>
    </div>
  );
}









