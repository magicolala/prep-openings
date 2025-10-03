import type { Color, ExplorerMoveStat, OpeningFenNode, PrepSheet } from "../../domain/models";

interface PrepSheetViewProps {
  sheet: PrepSheet;
  node: OpeningFenNode;
}

const colorLabel: Record<Color, string> = {
  white: "Blancs",
  black: "Noirs",
};

const formatPercent = (value: number | undefined) => {
  if (value === undefined || Number.isNaN(value)) return "-";
  return `${Math.round(value * 100)}%`;
};

const scoreForColor = (move: ExplorerMoveStat, color: Color) => {
  const total = move.total || 1;
  if (color === "white") {
    return (move.white + 0.5 * move.draws) / total;
  }
  return (move.black + 0.5 * move.draws) / total;
};

export default function PrepSheetView({ sheet, node }: PrepSheetViewProps) {
  if (!sheet.leaks.length) {
    return (
      <section className="prep-sheet prep-sheet--empty" aria-live="polite">
        <h2>Pas de fuite majeure détectée</h2>
        <p>Nos heuristiques n'identifient pas de faiblesses flagrantes. Continue à explorer des lignes annexes !</p>
      </section>
    );
  }

  const headerTitle = (node.name ?? node.sanLine.join(" ")) || "ouverture";

  return (
    <section className="prep-sheet" aria-label="Plan d'attaque personnalisé">
      <header className="prep-sheet__header">
        <p className="micro-tag">Plan ciblé</p>
        <h2>Prep sheet {headerTitle}</h2>
        <p>
          Chaque carte résume une opportunité : écart de performance, coups recommandés, parties modèles. Visualisation abstraite pour un onboarding rapide.
        </p>
      </header>

      <div className="prep-sheet__grid">
        {sheet.leaks.map((leak) => {
          const ourColor: Color = leak.color === "white" ? "black" : "white";
          const punishments = leak.recommendedResponses.slice(0, 3).map((resp) => {
            const respScore = scoreForColor(resp, ourColor);
            return {
              label: resp.san,
              score: formatPercent(respScore),
              total: resp.total,
            };
          });
          const leakScoreDiff =
            leak.explorerScore !== undefined
              ? `${formatPercent(leak.playerScore)} vs ${formatPercent(leak.explorerScore)}`
              : formatPercent(leak.playerScore);
          const overlap = leak.yourOverlap
            ? `Ton score ${formatPercent(leak.yourOverlap.score)} sur ${leak.yourOverlap.frequency} parties`
            : null;
          const gap = leak.explorerScore !== undefined ? leak.explorerScore - leak.playerScore : null;
          const dangerLevel = Math.min(1, Math.max(0, leak.playerScore));
          const popularity = leak.explorerPopularity ?? null;

          return (
            <article key={leak.id} className="leak-card" data-color={leak.color}>
              <div className="leak-card__halo" style={{ background: `conic-gradient(var(--danger-500) ${Math.round(dangerLevel * 360)}deg, transparent 0deg)` }} />

              <header className="leak-card__header">
                <div>
                  <p className="micro-tag">{colorLabel[leak.color]}</p>
                  <h3>{leak.openingName ?? headerTitle}</h3>
                  <p className="leak-card__line">{leak.sanLine.join(" ")}</p>
                </div>
                <div className="leak-card__stat">
                  <span
                    className="leak-card__value"
                    title="Score moyen de ton adversaire sur ce coup (victoire = 100 %, nulle = 50 %, défaite = 0 %)."
                  >
                    {formatPercent(leak.playerScore)}
                  </span>
                  <span className="leak-card__caption">Score adverse</span>
                </div>
              </header>

              <div className="leak-card__insights">
                <div>
                  <span className="insight-label">Fuite</span>
                  <p className="insight-value">{leak.move}</p>
                  <span className="insight-caption">{leak.reason}</span>
                </div>
                <div>
                  <span className="insight-label">Fréquence</span>
                  <p className="insight-value">{leak.frequency} parties</p>
                  {popularity !== null && (
                    <span
                      className="insight-caption"
                      title="Part des parties Explorer où l'adversaire choisit ce coup."
                    >
                      Popularité Explorer {formatPercent(popularity)}
                    </span>
                  )}
                </div>
                <div>
                  <span className="insight-label">Gap</span>
                  <p
                    className="insight-value"
                    title="Comparaison entre le score observé de ton adversaire et la référence Explorer."
                  >
                    {leakScoreDiff}
                  </p>
                  {gap !== null && (
                    <span
                      className="insight-caption"
                      title={
                        gap > 0
                          ? "Ton adversaire marque davantage de points que la moyenne : opportunité à sanctionner."
                          : "Ton adversaire sous-performe par rapport à la moyenne : tendance à surveiller."
                      }
                    >
                      Écart {gap > 0 ? "à exploiter" : "à surveiller"}
                    </span>
                  )}
                </div>
              </div>

              {overlap && (
                <p
                  className="leak-card__overlap"
                  title="Résultats obtenus dans tes propres parties sur cette position."
                >
                  {overlap}
                </p>
              )}

              <div className="leak-card__actions">
                <div className="leak-card__chips">
                  {punishments.length ? (
                    punishments.map((item) => (
                      <span key={`${leak.id}-${item.label}`} className="response-chip">
                        <strong>{item.label}</strong>
                        <small title="Score moyen attendu pour toi selon Explorer si tu joues cette réponse.">{item.score}</small>
                        <small title="Nombre de parties Explorer utilisées pour cette recommandation.">{item.total} parties</small>
                      </span>
                    ))
                  ) : (
                    <span className="response-chip response-chip--empty">Pas de référence claire</span>
                  )}
                </div>
                <div className="leak-card__links">
                  {leak.sampleGameUrl && (
                    <a href={leak.sampleGameUrl} target="_blank" rel="noreferrer">
                      Partie témoin
                    </a>
                  )}
                  {leak.lichessRecentGames?.slice(0, 2).map((game) => (
                    <a key={game.id} href={game.url} target="_blank" rel="noreferrer">
                      Modèle Lichess {game.speed ? `(${game.speed})` : ""}
                    </a>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {sheet.modelGames.length > 0 && (
        <footer className="prep-sheet__footer">
          <h3>Parties à décortiquer</h3>
          <div className="model-gallery">
            {sheet.modelGames.slice(0, 6).map((game) => (
              <a key={game.id} href={game.url} target="_blank" rel="noreferrer" className="model-card">
                <span className="model-card__players">
                  {game.white?.name ?? "?"}
                  <span>vs</span>
                  {game.black?.name ?? "?"}
                </span>
                <span className="model-card__meta">{game.speed ? `${game.speed}` : "Classique"}</span>
                {game.highlight && <span className="model-card__highlight">{game.highlight}</span>}
              </a>
            ))}
          </div>
        </footer>
      )}
    </section>
  );
}
