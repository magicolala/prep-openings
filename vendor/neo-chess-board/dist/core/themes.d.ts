import type { Theme } from './types';
export declare const THEMES: Record<string, Theme>;
export type ThemeName = keyof typeof THEMES;
export type CustomThemeName = ThemeName | (string & {});
export declare const registerTheme: (name: string, theme: Theme) => Theme;
export declare const resolveTheme: (theme: ThemeName | Theme) => Theme;
