# Theme Setup Investigation: interactive-site-manager & cpt-internal-tools

**→ For how to use and update the dashboard theme in this repo, see [theme-system.md](./theme-system.md).**

Investigation of how **base** (structure / main setup) and **themes** (color overrides) are split in two codebases, for use when reworking internal-dashboard theming.

---

## 1. interactive-site-manager (jQuery UI)

**Path:** `Github-CPT-Group/interactive-site-manager`  
**Stack:** ASP.NET, jQuery UI, CSS (no SCSS). Theme is jQuery UI–style (base + theme).

### Structure

- **Entry:** `Content/themes/base/all.css` (or `Content/Css/themes/base/all.css`)

```css
@import "base.css";
@import "theme.css";
```

So a single “theme” is: **base** + **theme**.

### base.css

- **Role:** Structure and imports only; no colors.
- **Contents:** Imports `core.css` and every component CSS file:
  - `core.css` – layout helpers, reset, interaction cues, icons base, overlays (no colors).
  - `accordion.css`, `button.css`, `dialog.css`, `datepicker.css`, etc. – component structure.

So **base** = core + all component CSS. It defines what is loaded and the non-theme structure.

### theme.css

- **Role:** Color/skin only.
- **Contents:** All visual tokens:
  - `.ui-widget`, `.ui-widget-content`, `.ui-widget-header` – fonts, borders, backgrounds, colors.
  - `.ui-state-default`, `.ui-state-hover`, `.ui-state-active` – hex colors for default/hover/active.
  - Icons, highlights, errors, overlays, shadows – all hex values.

So **theme** = color overrides only; no layout or structure.

### Takeaway (interactive-site-manager)

| Layer   | Purpose                          | Contains                          |
|---------|----------------------------------|-----------------------------------|
| **base**  | Structure, imports, “what to load” | core + component CSS, no colors   |
| **theme** | Look & feel                     | Only colors/skin (hex, borders, bg) |

Swapping theme = swap `theme.css`; base stays the same.

---

## 2. cpt-internal-tools (React + Vite + PrimeReact)

**Path:** `Github-CPT-Group/cpt-internal-tools`  
**Stack:** React, Vite, PrimeReact, SCSS. This is the “nice React application” with base + themes and PrimeReact.

### Entry and load order

**main.tsx:**

1. `primereact/resources/themes/lara-dark-blue/theme.css` – PrimeReact component CSS.
2. `./main.scss` – app globals (variables, base, utilities, theme overrides).

**main.scss (orchestration):**

```scss
@use './styles/variables.scss' as *;
@use './styles/base.scss' as *;
@use './styles/utilities.scss' as *;
@use './styles/themes/dark.scss';
@use './styles/themes/light.scss';
@use './styles/themes/dark-synth.scss';
@use './styles/themes/ms-access-2010.scss';
```

So: **Variables → Base → Utilities → Theme overrides.**  
Theme is applied via `[data-theme='dark']` / `[data-theme='light']` etc. on `<html>` (ThemeProvider).

### base.scss – “main things” setup

**Role:** Resets, layout, PrimeReact base structure, compact controls. **Uses CSS variables only; no hardcoded colors.**

- **Resets:** `* { box-sizing, margin }`, selective `padding: 0` on body/headings/lists (not `*`, to avoid breaking PrimeReact padding).
- **html/body:** `font-size`, font-family, line-height, color, background, overflow – all via `var(--font-size-base)`, `var(--font-family-base)`, `var(--text-primary)`, `var(--page-background)`.
- **#root:** Full viewport, flex, overflow hidden.
- **Accessibility:** `:focus-visible`, `.sr-only`.
- **PrimeReact base:** `.p-component`, overlay, disabled, error, `.p-link`, overlay animations – all reference variables (`var(--font-family)`, `var(--maskbg)`, `var(--color-danger)`, etc.).
- **Scrollbars:** Global scrollbar styling using `var(--scrollbar-thumb-bg)`, `var(--scrollbar-track-bg)`, etc.
- **Compact forms & controls:** Inputs, dropdowns, buttons, dialogs, tags, DataTable, paginator – padding/sizing via variables (`var(--input-padding-y)`, `var(--button-padding-y)`, `var(--border-radius)`, etc.).

