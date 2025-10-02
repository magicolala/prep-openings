import type { PrepSuggestion } from '../../domain/models';

export default function SuggestionCard({ s }: { s: PrepSuggestion }) {
  const path = [...s.branch.line.sanLine, s.branch.triggerMove].join(' ');
  const hasLine = Boolean(s.branch.line?.sanLine[0]);
  const scoreInfo = s.branch.explorerEvidence ? `Total : ${s.branch.explorerEvidence.total}` : '';

  return (
    <div className="card h-100 shadow-sm">
      <div className="card-body d-flex flex-column gap-2">
        <div className="text-muted text-uppercase small">ID {s.id.slice(0, 8)}</div>
        <h3 className="h6 mb-0">
          {hasLine ? `Prépa autour de : ${s.branch.line.sanLine.slice(0, 3).join(' ')}` : 'Prépa'}
        </h3>
        <div className="small">
          Déclencheur : <strong>{s.branch.triggerMove}</strong>
        </div>
        <div className="small">Raison : {s.branch.reason}</div>
        {scoreInfo && <div className="text-muted small">{scoreInfo}</div>}
        <div className="bg-body-tertiary rounded px-3 py-2 font-monospace small mb-0">{path}</div>
      </div>
    </div>
  );
}
