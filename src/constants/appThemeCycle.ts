/**
 * Canonical order for cycling UI themes (`html[data-theme]` + `localStorage` `cpt-theme`).
 * Keep in sync with the `valid` array in `src/app/layout.tsx` theme-init inline script.
 *
 * Cycle: light → dark → khaki → light-synth → dark-synth → ms-access-2010 →
 *        miami-vice → cpt-barbie → dark-barbie → floral → night-vision →
 *        summer → light → …
 */
export const APP_THEME_CYCLE_ORDER = [
  'light',
  'dark',
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
