import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import type { OpeningFenNode } from "../../domain/models";

type Orientation = "white" | "black";

type Snapshot = {
  fen: string;
  ply: number;
  san?: string;
  lastMove?: { from: string; to: string };
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

const PIECE_GLYPHS: Record<string, string> = {
  p: "♟",
  r: "♜",
  n: "♞",
  b: "♝",
  q: "♛",
  k: "♚",
  P: "♙",
  R: "♖",
  N: "♘",
  B: "♗",
  Q: "♕",
  K: "♔",
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const parseFenBoard = (fen: string) => {
  const [placement] = fen.split(" ");
  const rows = placement.split("/");
  const board: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));

  rows.forEach((row, fenRankIndex) => {
    let file = 0;
    for (const char of row) {
      const emptyCount = Number.parseInt(char, 10);
      if (!Number.isNaN(emptyCount)) {
        file += emptyCount;
        continue;
      }
      const rank = 7 - fenRankIndex; // rank 0 is first rank from White's perspective
      board[rank][file] = char;
      file += 1;
    }
  });

  return board;
};

const computeBaseSnapshots = (node: OpeningFenNode): Snapshot[] => {
  const chess = new Chess();
  const snapshots: Snapshot[] = [
    {
      fen: chess.fen(),
      ply: 0,
    },
  ];

  for (const [index, san] of node.sanLine.entries()) {
    try {
      const move = chess.move(san);
      if (!move) break;
      snapshots.push({
        fen: chess.fen(),
        ply: index + 1,
        san: move.san,
        lastMove: { from: move.from, to: move.to },
      });
    } catch (error) {
      console.warn("[LineViewer] invalid SAN", san, error);
      break;
    }
  }

  const lastSnapshot = snapshots[snapshots.length - 1];
  if (!lastSnapshot || lastSnapshot.fen !== node.fen) {
    try {
      const chessFromFen = new Chess(node.fen);
      snapshots.push({
        fen: chessFromFen.fen(),
        ply: snapshots.length,
      });
    } catch (error) {
      console.warn("[LineViewer] unable to load node FEN", node.fen, error);
    }
  }

  return snapshots;
};

const computeContinuationSnapshot = (node: OpeningFenNode, san: string | null, startPly: number): Snapshot[] => {
  if (!san) return [];
  try {
    const chess = new Chess(node.fen);
    const move = chess.move(san);
    if (!move) return [];
    return [
      {
        fen: chess.fen(),
        ply: startPly,
        san: move.san,
        lastMove: { from: move.from, to: move.to },
      },
    ];
  } catch (error) {
    console.warn("[LineViewer] invalid continuation", san, error);
    return [];
  }
};

const buildMovePairs = (moves: string[]) => {
  const pairs: Array<{ moveNumber: number; white?: string; black?: string }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }
  return pairs;
};

const squareKey = (file: number, rank: number) => `${FILES[file]}${rank + 1}`;

const MiniBoard = ({
  fen,
  orientation,
  highlight,
}: {
  fen: string;
  orientation: Orientation;
  highlight?: string[];
}) => {
  const board = useMemo(() => parseFenBoard(fen), [fen]);
  const highlightSet = useMemo(() => new Set((highlight ?? []).map((sq) => sq.toLowerCase())), [highlight]);
  const rankOrder = orientation === "white" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const fileOrder = orientation === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <div className="line-viewer__board-grid" role="img" aria-label={`Position après ${fen}`}> 
      {rankOrder.map((rank) =>
        fileOrder.map((file) => {
          const piece = board[rank][file];
          const algebraic = squareKey(file, rank);
          const isLight = (file + rank) % 2 === 0;
          const isHighlighted = highlightSet.has(algebraic);
          return (
            <span
              key={`${algebraic}-${fen}`}
              className={`line-viewer__square${isLight ? " is-light" : " is-dark"}${
                isHighlighted ? " is-highlighted" : ""
              }`}
              aria-label={`${algebraic}${piece ? ` ${piece}` : ""}`}
            >
              {piece ? PIECE_GLYPHS[piece] : ""}
            </span>
          );
        })
      )}
    </div>
  );
};

