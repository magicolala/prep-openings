import { useMemo, useState } from "react";
import type { FormEvent } from "react";

export interface UsernameFormProps {
  onRun: (you: string, opponent: string) => void;
  assistantMessage?: string | null;
}

const demoProfiles = ["magnuscarlsen", "firouzja2003", "hikaru", "nepo"] as const;

type DemoProfile = (typeof demoProfiles)[number];

export default function UsernameForm({ onRun, assistantMessage }: UsernameFormProps) {
  const [you, setYou] = useState("");
  const [opp, setOpp] = useState("");

  const isReady = you.trim().length > 0 && opp.trim().length > 0;

  const headline = useMemo(() => {
    if (!you && !opp) return "Un copilote IA pour ta préparation.";
    if (you && !opp) return "Ton style est chargé, qui affrontes-tu ?";
    if (!you && opp) return "On cible ton adversaire, reste à savoir qui tu es.";
    return "Prêt·e pour une analyse augmentée ?";
  }, [you, opp]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isReady) return;
    onRun(you.trim(), opp.trim());
  };

  const handleSwap = () => {
    setYou(opp);
    setOpp(you);
  };

  const handleExample = (value: DemoProfile, target: "you" | "opp") => {
    if (target === "you") setYou(value);
    else setOpp(value);
  };

  return (
    <form className="fusion-card username-form" onSubmit={handleSubmit}>
      <header className="username-form__header">
        <div>
          <p className="micro-tag">Scouting assisté</p>
          <h2>{headline}</h2>
          <p className="username-form__subtitle">
            Laisse l'IA croiser tes historiques, détecter les fuites et te proposer des réponses ciblées. Interface adaptative, data viz immersive, focus sur l'essentiel.
          </p>
        </div>
        <div className="username-form__badge" role="status">
          <span aria-hidden>*</span>
          <div>
            <strong>Analyse en temps réel</strong>
            <p>Recalibrée à chaque recherche, personnalisable.</p>
          </div>
        </div>
      </header>

      <div className="username-form__grid">
        <label className="floating-label">
          <span>Ton identifiant Chess.com</span>
          <input
            id="you"
            value={you}
            onChange={(event) => setYou(event.target.value)}
            placeholder="ex : magicolala"
            autoComplete="username"
            aria-describedby="username-help"
          />
        </label>

        <button type="button" className="swap-button" onClick={handleSwap} aria-label="Inverser les pseudos">
          <span>&lt;&gt;</span>
        </button>

        <label className="floating-label">
          <span>Pseudo de ton adversaire</span>
          <input
            id="opponent"
            value={opp}
            onChange={(event) => setOpp(event.target.value)}
            placeholder="ex : hikaru"
            autoComplete="off"
            aria-describedby="opponent-help"
          />
        </label>
      </div>

      <div className="username-form__helpers">
        <div className="helper-group" id="username-help">
          <p className="helper-title">Ta base</p>
          <div className="chip-row">
            {demoProfiles.slice(0, 2).map((profile) => (
              <button
                key={profile}
                type="button"
                className="chip"
                onClick={() => handleExample(profile, "you")}
              >
                {profile}
              </button>
            ))}
          </div>
        </div>
        <div className="helper-group" id="opponent-help">
          <p className="helper-title">Cible rapide</p>
          <div className="chip-row">
            {demoProfiles.slice(2).map((profile) => (
              <button
                key={profile}
                type="button"
                className="chip"
                onClick={() => handleExample(profile, "opp")}
              >
                {profile}
              </button>
            ))}
          </div>
        </div>
        {assistantMessage && (
          <div className="assistant-hint" role="alert">
            <span aria-hidden>#</span>
            <p>{assistantMessage}</p>
          </div>
        )}
      </div>

      <div className="username-form__actions">
        <button type="submit" className="cta" disabled={!isReady}>
          Lancer l'analyse IA
        </button>
        <p className="micro-copy">
          Conforme WCAG 2.2 AA. Données publiques Chess.com, requêtes Lichess à la demande.
        </p>
      </div>
    </form>
  );
}
