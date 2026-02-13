# Theme System: Mirroring cpt-internal-tools

This document describes how **cpt-internal-tools** (the target codebase) structures its theme system and where **dark-synth** and other theme colors live. internal-dashboard mirrors this structure so both apps stay aligned.

---

## 1. Where dark-synth colors live (target)

**In cpt-internal-tools, dark-synth colors are only in:**

- **`src/styles/themes/dark-synth.scss`**

They are **not** in `variables.scss`. The theme file applies when `html[data-theme='dark-synth']` or `[data-theme='dark-synth']` matches.

That file defines:

- **Semantic variables**: `--header-bg`, `--header-fg`, `--window-bg`, `--window-fg`, `--window-surface-bg`, `--input-bg`, `--button-bg`, `--menu-item-hover-bg`, `--page-background`, `--text-primary`, `--button-primary-background`, etc.
- **PrimeReact palette**: `--surface-ground`, `--surface-card`, `--surface-border`, `--surface-hover`, `--surface-0` … `--surface-900`, `--surface-a` … `--surface-f`, `--gray-50` … `--gray-900`, `--text-color`, `--text-color-secondary`, `--primary-color`, `--primary-color-text`, scrollbars, `--data-quality-*`, etc.
- **Component overrides**: `.p-dialog` (header, content, footer, icons) so dialogs use the theme’s window/header vars.

All values use `!important` so they override `:root` from `variables.scss`.

---

## 2. Base vs themes (target)

### variables.scss = base/default theme

- **Path**: `src/styles/variables.scss`
- **Scope**: `:root { ... }`
- **Role**: Base design tokens and the **default** theme (what you see when no `data-theme` matches).
- In cpt-internal-tools this default is a **navy** palette (e.g. `--header-bg: #1a2d44`, `--window-bg: #0f1a28`, `--page-background: #1e1e1e`, `--text-primary: #e0e0e0`). PrimeReact vars are mapped to `--color-gray-*` and semantic vars.
- Theme files **override** these when their selector matches.

### base.scss = structure, no theme colors

- **Path**: `src/styles/base.scss`
- **Role**: Resets, `html`/`body` (e.g. `background-color: var(--page-background)`, `color: var(--text-primary)`), typography, scrollbars, PrimeReact base (e.g. `.p-component`). Uses **only** CSS variables; no hardcoded colors.

### themes/*.scss = theme overrides

- **Paths**: `src/styles/themes/dark.scss`, `light.scss`, `dark-synth.scss`, `ms-access-2010.scss`
- **Selectors**: `html[data-theme='<id>'], [data-theme='<id>'] { ... }`
- **Role**: Override `:root` for that theme. **Dark-synth** is entirely in `themes/dark-synth.scss` (see above).

---

## 3. Load order (target)

**In `main.tsx`:**

1. `primereact/resources/themes/lara-dark-blue/theme.css` – PrimeReact theme (component rules + vars).
2. `./main.scss` – our SCSS bundle (see below).
3. Later: `primeflex`, `primeicons`, `primereact.min.css`, `rc-dock/dist/rc-dock.css`.
4. **Last**: `@/styles/primereact-overrides.css` – so it overrides PrimeReact and rc-dock.

**Inside `main.scss`:**

1. `@use './styles/variables.scss'` – `:root` base theme.
2. `@use './styles/base.scss'` – resets, body, base structure.
3. `@use './styles/utilities.scss'` – helpers.
4. `@use './styles/themes/dark.scss'`.
5. `@use './styles/themes/light.scss'`.
6. `@use './styles/themes/dark-synth.scss'`.
7. `@use './styles/themes/ms-access-2010.scss'`.

So: **variables → base → utilities → theme overrides**. Theme application is via `data-theme` on `<html>`; no `<link>` swap.

---

## 4. How theme is applied (target)

- **ThemeProvider** sets `document.documentElement.setAttribute('data-theme', theme)`.
- Valid theme ids: `'dark'`, `'light'`, `'dark-synth'`, `'ms-access-2010'` (or whatever the target supports).
- When `data-theme="dark-synth"`, the selector `html[data-theme='dark-synth']` in `themes/dark-synth.scss` matches and all variables from that file apply.

---

## 5. internal-dashboard mirror

We mirror this as follows:

| Aspect | cpt-internal-tools | internal-dashboard |
|--------|--------------------|--------------------|
| **Dark-synth colors** | `src/styles/themes/dark-synth.scss` only | Same: `src/styles/themes/dark-synth.scss` (same vars and values) |
| **Base/default** | `variables.scss` `:root` (navy) | `variables.scss` `:root` (we use dark-synth as default for first paint; theme file still overrides when `data-theme='dark-synth'`) |
| **Base styles** | `base.scss` uses `--page-background`, `--text-primary` for body | `base.scss` uses same vars for body |
| **Load order** | variables → base → utilities → themes | Same in `main.scss`; then we add `primereact-overrides.scss` at end of same bundle |
| **PrimeReact overrides** | Separate `primereact-overrides.css` loaded last in main.tsx | `primereact-overrides.scss` last in `main.scss` (same effect: our overrides win) |
| **Theme application** | `data-theme` on `<html>` via ThemeProvider | Same; layout has default `data-theme="dark-synth"` and theme-init script |

When adding or changing a theme (e.g. dark-synth), update the **theme file** in `src/styles/themes/` and keep **variables.scss** as the base/fallback. This matches the target and keeps “where are dark-synth colors?” answered by: **themes/dark-synth.scss**.
