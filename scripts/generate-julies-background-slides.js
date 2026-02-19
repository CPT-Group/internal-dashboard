/**
 * Build-time script: reads public/JuliesUnicorns/backgrounds/ and writes
 * src/constants/juliesBackgroundSlides.generated.ts for Julie's Office dashboard
 * rotating background. No API, no third-party deps.
 * Runs before dev/build. Add/remove images in that folder; re-run dev/build to refresh.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FOLDER = path.join(ROOT, 'public', 'JuliesUnicorns', 'backgrounds');
const OUT_FILE = path.join(ROOT, 'src', 'constants', 'juliesBackgroundSlides.generated.ts');

const BASE_URL = '/JuliesUnicorns/backgrounds';
const IMAGE_EXT = new Set([
  '.jpg', '.jpeg', '.jfif', '.png', '.gif', '.webp', '.svg', '.bmp', '.avif',
]);

/** Recursively collect all image paths under dir, with relative path from FOLDER. */
function collectImages(dir, relativeDir = '') {
  const slides = [];
  if (!fs.existsSync(dir)) return slides;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = relativeDir ? `${relativeDir}/${e.name}` : e.name;
    if (e.isDirectory()) {
      slides.push(...collectImages(path.join(dir, e.name), rel));
    } else if (IMAGE_EXT.has(path.extname(e.name).toLowerCase())) {
      slides.push(`${BASE_URL}/${rel.replace(/\\/g, '/')}`);
    }
  }
  return slides;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getSlides() {
  if (!fs.existsSync(FOLDER)) {
    return [];
  }
  const slides = collectImages(FOLDER);
  return slides.length > 0 ? shuffle(slides) : [];
}

const slides = getSlides();
const content = `/** Auto-generated from public/JuliesUnicorns/backgrounds/ – do not edit manually */\n\nexport const JULIES_BACKGROUND_SLIDES = [\n${slides.map((s) => `  '${s}',`).join('\n')}\n] as const;\n`;

fs.writeFileSync(OUT_FILE, content, 'utf8');
