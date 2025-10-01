import { useMemo, useState } from "react";
import UsernameForm from "./ui/components/UsernameForm";
import SuggestionCard from "./ui/components/SuggestionCard";
import { ChessComService } from "./services/ChessComService";
import { LichessExplorerService } from "./services/LichessExplorerService";
import { OpeningAnalyzer } from "./usecases/OpeningAnalyzer";
import type { PrepSuggestion } from "./domain/models";

export default function App() {
  const chessCom = useMemo(() => new ChessComService(), []);
  const explorer = useMemo(() => new LichessExplorerService(), []);
  const analyzer = useMemo(() => new OpeningAnalyzer(), []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PrepSuggestion[]>([]);

  const run = async (you: string, opponent: string) => {
    setError(null);
    setSuggestions([]);
    if (!you || !opponent) {
      setError("Renseigne les deux pseudos, t'abuses.");
      return;
    }
    setLoading(true);
    try {
      const [yg, og] = await Promise.all([
        chessCom.getRecentGames(you, 4),
        chessCom.getRecentGames(opponent, 4),
      ]);
      const res = await analyzer.findCommonWeaknesses({
        you: { username: you },
        opponent: { username: opponent },
        yourGames: yg,
        oppGames: og,
        explorer,
      });
      setSuggestions(res);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column">
      <header className="border-bottom bg-white sticky-top shadow-sm">
        <div className="container py-3">
          <h1 className="h3 mb-1">Prépa d'ouvertures vs un adversaire</h1>
          <p className="text-muted small mb-0">Chess.com + Lichess Explorer · TS · SOLID-ish</p>
        </div>
      </header>
      <main className="container flex-grow-1 py-4">
        <div className="row justify-content-center">
          <div className="col-lg-10 col-xl-9">
            <UsernameForm onRun={run} />
            {loading && (
              <div className="alert alert-info d-flex align-items-center gap-2 mt-3 mb-0" role="status">
                <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                <span>Je bosse, détends-toi...</span>
              </div>
            )}
            {error && (
              <div className="alert alert-danger mt-3 mb-0" role="alert">
                {error}
              </div>
            )}
            {!loading && suggestions.length > 0 && (
              <section className="row row-cols-1 row-cols-md-2 g-3 mt-3">
                {suggestions.map(s => (
                  <div key={s.id} className="col">
                    <SuggestionCard s={s} />
                  </div>
                ))}
              </section>
            )}
            {!loading && !error && suggestions.length === 0 && (
              <div className="text-muted small mt-3">Entre deux pseudos et lance, frérot.</div>
            )}
          </div>
        </div>
      </main>
      <footer className="bg-white border-top">
        <div className="container py-3 text-muted small">
          Données publiques chess.com, stats d'ouvertures via Lichess Explorer. Pas de moteur, juste de l'heuristique propre.
        </div>
      </footer>
    </div>
  );
}
