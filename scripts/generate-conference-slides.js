/**
 * Build-time script: reads public/background/background-conf-room/ and writes
 * src/constants/conferenceBackgroundSlides.generated.ts so the conference room
 * slideshow uses every image in that folder. No API, no third-party deps.
 * Runs before dev/build (Netlify, local).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FOLDER = path.join(ROOT, 'public', 'background', 'background-conf-room');
const OUT_FILE = path.join(ROOT, 'src', 'constants', 'conferenceBackgroundSlides.generated.ts');

const BASE_URL = '/background/background-conf-room';
const IMAGE_EXT = new Set([
  '.jpg', '.jpeg', '.jfif', '.png', '.gif', '.webp', '.svg', '.bmp', '.avif',
]);

const FALLBACK_SLIDES = [
  `${BASE_URL}/bg1.jpg`,
  `${BASE_URL}/cpr-art-dark-1.jpg`,
  `${BASE_URL}/cpt-art-1.jpg`,
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

function getSlides() {
  if (!fs.existsSync(FOLDER)) {
    return FALLBACK_SLIDES;
  }
  const slides = collectImages(FOLDER);
  return slides.length > 0 ? shuffle(slides) : FALLBACK_SLIDES;
}

const slides = getSlides();
const content = `/** Auto-generated from public/background/background-conf-room/ – do not edit manually */\n\nexport const CONFERENCE_BACKGROUND_SLIDES = [\n${slides.map((s) => `  '${s}',`).join('\n')}\n] as const;\n`;

fs.writeFileSync(OUT_FILE, content, 'utf8');