export function LineViewer({ node }: { node: OpeningFenNode }) {
  const [selectedContinuation, setSelectedContinuation] = useState<string | null>(null);
  const baseSnapshots = useMemo(() => computeBaseSnapshots(node), [node]);
  const continuationSnapshots = useMemo(
    () => computeContinuationSnapshot(node, selectedContinuation, baseSnapshots.length),
    [node, selectedContinuation, baseSnapshots.length]
  );
  const snapshots = useMemo(() => [...baseSnapshots, ...continuationSnapshots], [baseSnapshots, continuationSnapshots]);
  const [cursor, setCursor] = useState(() => Math.max(0, snapshots.length - 1));

  useEffect(() => {
    setSelectedContinuation(null);
  }, [node.id]);

  useEffect(() => {
    setCursor(Math.max(0, baseSnapshots.length - 1));
  }, [node.id, baseSnapshots.length]);

  useEffect(() => {
    setCursor((prev) => Math.min(prev, Math.max(0, snapshots.length - 1)));
  }, [snapshots.length]);

  useEffect(() => {
    if (selectedContinuation) {
      setCursor(Math.max(0, snapshots.length - 1));
    }
  }, [selectedContinuation, snapshots.length]);

  const displayedMoves = useMemo(
    () => (selectedContinuation ? [...node.sanLine, selectedContinuation] : node.sanLine),
    [node.sanLine, selectedContinuation]
  );

  const movePairs = useMemo(() => buildMovePairs(displayedMoves), [displayedMoves]);
  const fallbackTitle = useMemo(() => {
    const joined = node.sanLine.slice(0, 4).join(" ").trim();
    return joined || "Ligne sans nom";
  }, [node.sanLine]);
  const title = node.name ?? fallbackTitle;

  const activeSnapshot = snapshots[cursor];
  const activeMoveIndex = Math.min(displayedMoves.length - 1, Math.max(-1, cursor - 1));
  const orientation: Orientation = node.color === "black" ? "black" : "white";
  const highlightSquares = activeSnapshot?.lastMove
    ? [activeSnapshot.lastMove.from, activeSnapshot.lastMove.to]
    : undefined;

  const goTo = (nextCursor: number) => {
    setCursor(Math.max(0, Math.min(nextCursor, Math.max(0, snapshots.length - 1))));
  };

  const toggleContinuation = (san: string) => {
    setSelectedContinuation((prev) => (prev === san ? null : san));
  };

  return (
    <section className="line-viewer">
      <header className="line-viewer__header">
        <div>
          <p className="micro-tag">Visualisation de la ligne</p>
          <h3>{title}</h3>
          <p className="line-viewer__subtitle">
            {node.eco ? `ECO ${node.eco} – ` : ""}
            {node.frequency} parties récentes. Score adverse moyen {formatPercent(node.score)}.
          </p>
        </div>
      </header>

      <div className="line-viewer__body">
        <div className="line-viewer__board">
          {activeSnapshot && (
            <MiniBoard fen={activeSnapshot.fen} orientation={orientation} highlight={highlightSquares} />
          )}
          <div className="line-viewer__controls" aria-label="Contrôles de navigation de la ligne">
            <button type="button" onClick={() => goTo(0)} disabled={cursor === 0}>
              «
            </button>
            <button type="button" onClick={() => goTo(cursor - 1)} disabled={cursor === 0}>
              ‹
            </button>
            <span>
              {cursor}/{Math.max(0, snapshots.length - 1)}
            </span>
            <button type="button" onClick={() => goTo(cursor + 1)} disabled={cursor >= snapshots.length - 1}>
              ›
            </button>
            <button type="button" onClick={() => goTo(snapshots.length - 1)} disabled={cursor >= snapshots.length - 1}>
              »
            </button>
          </div>
        </div>

        <div className="line-viewer__moves" aria-live="polite">
          <h4>Rejeu rapide</h4>
          {movePairs.length ? (
            <ol>
              {movePairs.map((pair) => {
                const whiteIndex = (pair.moveNumber - 1) * 2;
                const blackIndex = whiteIndex + 1;
                const isWhiteActive = whiteIndex === activeMoveIndex;
                const isBlackActive = blackIndex === activeMoveIndex;
                return (
                  <li key={pair.moveNumber}>
                    <span className="line-viewer__move-number">{pair.moveNumber}.</span>
                    {pair.white ? (
                      <button
                        type="button"
                        className={`line-viewer__move${isWhiteActive ? " is-active" : ""}`}
                        onClick={() => goTo(whiteIndex + 1)}
                      >
                        {pair.white}
                      </button>
                    ) : (
                      <span className="line-viewer__move is-empty">…</span>
                    )}
                    {pair.black ? (
                      <button
                        type="button"
                        className={`line-viewer__move${isBlackActive ? " is-active" : ""}`}
                        onClick={() => goTo(blackIndex + 1)}
                      >
                        {pair.black}
                      </button>
                    ) : (
                      <span className="line-viewer__move is-empty">—</span>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="line-viewer__empty">Position initiale : aucun coup enregistré pour le moment.</p>
          )}

          {node.moveSamples.length > 0 && (
            <div className="line-viewer__continuations">
              <h4>Réponses adverses fréquentes</h4>
              <ul>
                {node.moveSamples.slice(0, 6).map((move) => {
                  const share = move.count / Math.max(1, node.frequency);
                  const averageScore = move.count ? move.scoreSum / move.count : 0;
                  const isActive = selectedContinuation === move.san;
                  return (
                    <li key={move.san}>
                      <button
                        type="button"
                        className={`line-viewer__continuation${isActive ? " is-active" : ""}`}
                        onClick={() => toggleContinuation(move.san)}
                      >
                        <span className="line-viewer__continuation-san">{move.san}</span>
                        <span className="line-viewer__continuation-share">{formatPercent(share)}</span>
                        <span className="line-viewer__continuation-score">{formatPercent(averageScore)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {node.sampleGameUrl && (
        <p className="line-viewer__sample">
          Partie modèle :
          <a href={node.sampleGameUrl} target="_blank" rel="noreferrer">
            Voir sur la plateforme source
          </a>
        </p>
      )}
    </section>
  );
}

export default LineViewer;
