# Theme System – Usage and Maintenance

This document is the **canonical reference** for how the internal-dashboard theme system works, how to use it, and how to update or extend it. It applies to both human developers and AI agents.

---

## 1. Overview

- **Pattern**: Matches **cpt-internal-tools**: one PrimeReact theme CSS + app SCSS (variables → base → utilities → **theme overrides**). Theme is applied via the `data-theme` attribute on `<html>`; there is **no** dynamic `<link>` swap.
- **Default theme**: **dark-synth** (synthwave purple/cyan). First paint and unknown/invalid stored values use dark-synth.
- **Available themes**: `dark-synth`, `dark`, `light`, `ms-access-2010`.
- **Where you can change theme**: **Home page only** – a sticky button at the top cycles themes. TV and other routes do not show a theme switcher.

---

## 2. File Structure and Load Order

| File | Purpose |
|------|--------|
| `src/app/layout.tsx` | Imports PrimeReact theme CSS, then `main.scss`. Renders `<html data-theme="dark-synth">` by default and runs the theme-init script. |
| `src/app/main.scss` | **Orchestration only.** `@use` in order: variables → base → utilities → theme files (dark, light, dark-synth, ms-access-2010). |
| `src/styles/variables.scss` | **Default design tokens** on `:root` (dark-synth values). All theme files override these when `[data-theme='...']` matches. |
| `src/styles/base.scss` | Resets, `html`/`body`, Lato fonts, progress-spinner/chart utility classes, layout/page styles. Uses `var(--...)` only; no hardcoded colors. |
| `src/styles/utilities.scss` | Focus-visible, `.sr-only`, etc. |
| `src/styles/themes/dark.scss` | Variable overrides for `html[data-theme='dark']` (and `[data-theme='dark']`). |
| `src/styles/themes/light.scss` | Variable overrides for `data-theme='light'`. |
| `src/styles/themes/dark-synth.scss` | Variable overrides for `data-theme='dark-synth'` + `.p-dialog` overrides. |
| `src/styles/themes/ms-access-2010.scss` | Variable overrides for `data-theme='ms-access-2010'`. |
| `src/styles/primereact-overrides.scss` | **Shared** overrides for PrimeReact components that lara-dark-blue hardcodes. Uses theme variables only; loaded after theme files. |

**PrimeReact hardcoded components:** The lara-dark-blue theme uses **hardcoded** colors for some components (e.g. `.p-card` background/color, `.p-dialog`). Variable overrides alone are not enough for those. Each theme file therefore includes explicit component overrides (e.g. `.p-card`, `.p-dialog`) that set `background`, `color`, `border`, `box-shadow` from our theme variables. If a PrimeReact component doesn’t pick up the theme. Overrides live in primereact-overrides.scss for Card, DataTable, Message, Tag, Button, Skeleton. Theme-specific overrides (e.g. .p-dialog in dark-synth) stay in the theme file. Charts use Chart.js; colors come from JS options/data.

**Load order (conceptual):**

1. `primereact/resources/themes/lara-dark-blue/theme.css` (in layout)
2. `main.scss` → variables → base → utilities → dark → light → dark-synth → ms-access-2010 → primereact-overrides

Our SCSS runs **after** the PrimeReact theme, so our `:root` and `[data-theme='...']` overrides determine the final look.

### Where dark-synth colors live (mirroring cpt-internal-tools)

We mirror **cpt-internal-tools** (the target codebase). There, **dark-synth colors live only in** `src/styles/themes/dark-synth.scss` — not in variables. When `html[data-theme='dark-synth']` matches, that file’s variables override `:root`. We use the same structure: **dark-synth palette and semantic vars are in `src/styles/themes/dark-synth.scss`**; `variables.scss` is the base/fallback (we use dark-synth as the default there for first paint). Base styles use `--page-background` and `--text-primary` for body, same as the target. For a full deep dive of the target (base vs themes, load order, where each theme lives), see **theme-system-cpt-internal-tools-mirror.md**.

---

## 3. How to Use the Theme in Code

### Reading / switching theme (client components)

```ts
import { useTheme } from '@/providers/ThemeProvider';

const { theme, setTheme, cycleTheme } = useTheme();

// theme: 'dark' | 'light' | 'dark-synth' | 'ms-access-2010'
// setTheme('dark-synth') – set a specific theme
// cycleTheme() – cycle: dark-synth → dark → light → ms-access-2010 → dark-synth
```

- **Theme switcher UI**: Only the **home page** (`src/components/pages/HomePage/HomePage.tsx`) renders the sticky theme button and calls `cycleTheme()`. Other pages do not expose a switcher.

### Styling components (no inline theme colors)

- Use **CSS variables** only for colors/spacing that should respond to theme, e.g. `var(--text-color)`, `var(--surface-ground)`, `var(--primary-color)`.
- **Do not** hardcode hex/rgba for theme-dependent UI. Put new tokens in `variables.scss` and each theme file if a new semantic name is needed.
- For **progress spinners**: use classes `progress-spinner-sm` or `progress-spinner-md` (sizes come from `--progress-spinner-size-sm` / `--progress-spinner-size-md`).
- For **chart containers**: use classes `chart-height-sm`, `chart-height-md`, `chart-height-lg`, `chart-height-xl` as needed; JiraMeterChart uses `chart-meter-container`, `chart-meter-center-value`, `chart-meter-center-label`. Chart **sizing** is global (from `variables.scss` only); theme files do not override chart sizes. Chart **colors** come from theme variables via the options you pass to Chart (e.g. `--text-color`, `--surface-border`).

