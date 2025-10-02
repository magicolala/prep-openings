import { useMemo, useState } from "react";
import UsernameForm from "./ui/components/UsernameForm";
import OpeningTreeColumn from "./ui/components/OpeningTreeColumn";
import PrepSheetView from "./ui/components/PrepSheetView";
import { ChessComService } from "./services/ChessComService";
import { LichessExplorerService } from "./services/LichessExplorerService";
import { OpeningAnalyzer } from "./usecases/OpeningAnalyzer";
import type { OpeningTreeResult, OpeningFenNode, PrepSheet } from "./domain/models";

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

  const run = async (youRaw: string, opponentRaw: string) => {
    const you = youRaw.trim();
    const opponent = opponentRaw.trim();
    console.debug('[App.run] start', { you, opponent });
    setError(null);
    setPrepError(null);
    setTree(null);
    setSelectedNode(null);
    setPrepSheet(null);
    if (!you || !opponent) {
      setError("Renseigne les deux pseudos, t'abuses.");
      return;
    }
    setLoading(true);
    try {
      const [yourGames, oppGames] = await Promise.all([
        chessCom.getRecentGames(you, 6),
        chessCom.getRecentGames(opponent, 6),
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
      debug.push(`[debug] ${you} games recuperees: ${yourGames.length}`);
      debug.push(`[debug] ${opponent} games recuperees: ${oppGames.length}`);
      debug.push(
        `[debug] Noeuds adversaire - blancs: ${openingTree.opponent.byColor.white.length}, noirs: ${openingTree.opponent.byColor.black.length}`
      );
      debug.push(
        `[debug] Noeuds perso - blancs: ${openingTree.you.byColor.white.length}, noirs: ${openingTree.you.byColor.black.length}`
      );
      setDebugLines(debug);

      setTree(openingTree);
      if (
        !openingTree.opponent.byColor.white.length &&
        !openingTree.opponent.byColor.black.length
      ) {
        setPrepError(`Pas assez de parties pour dessiner un arbre d'ouvertures. (opp games: ${oppGames.length}, opp nodes: ${openingTree.opponent.byColor.white.length + openingTree.opponent.byColor.black.length})`);
        console.debug('[App.run] tree empty', { oppGames: oppGames.length, oppNodes: openingTree.opponent.byColor.white.length + openingTree.opponent.byColor.black.length });
      }
    } catch (e: any) {
      console.error('[App.run] failed', e);
      setDebugLines(lines => [...lines, `[debug] run error: ${String(e)}`]);
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectNode = async (node: OpeningFenNode) => {
    if (!tree) return;
    console.debug('[App.handleSelectNode] selected', { id: node.id, freq: node.frequency, color: node.color });
    setPrepError(null);
    setSelectedNode(node);
    setPrepSheet(null);
    setPrepLoading(true);
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
    } catch (e: any) {
      console.error('[App.handleSelectNode] failed', e);
      setDebugLines(lines => [...lines, `[debug] prep fetch error: ${String(e)}`]);
      setPrepError(e?.message ?? String(e));
    } finally {
      setPrepLoading(false);
    }
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column">
      <header className="border-bottom bg-white sticky-top shadow-sm">
        <div className="container py-3">
          <h1 className="h3 mb-1">Prep d'ouvertures cibree</h1>
          <p className="text-muted small mb-0">
            Chess.com pour le scouting - Lichess Explorer quand tu appuies sur une ligne
          </p>
        </div>
      </header>
      <main className="container flex-grow-1 py-4">
        <div className="row justify-content-center">
          <div className="col-lg-10 col-xl-9">
            <UsernameForm onRun={run} />
            {loading && (
              <div className="alert alert-info d-flex align-items-center gap-2 mt-3 mb-0" role="status">
                <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                <span>Je bosse, detends-toi...</span>
              </div>
            )}
            {error && (
              <div className="alert alert-danger mt-3 mb-0" role="alert">
                {error}
              </div>
            )}
            {tree && (
              <section className="mt-3">
                <div className="row g-3">
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
              </section>
            )}
            {prepLoading && (
              <div className="alert alert-info d-flex align-items-center gap-2 mt-3 mb-0" role="status">
                <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                <span>Je vais chercher la theorie Lichess...</span>
              </div>
            )}
            {prepError && !prepLoading && (
              <div className="alert alert-warning mt-3 mb-0" role="alert">
                {prepError}
              </div>
            )}
            {prepSheet && selectedNode && (
              <PrepSheetView sheet={prepSheet} node={selectedNode} />
            )}
            {debugLines.length > 0 && (
              <details className="mt-3">
                <summary className="text-muted small">Debug</summary>
                <pre className="bg-body-tertiary rounded px-3 py-2 small">{debugLines.join('\n')}</pre>
              </details>
            )}
            {!loading && !error && !tree && (
              <div className="text-muted small mt-3">
                Entre les pseudos et on reconstruit son fichier d'ouvertures.
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="bg-white border-top">
        <div className="container py-3 text-muted small">
          Donnees publiques chess.com pour l'historique, stats Lichess uniquement sur requete.
        </div>
      </footer>
    </div>
  );
}
