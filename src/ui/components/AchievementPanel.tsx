interface AchievementPanelProps {
  leaksFound: number;
  nodesExplored: number;
  ecoMode: boolean;
  voiceEnabled: boolean;
}

const BADGES = [
  { id: "eco", label: "Eco Designer", description: "Mode éco activé", icon: "🌱" },
  { id: "voice", label: "Voice Navigator", description: "Navigation vocale dispo", icon: "🎙" },
  {
    id: "strategist",
    label: "Strategist",
    description: "Repère 3 fuites ou plus",
    icon: "♞",
    threshold: 3,
  },
  {
    id: "scout",
    label: "Opening Scout",
    description: "Explore 5 lignes",
    icon: "🧭",
    threshold: 5,
  },
];

export function AchievementPanel({ leaksFound, nodesExplored, ecoMode, voiceEnabled }: AchievementPanelProps) {
  const unlockedBadges = BADGES.filter((badge) => {
    if (badge.id === "eco") return ecoMode;
    if (badge.id === "voice") return voiceEnabled;
    if (badge.id === "strategist") return leaksFound >= (badge.threshold ?? Infinity);
    if (badge.id === "scout") return nodesExplored >= (badge.threshold ?? Infinity);
    return false;
  });

  const progress = Math.min(100, Math.round(((leaksFound + nodesExplored) / 10) * 100));

  return (
    <section className="achievement-panel" aria-label="Progression et récompenses">
      <header className="achievement-panel__header">
        <h2>Gamification & feedback</h2>
        <p>Visualise ta progression et débloque des badges éthiques.</p>
      </header>

      <div className="achievement-panel__progress" role="img" aria-label={`Progression actuelle ${progress}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="achievement-panel__stats">
        <div>
          <span className="achievement-panel__value">{nodesExplored}</span>
          <span className="achievement-panel__caption">Lignes scannées</span>
        </div>
        <div>
          <span className="achievement-panel__value">{leaksFound}</span>
          <span className="achievement-panel__caption">Fuites détectées</span>
        </div>
      </div>

      <div className="achievement-panel__badges" role="list">
        {BADGES.map((badge) => {
          const unlocked = unlockedBadges.some((item) => item.id === badge.id);
          return (
            <div
              key={badge.id}
              role="listitem"
              className={`achievement-panel__badge${unlocked ? " is-unlocked" : ""}`}
              aria-pressed={unlocked}
            >
              <span aria-hidden>{badge.icon}</span>
              <div>
                <strong>{badge.label}</strong>
                <p>{badge.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