So **base** = one place that defines “how the app and PrimeReact are set up,” in terms of layout, structure, and sizing, with theme coming only from variables.

### variables.scss – default design tokens

**Role:** Default values for all CSS variables (design tokens) on `:root`.

- PrimeReact-related: `--font-family`, `--text-color`, `--surface-*`, `--gray-*`, scrollbar vars, focus ring, mask, etc.
- Buttons, inputs, dialogs, DataTable, tags: padding, font-size, line-height.
- Semantic tokens: `--text-primary`, `--page-background`, `--header-bg`, etc.

Themes do not redefine structure; they only override these variables (often under `html[data-theme='dark']` or `[data-theme='light']`).

### Theme files (e.g. dark.scss, light.scss)

**Role:** **Color overrides only.** They target `html[data-theme='dark']` / `[data-theme='light']` and set:

- Semantic variables: `--header-bg`, `--header-fg`, `--window-bg`, `--input-bg`, `--button-bg`, etc.
- PrimeReact-facing vars so base and PrimeReact theme follow the chosen theme: e.g. `--surface-ground`, `--scrollbar-*`, `--maskbg`, `--focus-ring`.

Rules:

- Only override variables already defined in `variables.scss` (or used in base/PrimeReact).
- No layout, no structural CSS in theme files.
- Base and components use only variables, so one theme file = one coherent look.

### ThemeProvider

- Loads the correct PrimeReact theme CSS (e.g. from `public/themes/...`) and sets `data-theme` on `<html>`.
- Theme switching = change `data-theme` + optionally swap which theme CSS is loaded; SCSS theme files respond to `[data-theme='...']`.

### Takeaway (cpt-internal-tools)

| File / layer      | Purpose                                      | Contains                                                                 |
|-------------------|----------------------------------------------|--------------------------------------------------------------------------|
| **variables.scss** | Default design tokens                        | `:root` variables (spacing, colors, PrimeReact tokens, semantic names)  |
| **base.scss**      | Main setup, no colors                        | Resets, html/body/#root, PrimeReact base, scrollbars, compact controls  |
| **utilities.scss** | Helper classes                               | Non-theme utilities                                                      |
| **themes/*.scss**  | Color overrides only                         | `[data-theme='...']` blocks that only set CSS variables                 |

PrimeReact theme CSS is loaded separately (e.g. lara-dark-blue); app SCSS loads after it and overrides `:root` (and theme-specific selectors) so PrimeReact picks up the same variable-based theme.

---

## 3. Summary: pattern for internal-dashboard rework

- **Base (or “main” setup):**
  - Resets, html/body/root.
  - PrimeReact base structure and any global component defaults (scrollbars, overlays, compact sizing if desired).
  - All values from CSS variables; **no hardcoded colors** in base.

- **Variables (design tokens):**
  - One place (e.g. `variables.scss` or `variables.css`) that defines default `:root` variables for spacing, typography, colors, and PrimeReact tokens.

- **Themes:**
  - Separate files (or theme CSS) that **only override variables** (and optionally a few theme-specific overrides) for each theme (e.g. light/dark).
  - Applied via `data-theme` (or class) on `<html>` so base and PrimeReact both read the same tokens.

- **Load order (conceptual):**
  1. PrimeReact theme CSS (component rules).
  2. Variables (default tokens).
  3. Base (structure, PrimeReact base, compact sizing – all variable-based).
  4. Theme overrides (color tokens only).

This keeps “main things” in base, and “color override” in themes, matching both interactive-site-manager and cpt-internal-tools and fitting PrimeReact’s variable-driven theming.
