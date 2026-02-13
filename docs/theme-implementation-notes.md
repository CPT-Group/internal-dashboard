# Theme Implementation Notes (Legacy)

**→ For current theme behavior and how to use/update themes, see [theme-system.md](./theme-system.md).**

This file describes the **old** link-based theme loading (cpt-legacy-dark/light). The app now uses **SCSS + data-theme** (one bundle, no dynamic `<link>`). Kept for historical context.

---

# Theme Implementation - Working Solution (Legacy)

## ✅ What Works (DO THIS) – *replaced by theme-system.md*

### Correct Implementation Pattern

**In `src/app/layout.tsx`:**

```typescript
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Static link tag in body - server-rendered, loads synchronously */}
        <link
          id="theme-stylesheet"
          rel="stylesheet"
          href="/themes/cpt-legacy-dark/theme.css"
        />
        {/* Script only updates href if user has different preference */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('cpt-theme') || 'dark';
                  var link = document.getElementById('theme-stylesheet');
                  if (link) {
                    link.href = theme === 'light' 
                      ? '/themes/cpt-legacy-light/theme.css'
                      : '/themes/cpt-legacy-dark/theme.css';
                  }
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Why This Works

1. **Static link tag in body**: The `<link>` tag is server-rendered in the HTML, so it loads synchronously before React hydrates
2. **CSS variables available immediately**: Because the CSS loads early, `globals.css` can use `var(--surface-ground)` and other variables
3. **Script only updates**: The script doesn't create the link (it already exists), it only updates the `href` if the user has a different theme preference
4. **No hydration errors**: No manual `<head>` tags or invalid patterns

## ❌ What Doesn't Work (DON'T DO THIS)

### 1. `metadata.other` Approach
```typescript
// ❌ DOESN'T WORK - doesn't create link tags
export const metadata: Metadata = {
  other: {
    'theme-stylesheet': '/themes/cpt-legacy-dark/theme.css',
  },
};
```
**Problem**: `metadata.other` doesn't actually create `<link>` tags in the HTML.

### 2. `app/head.tsx` File
```typescript
// ❌ DOESN'T WORK - not supported in Next.js App Router
export default function Head() {
  return (
    <link id="theme-stylesheet" rel="stylesheet" href="/themes/cpt-legacy-dark/theme.css" />
  );
}
```
**Problem**: `app/head.tsx` is not a valid pattern in Next.js 16 App Router.

### 3. Manual `<head>` Tag in Layout
```typescript
// ❌ DOESN'T WORK - causes hydration errors
<html>
  <head>
    <link id="theme-stylesheet" ... />
  </head>
  <body>...</body>
</html>
```
**Problem**: Manually adding `<head>` tags in App Router causes hydration mismatches.

### 4. Creating Link Dynamically in Script
```typescript
// ❌ DOESN'T WORK - CSS loads asynchronously, variables not available
<script>
  var link = document.createElement('link');
  link.href = '/themes/cpt-legacy-dark/theme.css';
  document.head.appendChild(link);
</script>
```
**Problem**: CSS loads asynchronously, so when `globals.css` tries to use `var(--surface-ground)`, the variables aren't available yet → white background.

### 5. ThemeProvider Only (No Static Link)
```typescript
// ❌ DOESN'T WORK - too late, page renders before CSS loads
// Only using ThemeProvider useEffect to create link
```
**Problem**: `useEffect` runs after React hydrates, so the page renders with white background before CSS loads.

## Key Principles

1. **CSS must load synchronously** - The theme CSS must be in the initial HTML so it loads before React hydrates
2. **Link tag must be server-rendered** - Not created dynamically by JavaScript
3. **Script only updates, doesn't create** - The script should update an existing link's href, not create a new one
4. **No manual head manipulation** - Don't try to add `<head>` tags manually in App Router

## Testing Checklist

Before saying it's fixed:
- [ ] Take a browser screenshot and verify dark background is visible
- [ ] Check that CSS variables are available (inspect element, check computed styles)
- [ ] Verify no hydration errors in console
- [ ] Test theme switching works (if implemented)
- [ ] Run `npm run build` to ensure no build errors

## Version History

- **v0.1.13**: Fixed by adding static link tag in body - THIS IS THE WORKING SOLUTION
- **v0.1.12**: Broke by using `metadata.other` approach
- **v0.1.11**: Tried manual head tag - caused hydration errors
- **v0.1.10**: Tried `app/head.tsx` - not supported
- **v0.1.9**: Tried dynamic link creation in script - CSS loaded too late

## Current Working State

✅ Static `<link>` tag in `<body>` (server-rendered)
✅ Script with `beforeInteractive` strategy updates href if needed
✅ ThemeProvider handles runtime theme switching
✅ Dark theme default works correctly
✅ No hydration errors
✅ CSS variables available immediately for `globals.css`
