import type { Color, OpeningFenNode } from "../../domain/models";

interface OpeningTreeColumnProps {
  color: Color;
  nodes: OpeningFenNode[];
  activeNodeId?: string | null;
  onSelect: (node: OpeningFenNode) => void;
}

const colorLabel: Record<Color, string> = {
  white: "Ses lignes avec les Blancs",
  black: "Ses lignes avec les Noirs",
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export default function OpeningTreeColumn({ color, nodes, activeNodeId, onSelect }: OpeningTreeColumnProps) {
  if (!nodes.length) {
    return (
      <div className="col">
        <div className="card h-100 shadow-sm">
          <div className="card-body text-muted small">
            {color === "white"
              ? "Pas assez de parties recentes avec les Blancs."
              : "Pas assez de parties recentes avec les Noirs."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="col">
      <div className="d-flex flex-column gap-3">
        <h2 className="h6 mb-0 text-uppercase text-muted">{colorLabel[color]}</h2>
        {nodes.slice(0, 10).map(node => {
          const total = node.frequency || 1;
          const topMoves = node.moveSamples.slice(0, 3);
          const title = (node.name ?? node.sanLine.slice(0, 6).join(" ")) || "Ouverture";
          const badgeClass = node.id === activeNodeId ? "btn btn-sm btn-primary" : "btn btn-sm btn-outline-primary";
          return (
            <div key={node.id} className="card shadow-sm">
              <div className="card-body d-flex flex-column gap-2">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h3 className="h6 mb-1">{title}</h3>
                    <div className="text-muted small">
                      Frequence {node.frequency} - Score {formatPercent(node.score)}
                    </div>
                    {node.eco && <div className="text-muted small">ECO {node.eco}</div>}
                  </div>
                  <button type="button" className={badgeClass} onClick={() => onSelect(node)}>
                    Preparer
                  </button>
                </div>
                <div className="font-monospace small bg-body-tertiary rounded px-3 py-2">
                  {node.sanLine.join(" ") || "(debut de partie)"}
                </div>
                <div className="small">
                  {topMoves.length ? "Coups habituels :" : "Pas de coups en base"}
                  {topMoves.length > 0 && (
                    <ul className="list-unstyled small mb-0 mt-1">
                      {topMoves.map(move => {
                        const share = move.count / total;
                        const moveScore = move.count ? move.scoreSum / move.count : 0;
                        return (
                          <li key={move.san} className="d-flex justify-content-between">
                            <span>{move.san}</span>
                            <span className="text-muted">
                              {formatPercent(share)} - {formatPercent(moveScore)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
