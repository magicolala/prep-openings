import type { Color, OpeningFenNode, PrepSheet, ExplorerMoveStat } from "../../domain/models";

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
      <div className="alert alert-success mt-3 mb-0" role="alert">
        Aucune fuite detectee sur cette ligne dans nos heuristiques. Continue quand meme ta prep !
      </div>
    );
  }

  const headerTitle = (node.name ?? node.sanLine.join(" ")) || "ouverture";

  return (
    <div className="card shadow-sm mt-4">
      <div className="card-body">
        <h2 className="h5 card-title">Prep sheet - {headerTitle}</h2>
        <div className="table-responsive">
          <table className="table table-sm align-middle mt-3">
            <thead className="table-light">
              <tr>
                <th scope="col">Couleur</th>
                <th scope="col">Position</th>
                <th scope="col">Frequence</th>
                <th scope="col">Fuite</th>
                <th scope="col">Punition</th>
                <th scope="col">Games</th>
              </tr>
            </thead>
            <tbody>
              {sheet.leaks.map(leak => {
                const ourColor: Color = leak.color === "white" ? "black" : "white";
                const punishments = leak.recommendedResponses.map(resp => {
                  const respScore = scoreForColor(resp, ourColor);
                  return `${resp.san} (${formatPercent(respScore)} - ${resp.total} parties)`;
                });
                const leakScoreDiff =
                  leak.explorerScore !== undefined
                    ? `${formatPercent(leak.playerScore)} vs ${formatPercent(leak.explorerScore)}`
                    : formatPercent(leak.playerScore);
                const overlap = leak.yourOverlap
                  ? `Ton score ${formatPercent(leak.yourOverlap.score)} sur ${leak.yourOverlap.frequency}`
                  : null;
                const witness = leak.sampleGameUrl ? (
                  <a href={leak.sampleGameUrl} target="_blank" rel="noreferrer">
                    Partie temoin
                  </a>
                ) : null;
                const lichessLinks = leak.lichessRecentGames?.slice(0, 2).map(game => (
                  <a key={game.id} href={game.url} target="_blank" rel="noreferrer" className="d-block">
                    Modele Lichess {game.speed ? `(${game.speed})` : ""}
                  </a>
                ));
                return (
                  <tr key={leak.id}>
                    <td>{colorLabel[leak.color]}</td>
                    <td>
                      <div className="small fw-semibold">{leak.openingName ?? headerTitle}</div>
                      <div className="font-monospace text-muted small">{leak.sanLine.join(" ")}</div>
                      <div className="text-muted small">Score: {leakScoreDiff}</div>
                      {overlap && <div className="text-success small">{overlap}</div>}
                    </td>
                    <td>
                      <div>{leak.frequency} parties</div>
                      {leak.explorerPopularity !== undefined && (
                        <div className="text-muted small">Popularite Lichess {formatPercent(leak.explorerPopularity)}</div>
                      )}
                    </td>
                    <td>
                      <div className="small">{leak.move}</div>
                      <div className="text-muted small">{leak.reason}</div>
                    </td>
                    <td>
                      {punishments.length ? (
                        punishments.map(item => (
                          <div key={item} className="text-nowrap small">
                            {item}
                          </div>
                        ))
                      ) : (
                        <div className="text-muted small">Pas de ref clair</div>
                      )}
                    </td>
                    <td className="small">
                      {witness}
                      {lichessLinks}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sheet.modelGames.length > 0 && (
          <div className="mt-3">
            <h3 className="h6 text-muted text-uppercase">Parties modeles a revoir</h3>
            <ul className="list-unstyled small mb-0">
              {sheet.modelGames.map(game => (
                <li key={game.id}>
                  <a href={game.url} target="_blank" rel="noreferrer">
                    {game.white?.name ?? "?"} vs {game.black?.name ?? "?"} {game.speed ? `(${game.speed})` : ""}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
