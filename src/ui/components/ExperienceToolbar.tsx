import { useExperiencePreferences } from "../providers/ExperiencePreferences";

interface ExperienceToolbarProps {
  onToggleVoice: () => void;
  voiceListening: boolean;
  voiceSupported: boolean;
}

export function ExperienceToolbar({ onToggleVoice, voiceListening, voiceSupported }: ExperienceToolbarProps) {
  const {
    appearance,
    setAppearance,
    accentHue,
    setAccentHue,
    motion,
    setMotion,
    density,
    setDensity,
    ecoMode,
    toggleEcoMode,
    voiceEnabled,
    toggleVoice,
  } = useExperiencePreferences();

  const cycleTheme = () => {
    const order: Array<typeof appearance> = ["light", "dark", "auto"];
    const next = order[(order.indexOf(appearance) + 1) % order.length];
    setAppearance(next);
  };

  const voiceLabel = voiceSupported
    ? voiceListening
      ? "Assistant vocal actif"
      : voiceEnabled
        ? "Assistant vocal prêt"
        : "Assistant vocal désactivé"
    : "Assistant vocal non supporté";

  return (
    <div className="experience-toolbar" role="group" aria-label="Préférences d'expérience">
      <button
        type="button"
        className="toolbar-chip"
        onClick={cycleTheme}
        aria-label={`Changer le thème, actuel : ${appearance}`}
      >
        <span aria-hidden>*</span>
        <span>{appearance === "auto" ? "Thème auto" : appearance === "dark" ? "Thème nuit" : "Thème jour"}</span>
      </button>

      <label className="toolbar-slider" aria-label="Changer la couleur d'accent">
        <span aria-hidden>#</span>
        <input
          type="range"
          min={0}
          max={360}
          value={accentHue}
          onChange={(event) => setAccentHue(Number(event.target.value))}
        />
      </label>

      <button
        type="button"
        className={`toolbar-chip${motion === "dynamic" ? " is-active" : ""}`}
        onClick={() => setMotion(motion === "dynamic" ? "calm" : "dynamic")}
        aria-pressed={motion === "dynamic"}
      >
        <span aria-hidden>+</span>
        <span>{motion === "dynamic" ? "Animations vives" : "Animations douces"}</span>
      </button>

      <button
        type="button"
        className={`toolbar-chip${density === "comfortable" ? " is-active" : ""}`}
        onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
        aria-pressed={density === "comfortable"}
      >
        <span aria-hidden>=</span>
        <span>{density === "comfortable" ? "Disposition ample" : "Disposition dense"}</span>
      </button>

      <button
        type="button"
        className={`toolbar-chip${ecoMode ? " is-active" : ""}`}
        onClick={toggleEcoMode}
        aria-pressed={ecoMode}
      >
        <span aria-hidden>!</span>
        <span>{ecoMode ? "Mode éco" : "Énergie"}</span>
      </button>

      <button
        type="button"
        className={`toolbar-chip${voiceEnabled ? " is-active" : ""}`}
        onClick={toggleVoice}
        aria-pressed={voiceEnabled}
        disabled={!voiceSupported}
      >
        <span aria-hidden>~</span>
        <span>{voiceEnabled ? "Voix activée" : "Voix coupée"}</span>
      </button>

      <button
        type="button"
        className={`toolbar-chip voice-trigger${voiceListening ? " is-listening" : ""}`}
        onClick={onToggleVoice}
        disabled={!voiceSupported || !voiceEnabled}
        aria-pressed={voiceListening}
        aria-label={voiceLabel}
      >
        <span className="waveform" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <span>{voiceListening ? "Stop" : "Parler"}</span>
      </button>
    </div>
  );
}
