export const THEME_STORAGE_KEY = 'anime_track_theme';

export const APP_THEMES = [
  {
    value: 'verdant',
    label: '森绿',
    description: '深绿基调配青色辅调',
    preview: '#56d39c',
    heroOverlay: 'linear-gradient(120deg, rgba(6,13,12,0.88), rgba(6,13,12,0.4) 44%, rgba(6,13,12,0.88))',
    premierePalette: ['#5dd6f2', '#56d39c', '#8da6ff', '#f4bf62', '#fb7185', '#a78bfa', '#f97316'],
  },
  {
    value: 'ember',
    label: '余烬',
    description: '深棕暖调配琥珀辅调',
    preview: '#f2a65a',
    heroOverlay: 'linear-gradient(120deg, rgba(14,8,7,0.92), rgba(14,8,7,0.46) 44%, rgba(14,8,7,0.9))',
    premierePalette: ['#f2a65a', '#ef7d57', '#ffd166', '#fb7185', '#d6b38a', '#c97a63', '#facc15'],
  },
] as const;

export type AppTheme = (typeof APP_THEMES)[number]['value'];
export type AppThemeDefinition = (typeof APP_THEMES)[number];

const APP_THEME_VALUES = APP_THEMES.map((theme) => theme.value) as readonly AppTheme[];

const APP_THEME_MAP = new Map<AppTheme, AppThemeDefinition>(
  APP_THEMES.map((theme) => [theme.value, theme])
);

export const DEFAULT_THEME: AppTheme = 'verdant';

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return typeof value === 'string' && APP_THEME_VALUES.includes(value as AppTheme);
}

export function getAppThemeDefinition(theme: AppTheme): AppThemeDefinition {
  return APP_THEME_MAP.get(theme) ?? APP_THEMES[0];
}

export const themeInitScript = `(() => {
  try {
    const savedTheme = window.localStorage.getItem('${THEME_STORAGE_KEY}');
    const supportedThemes = ${JSON.stringify(APP_THEME_VALUES)};
    const theme = supportedThemes.includes(savedTheme)
      ? savedTheme
      : '${DEFAULT_THEME}';
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = '${DEFAULT_THEME}';
  }
})();`;
