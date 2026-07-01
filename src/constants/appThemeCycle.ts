/**
 * Canonical order for cycling UI themes (`html[data-theme]` + `localStorage` `cpt-theme`).
 * Keep in sync with the `valid` array in `src/app/layout.tsx` theme-init inline script.
 * Aligned with cpt-internal-tools theme-inventory.md (+ legacy light/dark slugs).
 */
export const APP_THEME_CYCLE_ORDER = [
  'light',
  'dark',
  'atlas-light',
  'atlas-blue',
  'khaki',
  'light-synth',
  'dark-synth',
  'ms-access-2010',
  'miami-vice',
  'cpt-barbie',
  'dark-barbie',
  'floral',
  'night-vision',
  'summer',
  'github-dark',
  'github-light',
  'frostbyte',
  'embercore',
  'abyss',
  'tempest',
  'midas',
  'aurora',
  'evergreen',
  'maple',
  'bloom',
  'espresso',
  'moonstone',
  'rosegold',
  'cpt-cyberpunk',
  'nightfang',
  'neon-district',
  'macaron',
  'arcane',
  'cpt-vault',
  'biohack',
  'hearth',
  'tundra',
  'cpt-paperwork',
  'colorblind-red-light',
  'colorblind-red-dark',
  'colorblind-green-light',
  'colorblind-green-dark',
  'colorblind-blue-yellow-light',
  'colorblind-blue-yellow-dark',
  'colorblind-mono-light',
  'colorblind-mono-dark',
  'all-american',
  'all-american-night',
] as const;

export type AppTheme = (typeof APP_THEME_CYCLE_ORDER)[number];

const ORDER_SET = new Set<string>(APP_THEME_CYCLE_ORDER);

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return value != null && ORDER_SET.has(value);
}

export function parsePersistedAppTheme(raw: string | null, fallback: AppTheme = 'dark-synth'): AppTheme {
  return isAppTheme(raw) ? raw : fallback;
}

/** Next theme after `current`, wrapping after the last entry in `APP_THEME_CYCLE_ORDER`. */
export function nextAppThemeAfter(current: AppTheme): AppTheme {
  const idx = APP_THEME_CYCLE_ORDER.indexOf(current);
  const i = idx >= 0 ? idx : APP_THEME_CYCLE_ORDER.indexOf('dark-synth');
  const safe = i >= 0 ? i : 0;
  return APP_THEME_CYCLE_ORDER[(safe + 1) % APP_THEME_CYCLE_ORDER.length];
}
