/**
 * Ensure Dev Corner Two deploy-card footer ticker text contrasts with its background.
 *
 * RULE: effective ticker text vs --github-deploy-footer-ticker-bg ≥ 3:1.
 *
 * Root cause (Maple good / Aurora+Evergreen bad):
 *   Auto-ported themes set --github-deploy-footer-ticker-text to headerBg (or another
 *   surface tone). On light themes (Maple) that dark tone sits on a white ticker bg →
 *   readable. On dark themes the same dark tone sits on a near-black ticker bg →
 *   ~1:1 invisible footer marquee.
 *
 * Durable fix: always bind ticker text to var(--text-color) (body text is already
 * contrast-tuned per theme). Never use headerBg / surfaceCard / primary-as-bg for
 * ticker text. CSS in GithubDeployRepoCards.module.scss also forces inherit + !important.
 *
 * After regenerating themes from generate-dashboard-themes-from-ui.ts, re-run this script.
 *
 * Usage:
 *   node scripts/fix-github-deploy-ticker-contrast.mjs          # audit only
 *   node scripts/fix-github-deploy-ticker-contrast.mjs --write  # normalize + repair
 */
import fs from 'node:fs';
import path from 'node:path';

const write = process.argv.includes('--write');
const themesDir = path.join('src', 'styles', 'themes');
const MIN_CONTRAST = 3.0;
const TICKER_TEXT_CANONICAL = 'var(--text-color)';

/** @param {string} line */
function parseCssColor(line) {
  const m = line.match(/:\s*([^;!]+)/);
  if (!m) return null;
  const raw = m[1].trim();
  const hex = raw.match(/#([0-9a-f]{3,8})\b/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = Number.parseInt(h.slice(0, 6), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const rgba = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgba) {
    return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]) };
  }
  return null;
}

/** @param {{ r: number, g: number, b: number }} rgb */
function luminance(rgb) {
  const channels = [rgb.r, rgb.g, rgb.b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** @param {{ r: number, g: number, b: number }} a @param {{ r: number, g: number, b: number }} b */
function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** @param {string} content @param {string} prop */
function findPropLine(content, prop) {
  const re = new RegExp(`^\\s*${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*[^;]+;`, 'm');
  return content.match(re)?.[0] ?? null;
}

/** @param {string} content @param {string} prop */
function findPropValue(content, prop) {
  const line = findPropLine(content, prop);
  if (!line) return null;
  const m = line.match(/:\s*([^;!]+)/);
  return m ? m[1].trim() : null;
}

/**
 * Resolve ticker text value to an RGB for contrast checks.
 * `var(--text-color)` → theme's --text-color hex.
 * @param {string} textValue
 * @param {string} content
 */
function resolveTickerTextRgb(textValue, content) {
  const trimmed = textValue.trim();
  if (/^var\(\s*--text-color\s*\)$/i.test(trimmed)) {
    const textColorVal = findPropValue(content, '--text-color');
    return textColorVal ? parseCssColor(`: ${textColorVal}`) : null;
  }
  return parseCssColor(`: ${trimmed}`);
}

/** @param {string} file @param {string} content */
function processTheme(file, content) {
  const bgLine = findPropLine(content, '--github-deploy-footer-ticker-bg');
  const textLine = findPropLine(content, '--github-deploy-footer-ticker-text');
  const metaLine = findPropLine(content, '--github-deploy-timeline-meta-color');
  if (!bgLine || !textLine) return { file, changed: false };

  const bg = parseCssColor(bgLine);
  const textValue = findPropValue(content, '--github-deploy-footer-ticker-text');
  const textColorVal = findPropValue(content, '--text-color');
  const primaryVal = findPropValue(content, '--primary-color');
  const textRgb = textValue ? resolveTickerTextRgb(textValue, content) : null;

  if (!bg || !textRgb) return { file, changed: false, reason: 'unparsed' };

  const ratio = contrast(bg, textRgb);
  const alreadyCanonical = /^var\(\s*--text-color\s*\)$/i.test(textValue ?? '');
  const needsContrastFix = ratio < MIN_CONTRAST;
  const needsNormalize = !alreadyCanonical;

  if (!needsContrastFix && !needsNormalize) {
    return { file, changed: false, ratio: ratio.toFixed(2) };
  }

  let next = content;
  const newTextLine = `  --github-deploy-footer-ticker-text: ${TICKER_TEXT_CANONICAL} !important;`;
  next = next.replace(textLine, newTextLine);

  if (metaLine) {
    const meta = parseCssColor(metaLine);
    if (meta && contrast(bg, meta) < MIN_CONTRAST && primaryVal) {
      const newMetaLine = `  --github-deploy-timeline-meta-color: ${primaryVal} !important;`;
      next = next.replace(metaLine, newMetaLine);
    }
  }

  const borderLine = findPropLine(next, '--github-deploy-footer-ticker-border');
  if (borderLine && primaryVal) {
    const primary = parseCssColor(`: ${primaryVal}`);
    if (primary) {
      const border = `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.34)`;
      const newBorderLine = `  --github-deploy-footer-ticker-border: ${border} !important;`;
      next = next.replace(borderLine, newBorderLine);
    }
  }

  const newTextRgb = textColorVal
    ? parseCssColor(`: ${textColorVal}`)
    : resolveTickerTextRgb(TICKER_TEXT_CANONICAL, next);
  const newRatio = newTextRgb ? contrast(bg, newTextRgb).toFixed(2) : '?';

  return {
    file,
    changed: true,
    ratio: ratio.toFixed(2),
    newRatio,
    reason: needsContrastFix ? 'low-contrast' : 'normalize-to-text-color',
    content: next,
  };
}

const files = fs.readdirSync(themesDir).filter((f) => f.endsWith('.scss'));
/** @type {Array<{ file: string, changed: boolean, ratio?: string, newRatio?: string, reason?: string }>} */
const results = [];

for (const file of files.sort()) {
  const full = path.join(themesDir, file);
  const content = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const result = processTheme(file, content);
  results.push(result);
  if (result.changed && result.content && write) {
    fs.writeFileSync(full, result.content);
  }
}

const fixed = results.filter((r) => r.changed);
const ok = results.filter((r) => !r.changed && r.ratio);
const unparsed = results.filter((r) => r.reason === 'unparsed');

console.log(`Themes scanned: ${files.length}`);
console.log(`Need normalize/fix: ${fixed.length}`);
console.log(`OK (var(--text-color) + ≥${MIN_CONTRAST}:1): ${ok.length}`);
if (unparsed.length) console.log(`Unparsed: ${unparsed.length}`);

for (const r of fixed) {
  const tag = write ? 'FIXED' : 'WOULD FIX';
  console.log(`  ${tag} ${r.file}: ${r.ratio}:1 → ${r.newRatio}:1 (${r.reason ?? 'fix'})`);
}

if (!write && fixed.length > 0) {
  console.log('\nRe-run with --write to apply.');
}
