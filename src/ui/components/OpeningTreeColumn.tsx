import type { Color, OpeningFenNode } from "../../domain/models";

interface OpeningTreeColumnProps {
  color: Color;
  nodes: OpeningFenNode[];
  activeNodeId?: string | null;
  onSelect: (node: OpeningFenNode) => void;
}

const colorLabel: Record<Color, string> = {
  white: "Ses armes avec les Blancs",
  black: "Ses lignes cote Noirs",
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export default function OpeningTreeColumn({ color, nodes, activeNodeId, onSelect }: OpeningTreeColumnProps) {
  if (!nodes.length) {
    return (
      <section className="opening-column opening-column--empty">
        <header>
          <h3>{colorLabel[color]}</h3>
          <p>Pas assez de parties recentes pour detecter des patterns fiables.</p>
        </header>
      </section>
    );
  }

  const maxFrequency = nodes.reduce((max, node) => Math.max(max, node.frequency), 1);

  return (
    <section className={`opening-column opening-column--${color}`}>
      <header className="opening-column__header">
        <div>
          <p className="micro-tag">{color === "white" ? "En premiere" : "A la riposte"}</p>
          <h3>{colorLabel[color]}</h3>
          <p className="opening-column__subtitle">
            Visualisation abstraite: intensite = frequence, halo = danger potentiel, puces = coups clefs.
          </p>
        </div>
      </header>

      <div className="opening-column__list">
        {nodes.slice(0, 10).map((node) => {
          const topMoves = node.moveSamples.slice(0, 3);
          const share = Math.max(0.12, node.frequency / maxFrequency);
          const threat = Math.max(0.05, node.score);
          const eco = node.eco ? node.eco : null;
          const title = node.name ?? (node.sanLine.length ? node.sanLine.slice(0, 4).join(" ") : "Ouverture");

          return (
            <button
              key={node.id}
              type="button"
              className={`line-card${node.id === activeNodeId ? " is-active" : ""}`}
              onClick={() => onSelect(node)}
            >
              <div className="line-card__visual">
                <div
                  className="line-card__orb"
                  style={{
                    background: `conic-gradient(var(--accent-400) ${Math.round(threat * 360)}deg, rgba(148, 163, 184, 0.25) 0deg)`
                  }}
                >
                  <span>{formatPercent(node.score)}</span>
                </div>
                <div className="line-card__meter">
                  <span style={{ width: `${Math.round(share * 100)}%` }} />
                </div>
              </div>

              <div className="line-card__body">
                <div className="line-card__titles">
                  <h4>{title}</h4>
                  <p className="line-card__san">{node.sanLine.join(" ") || "(debut de partie)"}</p>
                </div>
                <div className="line-card__meta">
                  <span>{node.frequency} parties</span>
                  {eco && <span className="eco-tag">ECO {eco}</span>}
                  {node.yourOverlap && (
                    <span className="overlap-tag">
                      Toi: {formatPercent(node.yourOverlap.score)} ({node.yourOverlap.frequency})
                    </span>
                  )}
                </div>
                <div className="line-card__moves">
                  {topMoves.length ? (
                    topMoves.map((move) => {
                      const shareLocal = move.count / (node.frequency || 1);
                      const moveScore = move.count ? move.scoreSum / move.count : 0;
                      return (
                        <span key={move.san} className="move-chip" title={`${formatPercent(shareLocal)} - ${formatPercent(moveScore)}`}>
                          <span>{move.san}</span>
                          <small>{formatPercent(shareLocal)}</small>
                        </span>
                      );
                    })
                  ) : (
                    <span className="move-chip move-chip--empty">Pas de coup reference</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
