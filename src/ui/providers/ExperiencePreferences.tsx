import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ThemeAppearance = "light" | "dark" | "auto";
type MotionPreference = "dynamic" | "calm";
type DensityPreference = "comfortable" | "compact";

type PreferenceKeys = "appearance" | "accentHue" | "motion" | "density" | "ecoMode" | "voiceEnabled";

interface PreferenceState {
  appearance: ThemeAppearance;
  accentHue: number;
  motion: MotionPreference;
  density: DensityPreference;
  ecoMode: boolean;
  voiceEnabled: boolean;
}

interface ExperiencePreferencesContext extends PreferenceState {
  setAppearance: (appearance: ThemeAppearance) => void;
  setAccentHue: (hue: number) => void;
  setMotion: (motion: MotionPreference) => void;
  setDensity: (density: DensityPreference) => void;
  toggleEcoMode: () => void;
  toggleVoice: () => void;
}

const DEFAULT_PREFERENCES: PreferenceState = {
  appearance: "auto",
  accentHue: 248,
  motion: "dynamic",
  density: "comfortable",
  ecoMode: false,
  voiceEnabled: true,
};

const STORAGE_KEY = "prep-openings.preferences";

const ExperiencePreferencesContext = createContext<ExperiencePreferencesContext | undefined>(undefined);

const clampHue = (value: number): number => {
  if (Number.isNaN(value)) return DEFAULT_PREFERENCES.accentHue;
  return Math.max(0, Math.min(360, value));
};

const getSystemPrefersDark = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

const loadPreferences = (): PreferenceState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(stored) as Partial<Record<PreferenceKeys, unknown>>;
    return {
      appearance: (parsed.appearance as ThemeAppearance) ?? DEFAULT_PREFERENCES.appearance,
      accentHue: clampHue(Number(parsed.accentHue ?? DEFAULT_PREFERENCES.accentHue)),
      motion: (parsed.motion as MotionPreference) ?? DEFAULT_PREFERENCES.motion,
      density: (parsed.density as DensityPreference) ?? DEFAULT_PREFERENCES.density,
      ecoMode: Boolean(parsed.ecoMode ?? DEFAULT_PREFERENCES.ecoMode),
      voiceEnabled: Boolean(
        parsed.voiceEnabled === undefined ? DEFAULT_PREFERENCES.voiceEnabled : parsed.voiceEnabled
      ),
    };
  } catch (error) {
    console.warn("[ExperiencePreferences] load fallback", error);
    return DEFAULT_PREFERENCES;
  }
};

const paletteStops = [
  { suffix: "50", saturation: 92, lightness: 95 },
  { suffix: "100", saturation: 90, lightness: 90 },
  { suffix: "200", saturation: 88, lightness: 82 },
  { suffix: "300", saturation: 86, lightness: 73 },
  { suffix: "400", saturation: 84, lightness: 66 },
  { suffix: "500", saturation: 82, lightness: 58 },
  { suffix: "600", saturation: 80, lightness: 52 },
  { suffix: "700", saturation: 78, lightness: 45 },
] as const;

const accentContrastByHue = (hue: number) => {
  if (hue >= 45 && hue <= 85) return "#050b18";
  if (hue >= 180 && hue <= 220) return "#050b18";
  return "#f5f3ff";
};

const applyAccentPalette = (hue: number) => {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  paletteStops.forEach(({ suffix, saturation, lightness }) => {
    root.style.setProperty(`--accent-${suffix}`, `hsl(${hue}deg ${saturation}% ${lightness}%)`);
  });
  root.style.setProperty("--accent-contrast", accentContrastByHue(hue));
  root.style.setProperty(
    "--gradient-accent",
    `linear-gradient(135deg, hsl(${hue}deg 82% 60%), hsl(${(hue + 24) % 360}deg 84% 58%))`
  );
};

const applyAppearance = (appearance: ThemeAppearance) => {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  if (appearance === "auto") {
    root.setAttribute("data-theme", getSystemPrefersDark() ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", appearance);
  }
};

const applyDensity = (density: DensityPreference) => {
  if (typeof document === "undefined") return;
  document.body.dataset.density = density;
};

const applyMotion = (motion: MotionPreference) => {
  if (typeof document === "undefined") return;
  document.body.dataset.motion = motion;
};

const applyEcoMode = (ecoMode: boolean) => {
  if (typeof document === "undefined") return;
  document.body.dataset.eco = ecoMode ? "on" : "off";
};

export function ExperiencePreferencesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PreferenceState>(() => {
    if (typeof window === "undefined") return DEFAULT_PREFERENCES;
    return loadPreferences();
  });

  useEffect(() => {
    applyAppearance(state.appearance);
    applyAccentPalette(state.accentHue);
    applyDensity(state.density);
    applyMotion(state.motion);
    applyEcoMode(state.ecoMode);
  }, [state]);

  useEffect(() => {
    if (typeof window === "undefined" || state.appearance !== "auto") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyAppearance("auto");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [state.appearance]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const persistState: Record<PreferenceKeys, unknown> = {
        appearance: state.appearance,
        accentHue: state.accentHue,
        motion: state.motion,
        density: state.density,
        ecoMode: state.ecoMode,
        voiceEnabled: state.voiceEnabled,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistState));
    } catch (error) {
      console.warn("[ExperiencePreferences] persist failed", error);
    }
  }, [state]);

  const value = useMemo<ExperiencePreferencesContext>(() => ({
    ...state,
    setAppearance: appearance => setState(prev => ({ ...prev, appearance })),
    setAccentHue: hue => setState(prev => ({ ...prev, accentHue: clampHue(Math.round(hue)) })),
    setMotion: motion => setState(prev => ({ ...prev, motion })),
    setDensity: density => setState(prev => ({ ...prev, density })),
    toggleEcoMode: () => setState(prev => ({ ...prev, ecoMode: !prev.ecoMode })),
    toggleVoice: () => setState(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled })),
  }), [state]);

  return <ExperiencePreferencesContext.Provider value={value}>{children}</ExperiencePreferencesContext.Provider>;
}

export const useExperiencePreferences = () => {
  const ctx = useContext(ExperiencePreferencesContext);
  if (!ctx) {
    throw new Error("useExperiencePreferences must be used within ExperiencePreferencesProvider");
  }
  return ctx;
};
