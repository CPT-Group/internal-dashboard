# Julie's dashboard – dynamic card colors per slide (future)

**Status:** Idea only. Not implemented. Revisit when we want the corner card to adapt to the current slideshow image for better contrast and/or theme match.

---

## Goal

Dynamically change the **CornerInfoCard** background and text colors depending on which slideshow image is currently on screen, so the card has:

- High contrast against the image, and/or  
- A similar theme to the image  

The image stays the main focal point; the card just adapts so it always reads well.

---

## Approaches (no code yet)

### 1. Easiest: light vs dark per image

- **Build time:** A script (alongside or after the existing slide list generator) loads each image and computes “mostly light” or “mostly dark” (e.g. average luminance or sampling a few regions). Output a small array per slide index, e.g. `['dark', 'light', 'dark', ...]`.
- **Runtime:** `BackgroundSlideshow` exposes **which slide index is currently active**. The dashboard passes that index (and the pre-computed theme list) into the card. The card uses one of two style sets: “dark theme” (light text, darker translucent background) or “light theme” (dark text, lighter translucent background).
- **Result:** Card contrast follows the current image without matching exact colors. Small API addition (slide index + optional theme) and two style sets. **Relatively easy.**

### 2. Medium: pre-computed palette per image

- **Build time:** For each image, run a color analysis (dominant colors, or average of corners/mid) and save a small palette per index, e.g. `cardBg`, `cardText`, `cardBorder`.
- **Runtime:** Same idea—slideshow exposes current index; dashboard passes the palette for that index to the card; card applies those colors (e.g. inline style or CSS variables).
- **Result:** Card can better match or complement each image. More work in the build script and in defining “good” palettes from raw colors. **Medium effort.**

### 3. More complicated: sample the visible image in the browser

- **Runtime:** When the slide changes, draw the current image to a canvas, sample pixels, compute dominant color or luminance, then derive card colors on the fly.
- **Result:** No per-image build data, but you need canvas setup, image load/CORS handling, and logic to turn raw pixels into usable card colors. **More involved.**

---

## Summary

- **Easy:** Pre-compute “light” or “dark” per image and switch card theme by current slide index.
- **Medium:** Pre-compute a small palette per image and pass it into the card.
- **Harder:** Real-time sampling from the visible image in the browser.

So it’s **doable**; the “dynamic based on current image” part is straightforward if we use a pre-computed theme (or palette) per slide and have the slideshow report which slide is active.

---

## Current setup (as of this doc)

- Julie's Office (`/tv/julie`): full-viewport unicorn slideshow; **CornerInfoCard** in bottom-right (3.5rem inset) with “Julie Green” / “CPT President & Unicorn Expert”, glassy background (~65% opacity), solid border, theme text colors. `widgetType="none"`; weather/cpt slots reserved for later.
