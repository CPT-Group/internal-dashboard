# PrimeReact Theming Guide

Based on [PrimeReact Theming Documentation](https://primereact.org/theming/)

**⚠️ IMPORTANT**: See `theme-implementation-notes.md` for the working solution and what NOT to do.

## Overview

PrimeReact is design-agnostic - it doesn't enforce a specific styling. Styling is separated into two parts:
- **Core**: Resides inside PrimeReact to implement component structure (positioning)
- **Theme**: Brings colors and spacing

## Architecture

Themes are CSS files that define the visual appearance. PrimeReact core styles handle the structure.

## Our Implementation

### Theme Files Location

Themes are stored in `public/themes/` folder:
- `public/themes/cpt-legacy-light/theme.css`
- `public/themes/cpt-legacy-dark/theme.css`

These are custom CPT brand themes copied from `cpt-support-portal`.

### Dynamic Theme Loading

We use a **ThemeProvider** component that:
1. Creates a `<link>` element with ID `theme-stylesheet` in the document head
2. Dynamically updates the `href` attribute to point to the selected theme CSS
3. Sets `data-theme` attribute on the HTML element
4. Stores theme preference in localStorage

### Implementation Pattern

```typescript
// ThemeProvider creates and manages the theme link element
const linkId = 'theme-stylesheet';
let linkElement = document.getElementById(linkId) as HTMLLinkElement;

if (!linkElement) {
  linkElement = document.createElement('link');
  linkElement.id = linkId;
  linkElement.rel = 'stylesheet';
  document.head.appendChild(linkElement);
}

// Update href to point to theme CSS
linkElement.href = '/themes/cpt-legacy-dark/theme.css';
document.documentElement.setAttribute('data-theme', 'dark');
```

### Default Theme

- **Default**: Dark mode (`cpt-legacy-dark`)
- Theme preference is stored in `localStorage` with key `cpt-theme`
- Falls back to dark if no preference is stored

## PrimeReact Core Styles

Core styles are imported in `PrimeReactProvider`:
- `primereact/resources/primereact.min.css` - Core component styles
- `primeicons/primeicons.css` - Icon font
- `primeflex/primeflex.css` - Utility classes

**Note**: Theme CSS is loaded dynamically, NOT imported statically.

## Using CSS Variables

Our theme CSS files define CSS variables that can be used in components:

```css
:root {
  --surface-ground: #1a2332;
  --text-color: rgba(255, 255, 255, 0.9);
  --font-family: Lato, Helvetica, sans-serif;
  /* ... more variables ... */
}
```

### Using Variables in globals.css

```css
body {
  background-color: var(--surface-ground);
  color: var(--text-color);
  font-family: var(--font-family);
}
```

## Theme Switching

To switch themes programmatically, use the `useTheme` hook:

```typescript
import { useTheme } from '@/providers';

const MyComponent = () => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button onClick={toggleTheme}>
      Current: {theme} (Click to toggle)
    </button>
  );
};
```

## Best Practices

1. **Theme CSS Location**: Always in `public/themes/` folder
2. **Link Element ID**: Use `theme-stylesheet` for consistency
3. **Default Theme**: Set to dark mode for TV displays
4. **localStorage Key**: Use `cpt-theme` for consistency across CPT apps
5. **data-theme Attribute**: Always set on `document.documentElement`

## CSS Variables Reference

Each PrimeReact theme exports numerous CSS variables. Common ones we use:

- `--surface-ground`: Background color
- `--text-color`: Primary text color
- `--text-color-secondary`: Secondary text color
- `--font-family`: Font family
- `--surface-a` through `--surface-f`: Surface colors
- `--primary-color`: Primary brand color
- `--border-radius`: Component border radius

See the theme CSS files for the complete list of available variables.

## Troubleshooting

### Theme Not Applying

1. Check that theme CSS file exists in `public/themes/`
2. Verify link element is created in document head
3. Check browser console for 404 errors on theme CSS
4. Verify `data-theme` attribute is set on `<html>` element
5. Check that CSS variables are defined in theme CSS

### White Background

If background is white:
1. Ensure `globals.css` uses `var(--surface-ground)` for body background
2. Verify theme CSS is loaded (check Network tab)
3. Check that CSS variables are available (inspect element in DevTools)

## References

- [PrimeReact Theming Documentation](https://primereact.org/theming/)
- [PrimeReact Colors Documentation](https://primereact.org/theming/colors/)
- [PrimeReact SASS API](https://primereact.org/theming/sass-api/)
