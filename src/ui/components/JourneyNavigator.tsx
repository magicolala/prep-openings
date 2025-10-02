export interface JourneyChapter {
  id: string;
  label: string;
  title: string;
  summary: string;
  accent?: string;
  icon?: string;
}

interface JourneyNavigatorProps {
  chapters: JourneyChapter[];
  activeId: string;
  onSelect?: (id: string) => void;
}

export function JourneyNavigator({ chapters, activeId, onSelect }: JourneyNavigatorProps) {
  return (
    <nav className="journey-navigator" aria-label="Parcours utilisateur">
      {chapters.map((chapter, index) => {
        const isActive = chapter.id === activeId;
        const accentStyle = chapter.accent ? { borderColor: chapter.accent } : undefined;
        return (
          <button
            type="button"
            key={chapter.id}
            className={`journey-navigator__step${isActive ? " is-active" : ""}`}
            aria-current={isActive ? "step" : undefined}
            onClick={() => onSelect?.(chapter.id)}
            style={accentStyle}
          >
            <span className="journey-navigator__index">{index + 1}</span>
            <span className="journey-navigator__label">
              {chapter.icon && (
                <span className="journey-navigator__icon" aria-hidden>
                  {chapter.icon}
                </span>
              )}
              {chapter.label}
            </span>
            <span className="journey-navigator__title">{chapter.title}</span>
            <span className="journey-navigator__summary">{chapter.summary}</span>
          </button>
        );
      })}
    </nav>
  );
}