---

## 4. How to Update or Extend the Theme

### Change the default theme

- **Layout**: In `src/app/layout.tsx`, set the default on `<html>` and in the theme-init script:
  - `<html ... data-theme="dark-synth">` → change to the desired default (e.g. `data-theme="dark"`).
  - In the script, change the fallback: `var theme = ... ? stored : 'dark-synth';` to the same value.
- **ThemeProvider**: In `src/providers/ThemeProvider.tsx`, change `useState<Theme>('dark-synth')` and the return value of `parseStoredTheme` for invalid/missing storage to the same default.

### Add a new theme

1. **Add the theme id** to the type and list:
   - In `src/providers/ThemeProvider.tsx`: extend `Theme` and `THEME_ORDER`, and add the new id to `parseStoredTheme`.
2. **Create the theme file**: `src/styles/themes/<theme-id>.scss` (e.g. `midnight.scss`).
   - Structure: `html[data-theme='<theme-id>'], [data-theme='<theme-id>'] { ... }` with the same variable names as in `variables.scss` and other theme files (use `!important` for overrides).
   - Include spinner size variables if you use the shared classes: `--progress-spinner-size-sm`, `--progress-spinner-size-md`. Chart sizing is global (`variables.scss` only); do not add chart height/meter vars to theme files.
3. **Import in main.scss**: add `@use '../styles/themes/<theme-id>.scss';` after the other theme `@use` lines.
4. **Layout script**: add the new id to the `valid` array in the theme-init script so it is accepted from `localStorage`.
5. **Optional**: Add a label/button for the new theme on the home page (e.g. in the cycle or a future theme picker).

### Add or change a theme variable

1. **Define the default** in `src/styles/variables.scss` (`:root`).
2. **Override in every theme file** that should differ from that default (e.g. `src/styles/themes/dark.scss`, `light.scss`, `dark-synth.scss`, `ms-access-2010.scss`). Use the same variable name and `!important` so theme wins over `:root`.
3. Use the variable in `base.scss` or components via `var(--variable-name)`.

### Match cpt-internal-tools

- Theme **names** and **variable names** are aligned with cpt-internal-tools. When adding or changing variables, check `cpt-internal-tools/src/styles/variables.scss` and `themes/*.scss` and keep names (and where possible values) in sync so the two apps behave consistently.

---

## 5. Theme-Init Script and Storage

- **Key**: `localStorage.getItem('cpt-theme')`.
- **Valid values**: `'dark'`, `'light'`, `'dark-synth'`, `'ms-access-2010'`. Any other value (or missing) is treated as invalid and **reset to the default (dark-synth)**; the script also writes that back to `localStorage`.
- **Script location**: Inline in `src/app/layout.tsx`, `strategy="beforeInteractive"`, so it runs before React and ensures `data-theme` is set (or corrected) early to avoid a flash of the wrong theme.

---

## 6. PrimeReact and Other CSS

- **PrimeReact theme**: `primereact/resources/themes/lara-dark-blue/theme.css` is imported in **layout** (not in ThemeProvider). It provides component structure and baseline variables; our SCSS overrides them.
- **PrimeReactProvider** (client): imports `primereact/resources/primereact.min.css`, `primeicons/primeicons.css`, `primeflex/primeflex.css`. Do not import a second full theme here; the single theme is in layout.
- **globals.css**: Contains only a comment that styling is replaced by `main.scss`. It is not imported in layout.

---

## 7. Quick Reference for Agents

- **Default theme**: dark-synth.
- **Where theme is set**: `data-theme` on `<html>`; persisted in `localStorage` under `cpt-theme`.
- **To add a variable**: add to `variables.scss` and to each theme file that should override it.
- **To add a theme**: new file under `src/styles/themes/<id>.scss`, extend Theme and THEME_ORDER and parseStoredTheme in ThemeProvider, add `@use` in main.scss, add id to theme-init `valid` array.
- **No inline theme colors**: use `var(--...)` and, if needed, new variables in variables + theme files.
- **Theme switcher**: home page only; use `useTheme().cycleTheme()` or `setTheme(id)`.

---

## 8. Related Docs

- **theme-system-cpt-internal-tools-mirror.md** – **Deep dive on cpt-internal-tools**: where dark-synth and other theme colors live, base vs themes, load order. Use this when mirroring the target or answering “where are dark-synth colors?”
- **theme-investigation-interactive-and-internal-tools.md** – Background on the base vs theme-override pattern and how cpt-internal-tools is structured.
- **theme-implementation-notes.md** – Legacy notes about the old link-based theme loading; the current implementation uses SCSS + `data-theme` only (no dynamic theme `<link>`).
- **primereact-theming.md** – Legacy; theme loading and switcher behavior are now as described in this document.
