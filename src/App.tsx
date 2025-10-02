import { useCallback, useEffect, useMemo, useState } from "react";
import UsernameForm from "./ui/components/UsernameForm";
import OpeningTreeColumn from "./ui/components/OpeningTreeColumn";
import PrepSheetView from "./ui/components/PrepSheetView";
import { ExperienceToolbar } from "./ui/components/ExperienceToolbar";
import { VoiceInterface } from "./ui/components/VoiceInterface";
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
    title: "Prépare l'expérience",
    summary: "Personnalise l'ambiance, choisis ton thème, active le mode éco pour une empreinte légère.",
    icon: "🎯",
  },
  {
    id: "scouting",
    label: "Collecte",
    title: "Scan en temps réel",
    summary: "Récupération intelligente des parties récentes, l'IA filtre les signaux faibles.",
    icon: "🔍",
  },
  {
    id: "analysis",
    label: "Analyse",
    title: "Cartographie des ouvertures",
    summary: "Visualisation abstraite, halos de danger, navigation hybride scroll et gestes.",
    icon: "♞",
  },
  {
    id: "prep",
    label: "Plan",
    title: "Prep sheet augmentée",
    summary: "Fuites détectées, réponses recommandées, storytelling interactif pour mémoriser.",
    icon: "🧠",
  },
];

const ACCENT_PRESETS = [
  { keywords: ["violet", "pourpre", "indigo"], hue: 248, label: "violet" },
  { keywords: ["corail", "rose", "magenta"], hue: 18, label: "corail" },
  { keywords: ["emeraude", "vert", "jade"], hue: 150, label: "émeraude" },
  { keywords: ["soleil", "or", "gold"], hue: 46, label: "solaire" },
  { keywords: ["ocean", "bleu", "azur"], hue: 205, label: "océan" },
] as const;

