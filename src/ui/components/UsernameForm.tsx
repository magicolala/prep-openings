import { useState } from 'react';
import type { FormEvent } from 'react';

export interface UsernameFormProps {
  onRun: (you: string, opponent: string) => void;
}

export default function UsernameForm({ onRun }: UsernameFormProps) {
  const [you, setYou] = useState('');
  const [opp, setOpp] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onRun(you.trim(), opp.trim());
  };

  return (
    <form className="card shadow-sm" onSubmit={handleSubmit}>
      <div className="card-body">
        <h2 className="h5 card-title">Prépare ton match</h2>
        <p className="text-muted small mb-4">
          On va croiser tes parties récentes avec celles de ton adversaire.
        </p>
        <div className="mb-3">
          <label htmlFor="you" className="form-label">
            Ton pseudo chess.com
          </label>
          <input
            id="you"
            value={you}
            onChange={(e) => setYou(e.target.value)}
            placeholder="ex : magicolala"
            className="form-control"
            autoComplete="username"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="opponent" className="form-label">
            Le pseudo de l'adversaire
          </label>
          <input
            id="opponent"
            value={opp}
            onChange={(e) => setOpp(e.target.value)}
            placeholder="ex : hikaru"
            className="form-control"
            autoComplete="off"
          />
        </div>
        <div className="d-flex justify-content-end">
          <button type="submit" className="btn btn-primary">
            Lancer l'analyse
          </button>
        </div>
      </div>
    </form>
  );
}
