export const THEME_STORAGE_KEY = 'anime_track_theme';

export const APP_THEMES = [
  {
    value: 'verdant',
    label: '森绿',
    description: '深绿基调配青色辅调',
    preview: '#56d39c',
    heroOverlay: 'linear-gradient(120deg, rgba(6,13,12,0.88), rgba(6,13,12,0.4) 44%, rgba(6,13,12,0.88))',
    premierePalette: ['#5dd6f2', '#56d39c', '#8da6ff', '#f4bf62', '#fb7185', '#a78bfa', '#f97316'],
    graphPalette: ['#56d39c', '#5dd6f2', '#8da6ff', '#f4bf62', '#fb7185', '#a78bfa', '#7dd3a4', '#38bdf8', '#c4b5fd', '#f8d08a', '#fda4af', '#86efac', '#67e8f9', '#818cf8', '#d8b4fe', '#fbbf24', '#34d399', '#22d3ee', '#f472b6', '#fb923c'],
  },
  {
    value: 'ember',
    label: '余烬',
    description: '深棕暖调配琥珀辅调',
    preview: '#f2a65a',
    heroOverlay: 'linear-gradient(120deg, rgba(14,8,7,0.92), rgba(14,8,7,0.46) 44%, rgba(14,8,7,0.9))',
    premierePalette: ['#f2a65a', '#ef7d57', '#ffd166', '#fb7185', '#d6b38a', '#c97a63', '#facc15'],
    graphPalette: ['#f2a65a', '#ef7d57', '#ffd166', '#fb7185', '#d6b38a', '#c97a63', '#facc15', '#f39672', '#ffdb85', '#e8a598', '#d8b3a1', '#f08060', '#eab676', '#c98a6f', '#f7b979', '#d9a441', '#bc7865', '#e58f65', '#c9a0c0', '#5eb89c'],
  },
  {
    value: 'noir',
    label: '深黑',
    description: '纯黑基底高清对比',
    preview: '#a0aec0',
    heroOverlay: 'linear-gradient(120deg, rgba(0,0,0,0.94), rgba(0,0,0,0.5) 44%, rgba(0,0,0,0.94))',
    premierePalette: ['#a0aec0', '#718096', '#e2e8f0', '#cbd5e0', '#90cdf4', '#fbb6ce', '#fbd38d'],
    graphPalette: ['#a0aec0', '#90cdf4', '#e2e8f0', '#cbd5e0', '#81c7a8', '#b8b0d8', '#fbd38d', '#98a8b8', '#b9dffb', '#d8dee9', '#e09090', '#9fb7c7', '#b8c4d0', '#fbb6ce', '#c4b5fd', '#93c5fd', '#a7f3d0', '#fde68a', '#d1d5db', '#94a3b8'],
  },
  {
    value: 'lumen',
    label: '暖纸',
    description: '书页暖米色调护眼舒适',
    preview: '#f6ecdd',
    heroOverlay: 'linear-gradient(120deg, rgba(234,217,192,0.92), rgba(234,217,192,0.5) 44%, rgba(234,217,192,0.9))',
    premierePalette: ['#c9782c', '#5a8a6f', '#b8594a', '#8b6c4e', '#d4952a', '#5c7a6a', '#c46b4a'],
    graphPalette: ['#c9782c', '#5a8a6f', '#b8594a', '#8b6c4e', '#d4952a', '#5c7a6a', '#c46b4a', '#7a6a90', '#5a7890', '#9a6332', '#47745f', '#a84d42', '#72583f', '#b87a22', '#47685b', '#ad5b3e', '#6b5b82', '#4d6d80', '#8d552b', '#3f6b57'],
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