const DEFAULT_SUGGESTIONS = ["mode sombre", "chapitre analyse", "relance analyse"];

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
  const [lastRun, setLastRun] = useState<{ you: string; opponent: string } | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

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

  const run = useCallback(
    async (youRaw: string, opponentRaw: string) => {
      const you = youRaw.trim();
      const opponent = opponentRaw.trim();
      setError(null);
      setPrepError(null);
      setTree(null);
      setSelectedNode(null);
      setPrepSheet(null);
      setDebugLines([]);
      setAssistantMessage(null);
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
        debug.push(`[debug] ${you} jeux recuperes: ${yourGames.length}`);
        debug.push(`[debug] ${opponent} jeux recuperes: ${oppGames.length}`);
        debug.push(
          `[debug] noeuds adversaire blancs: ${openingTree.opponent.byColor.white.length}, noirs: ${openingTree.opponent.byColor.black.length}`
        );
        debug.push(
          `[debug] noeuds perso blancs: ${openingTree.you.byColor.white.length}, noirs: ${openingTree.you.byColor.black.length}`
        );
        if (openingTree.meta?.cutoffEpochMs) {
          const cutoffIso = new Date(openingTree.meta.cutoffEpochMs).toISOString().split("T")[0];
          debug.push(`[debug] fenetre recence: depuis ${cutoffIso}`);
        }
        if (openingTree.meta?.opponentUsedFallback) {
          debug.push(`[debug] ${opponent} sans volume recent -> fallback historique complet`);
        }
        if (openingTree.meta?.youUsedFallback) {
          debug.push(`[debug] ${you} sans volume recent -> fallback historique complet`);
        }
        if (openingTree.meta?.opponentRelaxedWindow) {
          const scope = openingTree.meta?.opponentCutoffApplied ? "<4 mois" : "historique complet";
          debug.push(`[debug] ${opponent} fenetre coups etendue (4-16 base ${scope})`);
        }
        if (openingTree.meta?.youRelaxedWindow) {
          const scope = openingTree.meta?.youCutoffApplied ? "<4 mois" : "historique complet";
          debug.push(`[debug] ${you} fenetre coups etendue (4-16 base ${scope})`);
        }
        setDebugLines(debug);

        setTree(openingTree);
        setLastRun({ you, opponent });
        setExploredNodes(new Set());
        setDebugOpen(false);
        const opponentNodeCount = openingTree.opponent.byColor.white.length + openingTree.opponent.byColor.black.length;
        if (opponentNodeCount === 0) {
          const baseReason = openingTree.meta?.opponentCutoffApplied
            ? "Pas assez de parties récentes pour dessiner un arbre"
            : "Aucune partie exploitable même en remontant l'historique";
          const adjustments: string[] = [];
          if (openingTree.meta?.opponentRelaxedWindow) adjustments.push("fenêtre coups 4-16");
          if (openingTree.meta?.opponentUsedFallback) adjustments.push("historique complet");
          const detailSuffix = adjustments.length ? ` Ajustements: ${adjustments.join(", ")}.` : "";
          setPrepError(`${baseReason}. (opp games: ${oppGames.length}, opp nodes: ${opponentNodeCount}).${detailSuffix}`);
        }
      } catch (e: unknown) {
        console.error("[App.run] failed", e);
        setDebugLines((lines) => [...lines, `[debug] run error: ${String(e)}`]);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [analyzer, chessCom]
  );

  const handleSelectNode = useCallback(
    async (node: OpeningFenNode) => {
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
          setPrepError("Pas de fuite flagrante sur cette ligne, continue ta préparation.");
        }
        setPrepSheet(sheet);
      } catch (e: unknown) {
        console.error("[App.handleSelectNode] failed", e);
        setDebugLines((lines) => [...lines, `[debug] prep fetch error: ${String(e)}`]);
        setPrepError(e instanceof Error ? e.message : String(e));
      } finally {
        setPrepLoading(false);
      }
    },
    [analyzer, explorer, tree]
  );

  const handleVoiceCommand = useCallback(
    async (utterance: string) => {
      const normalized = utterance.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const sanitized = normalized.replace(/[^a-z0-9 ]/g, " ");
      const includes = (segment: string) => sanitized.includes(segment);
      const includesAny = (...segments: string[]) => segments.some((segment) => includes(segment));
      const respond = (message: string) => {
        setAssistantMessage(message);
        return message;
      };

      if (!sanitized.trim()) {
        return respond("Commande vide. Essaie « mode sombre » ou « chapitre analyse ».");
      }

      if (includesAny("mode sombre", "mode nuit", "dark")) {
        if (appearance !== "dark") setAppearance("dark");
        return respond("Thème nuit activé.");
      }

      if (includesAny("mode clair", "mode jour", "light")) {
        if (appearance !== "light") setAppearance("light");
        return respond("Thème jour activé.");
      }

      if (includesAny("mode auto", "automatique")) {
        if (appearance !== "auto") setAppearance("auto");
        return respond("Thème auto synchronisé.");
      }

      if (includes("mode eco")) {
        const wantsDisable = includes("desactive") || includes("retire") || includes("coupe");
        if (wantsDisable) {
          if (ecoMode) toggleEcoMode();
          return respond("Mode éco désactivé.");
        }
        if (!ecoMode) toggleEcoMode();
        return respond("Mode éco activé.");
      }

      if (includesAny("motion douce", "animation douce", "calme", "slow")) {
        if (motion !== "calm") setMotion("calm");
        return respond("Animations adoucies.");
      }

      if (includesAny("motion vive", "animation rapide", "dynamique")) {
        if (motion !== "dynamic") setMotion("dynamic");
        return respond("Animations dynamiques activées.");
      }

      if (includesAny("layout compact", "densite compacte", "compact", "dense")) {
        if (density !== "compact") setDensity("compact");
        return respond("Disposition compacte activée.");
      }

      if (includesAny("layout ample", "densite confortable", "confortable", "large")) {
        if (density !== "comfortable") setDensity("comfortable");
        return respond("Disposition ample activée.");
      }

      if (includesAny("couleur", "accent")) {
        for (const preset of ACCENT_PRESETS) {
          if (preset.keywords.some((keyword) => includes(keyword))) {
            if (accentHue !== preset.hue) setAccentHue(preset.hue);
            return respond(`Accent ${preset.label} activé.`);
          }
        }
        return respond("Dis une couleur : violet, corail, émeraude, solaire ou océan.");
      }

      if (includes("chapitre") || includes("section")) {
        if (includesAny("brief", "contexte")) {
          setManualChapter("context");
          return respond("Chapitre brief affiché.");
        }
        if (includesAny("collecte", "scout")) {
          setManualChapter("scouting");
          return respond("Chapitre collecte activé.");
        }
        if (includes("analyse")) {
          setManualChapter("analysis");
          return respond("Chapitre analyse activé.");
        }
        if (includesAny("plan", "prep", "preparation")) {
          setManualChapter("prep");
          return respond("Chapitre plan ouvert.");
        }
        return respond("Chapitre non reconnu. Essaie plan, analyse ou collecte.");
      }

      if (includesAny("relance", "relancer", "relance analyse", "rejoue")) {
        if (lastRun) {
          await run(lastRun.you, lastRun.opponent);
          return respond(`Je relance l'analyse pour ${lastRun.you} contre ${lastRun.opponent}.`);
        }
        return respond("Aucune analyse mémorisée.");
      }

      if (includes("debug")) {
        const wantsClose = includes("ferme") || includes("masque") || includes("cache");
        if (wantsClose) {
          setDebugOpen(false);
          return respond("Console debug masquée.");
        }
        setDebugOpen(true);
        return respond("Console debug affichée.");
      }

      if (includes("assistant vocal") && includesAny("desactive", "coupe", "stop")) {
        if (voiceEnabled) toggleVoice();
        return respond("Assistant vocal désactivé.");
      }

      if (includes("assistant vocal") && includesAny("active", "demarre", "lance")) {
        if (!voiceEnabled) toggleVoice();
        return respond("Assistant vocal activé.");
      }

      if (includes("stop")) {
        return respond("Micro coupé. Appuie sur le bouton pour reprendre.");
      }

      return respond("Commande non reconnue. Essaie « mode sombre » ou « chapitre analyse ».");
    },
    [accentHue, appearance, density, ecoMode, lastRun, motion, run, setAccentHue, setAppearance, setDensity, setMotion, toggleEcoMode, toggleVoice, voiceEnabled]
  );

  const {
    supported: voiceSupported,
    status: voiceStatus,
    transcript: voiceTranscript,
    response: voiceResponse,
    start: startVoice,
    stop: stopVoice,
    reset: resetVoice,
    process: processVoice,
  } = useVoiceAssistant({
    enabled: voiceEnabled,
    onCommand: handleVoiceCommand,
    onError: (message) => setAssistantMessage((prev) => prev ?? message),
  });

  useEffect(() => {
    if (!voiceEnabled) {
      stopVoice();
    }
  }, [voiceEnabled, stopVoice]);

  useEffect(() => {
    if (loading) {
      setAssistantMessage("Je collecte tes parties, respire.");
      return;
    }
    if (prepLoading) {
      setAssistantMessage("Je cherche des modèles Lichess pertinents.");
      return;
    }
    if (tree && !selectedNode) {
      setAssistantMessage("Choisis une ligne pour créer ta prep sheet.");
      return;
    }
    if (prepSheet && prepSheet.leaks.length === 0) {
      setAssistantMessage("Cette ligne semble solide, explore d'autres pistes.");
      return;
    }
    if (voiceStatus === "listening") {
      setAssistantMessage("Je t'écoute, demande un mode ou un chapitre.");
      return;
    }
    if (voiceStatus === "processing") {
      setAssistantMessage("Je traite ta commande vocale.");
      return;
    }
    setAssistantMessage(null);
  }, [loading, prepLoading, tree, selectedNode, prepSheet, voiceStatus]);

  const computedChapter = useMemo(() => {
    if (prepSheet || prepLoading) return "prep";
    if (tree) return "analysis";
    if (loading) return "scouting";
    return "context";
  }, [prepSheet, prepLoading, tree, loading]);

  const [activeChapter, setActiveChapter] = useState<string>(computedChapter);

  const handleChapterSelect = useCallback(
    (id: string) => {
      setManualChapter(id);
      setActiveChapter(id);
    },
    [setManualChapter, setActiveChapter]
  );

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

  const voiceSuggestions = useMemo(() => {
    const base = [...DEFAULT_SUGGESTIONS];
    if (!voiceEnabled) base[0] = "active assistant vocal";
    if (voiceEnabled && voiceStatus === "listening") base[0] = "stop";
    if (!lastRun) base[2] = "mode clair";
    return base;
  }, [lastRun, voiceEnabled, voiceStatus]);

  const breadcrumbItems = useMemo(
    () => [
      { id: "overview", label: "Panorama", icon: "🧭", active: !selectedNode },
      { id: "white", label: "Blancs", icon: "⚪", active: selectedNode?.color === "white" },
      { id: "black", label: "Noirs", icon: "⚫", active: selectedNode?.color === "black" },
    ],
    [selectedNode]
  );

  const toggleVoiceListening = useCallback(() => {
    if (!voiceSupported || !voiceEnabled) return;
    if (voiceStatus === "listening") {
      stopVoice();
    } else {
      resetVoice();
      startVoice();
    }
  }, [voiceEnabled, voiceStatus, voiceSupported, resetVoice, startVoice, stopVoice]);

  const statusCards = (
    <div className="status-stack">
      {loading && (
        <div className="status-card is-loading">
          <span aria-hidden>...</span>
          <div>
            <strong>Collecte Chess.com</strong>
            <p>Je croise tes parties récentes pour dresser le profil.</p>
          </div>
        </div>
      )}
      {error && (
        <div className="status-card is-error" role="alert">
          <span aria-hidden>!!</span>
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
            <p>Je récupère la théorie récente et des modèles.</p>
          </div>
        </div>
      )}
      {prepError && !prepLoading && (
        <div className="status-card is-warning" role="alert">
          <span aria-hidden>**</span>
          <div>
            <strong>Signal</strong>
            <p>{prepError}</p>
          </div>
        </div>
      )}
      {!loading && !error && !tree && (
        <div className="status-card is-info">
          <span aria-hidden>^^</span>
          <div>
            <strong>Entre deux pseudos</strong>
            <p>On reconstruira la cartographie d'ouvertures récente.</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="experience-shell"
      data-state={activeChapter}
      data-header={headerCollapsed ? "collapsed" : "expanded"}
    >
      <div className="experience-shell__inner container">
        {headerCollapsed ? (
          <button
            type="button"
            className="experience-header__restore"
            onClick={() => setHeaderCollapsed(false)}
            aria-expanded="false"
            aria-controls="experience-header"
          >
            <span aria-hidden>⌃</span>
            <span>Afficher l'introduction</span>
          </button>
        ) : (
          <header className="experience-header" id="experience-header">
            <div className="experience-header__top">
              <div className="experience-brand">
                <span className="experience-brand__pulse" aria-hidden />
                <div className="experience-brand__copy">
                  <p className="micro-tag">Prépa openings 2025</p>
                  <h1>Expérience augmentée d'analyse d'ouvertures</h1>
                </div>
              </div>
              <div className="experience-header__controls">
                <ExperienceToolbar
                  onToggleVoice={toggleVoiceListening}
                  voiceListening={voiceStatus === "listening"}
                  voiceSupported={voiceSupported}
                />
                <button
                  type="button"
                  className="experience-header__toggle"
                  onClick={() => setHeaderCollapsed(true)}
                  aria-expanded="true"
                  aria-controls="experience-header"
                >
                  <span aria-hidden>×</span>
                  <span>Masquer l'introduction</span>
                </button>
              </div>
            </div>
            <JourneyNavigator
              chapters={CHAPTERS}
              activeId={activeChapter}
              onSelect={handleChapterSelect}
            />
          </header>
        )}

        <main className="experience-body grid-12">
          <section className="experience-story" aria-live="polite">
            {(() => {
              switch (activeChapter) {
                case "scouting":
                  return (
                    <article className="story-card">
                      <h2>Scouting automatique</h2>
                      <p>L'IA filtre tes parties récentes, détecte les signaux faibles et respecte la sobriété numérique.</p>
                      <ul>
                        <li>Fenêtre temporelle dynamique</li>
                        <li>Historique de secours contrôlé</li>
                        <li>Données publiques uniquement</li>
                      </ul>
                    </article>
                  );
                case "analysis":
                  return (
                    <article className="story-card">
                      <h2>Navigation innovante</h2>
                      <p>Scroll vertical pour les chapitres, horizontal pour zoomer dans la ligne. Halos et micro-animations.</p>
                      <ul>
                        <li>Micro-interactions clavier et tactile</li>
                        <li>Visualisation abstraite au lieu de tableaux</li>
                        <li>Personnalise animations et densité</li>
                      </ul>
                    </article>
                  );
                case "prep":
                  return (
                    <article className="story-card">
                      <h2>Storytelling interactif</h2>
                      <p>Chaque fuite devient un scénario : score adverse, ripostes, parties modèles et badges engagés.</p>
                      <ul>
                        <li>Badges gamifiés en temps réel</li>
                        <li>Mode sombre optimisé</li>
                        <li>Assistant vocal accessible</li>
                      </ul>
                    </article>
                  );
                default:
                  return (
                    <article className="story-card">
                      <h2>Expérience personnalisée</h2>
                      <p>Choisis ton ambiance, active l'assistant, allège la charge visuelle et garde le contrôle de tes données.</p>
                      <ul>
                        <li>Accessibilité WCAG 2.2</li>
                        <li>Mode éco et assets légers</li>
                        <li>Palette émotionnelle modulable</li>
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
              <>
                <nav className="experience-breadcrumb" aria-label="Fil d'Ariane de l'analyse">
                  <ol>
                    {breadcrumbItems.map((item) => (
                      <li
                        key={item.id}
                        className={item.active ? "is-active" : ""}
                        aria-current={item.active ? "step" : undefined}
                      >
                        <span aria-hidden>{item.icon}</span>
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ol>
                </nav>

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
              </>
            )}

            {prepSheet && selectedNode && <PrepSheetView sheet={prepSheet} node={selectedNode} />}
          </section>

          <aside className="experience-aside">
            <nav className="side-menu" aria-label="Navigation secondaire">
              <p className="side-menu__title">Chapitres</p>
              <ul className="side-menu__list">
                {CHAPTERS.map((chapter) => {
                  const isActive = chapter.id === activeChapter;
                  return (
                    <li key={chapter.id}>
                      <button
                        type="button"
                        className={`side-menu__item${isActive ? " is-active" : ""}`}
                        onClick={() => handleChapterSelect(chapter.id)}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {chapter.icon && (
                          <span className="side-menu__icon" aria-hidden>
                            {chapter.icon}
                          </span>
                        )}
                        <span>{chapter.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <VoiceInterface
              status={voiceStatus}
              transcript={voiceTranscript}
              assistantMessage={voiceResponse}
              suggestions={voiceSuggestions}
              onSuggestion={(command) => {
                void processVoice(command);
              }}
              error={voiceStatus === "error" ? voiceResponse : null}
            />

            <AchievementPanel
              leaksFound={leaksDetected}
              nodesExplored={nodesExplored}
              ecoMode={ecoMode}
              voiceEnabled={voiceEnabled}
            />

            {debugLines.length > 0 && (
              <details className="debug-block" open={debugOpen} onToggle={(event) => setDebugOpen((event.target as HTMLDetailsElement).open)}>
                <summary>Debug</summary>
                <pre>{debugLines.join("\n")}</pre>
              </details>
            )}
          </aside>
        </main>

        <footer className="experience-footer">
          <div>
            <strong>Respect et durabilité</strong>
            <p>Empreinte suivie, dark mode optimisé, ressources compressées. Tu gardes la main sur tes données.</p>
          </div>
          <div>
            <strong>Accessibilité</strong>
            <p>Contrastes élevés, zones cliquables généreuses, navigation vocale et textes alternatifs.</p>
          </div>
          <div>
            <strong>Gamification responsable</strong>
            <p>Badges reliés à la progression, feedback instantané, classement optionnel.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
