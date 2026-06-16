/**
 * Generate internal-dashboard theme SCSS from cpt-internal-tools palette definitions.
 * Tizen-safe: resolves color-mix() to concrete hex/rgba via approximateSolidColor.
 *
 * Usage: npx tsx scripts/generate-dashboard-themes-from-ui.ts [--write]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CUSTOM_THEMES, type CustomThemeDefinition } from '../../cpt-internal-tools/src/theme/customThemes'
import {
	approximateSolidColor,
	deriveThemeTokens,
} from '../../cpt-internal-tools/src/theme/deriveThemeTokens'
import { resolvePalette, type ResolvedThemePalette } from '../../cpt-internal-tools/src/theme/palette'
import { parseColor } from '../../cpt-internal-tools/src/theme/validatePalette'
import { THEMES } from '../../cpt-internal-tools/src/theme/registry'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DASHBOARD_ROOT = path.resolve(__dirname, '..')
const THEMES_DIR = path.join(DASHBOARD_ROOT, 'src/styles/themes')

const EXISTING = new Set(
	fs.readdirSync(THEMES_DIR).filter((f) => f.endsWith('.scss')).map((f) => f.replace(/\.scss$/, '')),
)

const SKIP_GENERATE = new Set(['code-freeze', 'light', 'dark'])

function hexToRgba(hex: string, alpha: number): string {
	const rgb = parseColor(hex)
	if (!rgb) return hex
	return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function resolveValue(raw: string, backdrop: string): string {
	let value = raw.trim()
	for (let i = 0; i < 64 && value.includes('color-mix'); i += 1) {
		const next = value.replace(
			/color-mix\((?:[^()]|\([^()]*\))*\)/gi,
			(expr) => approximateSolidColor(expr, backdrop) ?? expr,
		)
		if (next === value) break
		value = next
	}
	if (value.includes('color-mix')) {
		return approximateSolidColor(value, backdrop) ?? backdrop
	}
	return value
}

function resolveTokens(
	palette: ResolvedThemePalette,
	overrides?: CustomThemeDefinition['tokenOverrides'],
): Record<string, string> {
	const derived = deriveThemeTokens(palette)
	const merged = overrides ? { ...derived, ...overrides } : derived
	const backdrop = palette.pageBackground
	const out: Record<string, string> = {}
	for (const [key, val] of Object.entries(merged)) {
		out[key] = resolveValue(val, backdrop)
	}
	return out
}

function pick(r: Record<string, string>, key: string, fallback: string): string {
	return r[key] ?? fallback
}

function glassArgs(p: ResolvedThemePalette, r: Record<string, string>, isDark: boolean): string[] {
	const primary = p.primary
	const ink = p.textPrimary
	const card = pick(r, '--surface-card', p.surfaceCard)
	const page = p.pageBackground
	if (isDark) {
		return [
			hexToRgba(card, 0.42),
			hexToRgba(card, 0.9),
			hexToRgba(primary, 0.32),
			hexToRgba(primary, 0.08),
			hexToRgba(primary, 0.22),
			'rgba(255, 255, 255, 0.18)',
			'rgba(255, 255, 255, 0.08)',
			hexToRgba('#000000', 0.35),
			'rgba(255, 255, 255, 0.12)',
		]
	}
	return [
		hexToRgba(card, 0.48),
		hexToRgba(card, 0.92),
		hexToRgba(primary, 0.35),
		hexToRgba(primary, 0.07),
		hexToRgba(primary, 0.26),
		'rgba(255, 255, 255, 0.6)',
		'rgba(255, 255, 255, 0.2)',
		hexToRgba(ink, 0.2),
		'rgba(255, 255, 255, 0.65)',
	]
}

function dashboardExtras(p: ResolvedThemePalette, r: Record<string, string>, isDark: boolean): Record<string, string> {
	const primary = p.primary
	const success = p.success
	const danger = p.danger
	const warn = p.warn
	const info = p.info
	const text = p.textPrimary
	const headerBg = p.headerBg
	const surfaceBorder = p.surfaceBorder
	const surfaceCard = pick(r, '--surface-card', p.surfaceCard)
	const chartLabel = isDark ? '#ffffff' : text

	return {
		'--corner-info-card-bg': hexToRgba(surfaceCard, 0.74),
		'--corner-info-card-border': surfaceBorder,
		'--corner-info-card-shadow': hexToRgba(text, isDark ? 0.28 : 0.16),
		'--corner-info-card-divider': hexToRgba(headerBg, 0.32),
		'--corner-info-card-hover-bg': pick(r, '--surface-hover', hexToRgba(primary, 0.12)),
		'--tag-today-bg': hexToRgba(headerBg, 0.16),
		'--tag-today-text': text,
		'--tag-today-border': hexToRgba(headerBg, 0.4),
		'--p-primary-color': 'var(--primary-color)',
		'--chart-bar-primary': hexToRgba(primary, 0.82),
		'--chart-bar-primary-border': `rgb(${parseColor(primary)?.r ?? 0}, ${parseColor(primary)?.g ?? 0}, ${parseColor(primary)?.b ?? 0})`,
		'--chart-success': hexToRgba(success, 0.78),
		'--chart-success-border': `rgb(${parseColor(success)?.r ?? 0}, ${parseColor(success)?.g ?? 0}, ${parseColor(success)?.b ?? 0})`,
		'--chart-danger': hexToRgba(danger, 0.78),
		'--chart-danger-border': `rgb(${parseColor(danger)?.r ?? 0}, ${parseColor(danger)?.g ?? 0}, ${parseColor(danger)?.b ?? 0})`,
		'--chart-warning': hexToRgba(warn, 0.9),
		'--chart-warning-border': `rgb(${parseColor(warn)?.r ?? 0}, ${parseColor(warn)?.g ?? 0}, ${parseColor(warn)?.b ?? 0})`,
		'--chart-label-color': chartLabel,
		'--chart-info': hexToRgba(info, isDark ? 0.24 : 0.24),
		'--chart-info-border': `rgb(${parseColor(info)?.r ?? 0}, ${parseColor(info)?.g ?? 0}, ${parseColor(info)?.b ?? 0})`,
		'--chart-orange': hexToRgba(warn, 0.22),
		'--chart-orange-border': `rgb(${parseColor(warn)?.r ?? 0}, ${parseColor(warn)?.g ?? 0}, ${parseColor(warn)?.b ?? 0})`,
		'--nova-accent': hexToRgba(primary, 0.7),
		'--nova-accent-bg': hexToRgba(primary, 0.18),
		'--nova-accent-border': `rgb(${parseColor(primary)?.r ?? 0}, ${parseColor(primary)?.g ?? 0}, ${parseColor(primary)?.b ?? 0})`,
		'--nova-accent-text': text,
		'--bug-accent-bg': hexToRgba(danger, 0.2),
		'--bug-accent-text': text,
		'--activity-badge-info-text': text,
		'--activity-badge-warning-text': text,
		'--work-hours-badge-danger-text': text,
		'--work-hours-badge-zero-bg': hexToRgba(danger, 0.22),
		'--work-hours-badge-zero-text': text,
		'--work-hours-badge-success-bg': hexToRgba(success, 0.2),
		'--work-hours-badge-success-text': text,
		'--work-hours-badge-over-bg': hexToRgba(warn, 0.2),
		'--work-hours-badge-over-text': text,
		'--work-hours-badge-super-bg': hexToRgba(primary, 0.2),
		'--work-hours-badge-super-text': text,
		'--work-hours-danger-fill': hexToRgba(danger, 0.32),
		'--work-hours-success-fill': hexToRgba(success, 0.22),
		'--work-hours-warning-fill': hexToRgba(warn, 0.24),
		'--work-hours-orange-fill': hexToRgba(warn, 0.24),
		'--work-hours-ahead-fill': hexToRgba(primary, 0.2),
		'--work-hours-super-fill': hexToRgba(info, 0.22),
		'--work-hours-neutral-fill': hexToRgba(primary, 0.2),
		'--work-hours-super-border': `rgb(${parseColor(info)?.r ?? 0}, ${parseColor(info)?.g ?? 0}, ${parseColor(info)?.b ?? 0})`,
		'--github-repo-label-color': text,
		'--github-repo-api-bg': hexToRgba(info, 0.2),
		'--github-repo-api-border': hexToRgba(info, 0.5),
		'--github-repo-tools-bg': hexToRgba(success, 0.18),
		'--github-repo-tools-border': hexToRgba(success, 0.48),
		'--github-repo-nuget-bg': hexToRgba(primary, 0.18),
		'--github-repo-nuget-border': hexToRgba(primary, 0.48),
		'--github-repo-migrations-bg': hexToRgba(warn, 0.2),
		'--github-repo-migrations-border': hexToRgba(warn, 0.5),
		'--github-repo-infra-bg': hexToRgba(success, 0.18),
		'--github-repo-infra-border': hexToRgba(success, 0.48),
		'--github-deploy-progressbar-track-bg': hexToRgba(surfaceBorder, 0.5),
		'--github-deploy-progressbar-fill': hexToRgba(primary, 0.85),
		'--github-deploy-surface-muted-bg': hexToRgba(surfaceCard, 0.96),
		'--github-deploy-surface-muted-border': hexToRgba(surfaceBorder, 0.55),
		'--github-deploy-branch-pill-bg': isDark ? hexToRgba(surfaceCard, 0.98) : 'rgba(255, 255, 255, 0.98)',
		'--github-deploy-branch-pill-border': hexToRgba(surfaceBorder, 0.6),
		'--github-deploy-branch-pill-text': text,
		'--github-deploy-running-chip-bg': hexToRgba(warn, 0.14),
		'--github-deploy-running-chip-border': hexToRgba(warn, 0.5),
		'--github-deploy-running-chip-text': text,
		'--github-deploy-queue-chip-bg': hexToRgba(warn, 0.2),
		'--github-deploy-queue-chip-border': hexToRgba(warn, 0.55),
		'--github-deploy-queue-chip-text': text,
		'--github-deploy-inline-running-track': hexToRgba(warn, 0.18),
		'--github-deploy-inline-queued-track': hexToRgba(warn, 0.16),
		'--github-deploy-footer-ticker-bg': isDark ? hexToRgba(surfaceCard, 0.98) : 'rgba(255, 255, 255, 0.98)',
		'--github-deploy-footer-ticker-border': hexToRgba(headerBg, 0.34),
		'--github-deploy-footer-ticker-text': headerBg,
		'--github-deploy-footer-ticker-shadow': 'none',
		'--content-text-size': '1.05rem',
		'--github-deploy-timeline-meta-color': headerBg,
		'--data-quality-valid': pick(r, '--data-quality-valid', hexToRgba(success, 0.4)),
		'--data-quality-warning': pick(r, '--data-quality-warning', hexToRgba(warn, 0.4)),
		'--data-quality-error': pick(r, '--data-quality-error', hexToRgba(danger, 0.45)),
		'--data-quality-empty': pick(r, '--data-quality-empty', hexToRgba(p.textSecondary, 0.25)),
		'--progress-spinner-size-sm': '14px',
		'--progress-spinner-size-md': '18px',
		'--progress-spinner-color': 'var(--primary-color)',
		'--card-border': hexToRgba(primary, isDark ? 0.18 : 0.14),
		'--card-shadow': isDark
			? `0 2px 8px ${hexToRgba('#000000', 0.35)}, 0 1px 2px ${hexToRgba('#000000', 0.2)}`
			: `0 2px 8px ${hexToRgba(text, 0.1)}, 0 1px 2px ${hexToRgba(text, 0.06)}`,
		'--button-primary-background': pick(r, '--primary-color', primary),
		'--button-primary-background-hover': pick(r, '--dup-checker-toggler-color-hover', primary),
		'--button-primary-text': pick(r, '--primary-color-text', p.primaryText),
	}
}

function coreTokenLines(r: Record<string, string>, extras: Record<string, string>): string[] {
	const keys = [
		'--header-bg',
		'--header-fg',
		'--header-border',
		'--header-shadow',
		'--window-bg',
		'--window-fg',
		'--window-border',
		'--window-surface-bg',
		'--window-surface-fg',
		'--window-surface-border',
		'--input-bg',
		'--input-fg',
		'--input-border',
		'--button-bg',
		'--button-fg',
		'--button-hover-bg',
		'--menu-item-hover-bg',
		'--status-icon-fill',
		'--status-icon-stroke',
		'--status-icon-stroke-offline',
		'--page-background',
		'--text-primary',
		'--button-primary-background',
		'--button-primary-background-hover',
		'--button-primary-text',
		'--maskbg',
		'--focus-ring',
		'--highlight-bg',
		'--highlight-text-color',
		'--color-danger',
		'--surface-ground',
		'--surface-section',
		'--surface-card',
		'--surface-overlay',
		'--surface-border',
		'--surface-hover',
		'--surface-0',
		'--surface-50',
		'--surface-100',
		'--surface-200',
		'--surface-300',
		'--surface-400',
		'--surface-500',
		'--surface-600',
		'--surface-700',
		'--surface-800',
		'--surface-900',
		'--surface-a',
		'--surface-b',
		'--surface-c',
		'--surface-d',
		'--surface-e',
		'--surface-f',
		'--gray-50',
		'--gray-100',
		'--gray-200',
		'--gray-300',
		'--gray-400',
		'--gray-500',
		'--gray-600',
		'--gray-700',
		'--gray-800',
		'--gray-900',
		'--text-color',
		'--text-color-secondary',
		'--primary-color',
		'--primary-color-text',
		'--scrollbar-track-bg',
		'--scrollbar-thumb-bg',
		'--scrollbar-thumb-hover-bg',
		'--card-border',
		'--card-shadow',
		...Object.keys(extras),
		'--multiselect-chip-bg',
		'--multiselect-chip-fg',
		'--multiselect-chip-icon-fg',
		'--multiselect-chip-border',
		'--toast-success-bg',
		'--toast-success-border',
		'--toast-success-text',
		'--toast-info-bg',
		'--toast-info-border',
		'--toast-info-text',
		'--toast-warn-bg',
		'--toast-warn-border',
		'--toast-warn-text',
		'--toast-error-bg',
		'--toast-error-border',
		'--toast-error-text',
		'--cpt-skeleton-bg',
		'--cpt-skeleton-sheen',
		'--progress-spinner-size-sm',
		'--progress-spinner-size-md',
		'--progress-spinner-color',
	]

	const merged = { ...r, ...extras }
	const lines: string[] = []
	for (const key of keys) {
		const val = merged[key]
		if (!val) continue
		if (val.startsWith('var(')) {
			lines.push(`  ${key}: ${val} !important;`)
		} else {
			lines.push(`  ${key}: ${val} !important;`)
		}
	}
	return lines
}

function generateThemeScss(theme: CustomThemeDefinition): string {
	const palette = resolvePalette(theme.palette)
	const isDark = palette.mode === 'dark'
	const r = resolveTokens(palette, theme.tokenOverrides)
	const extras = dashboardExtras(palette, r, isDark)
	const glass = glassArgs(palette, r, isDark)
	const badgePrimaryText = pick(r, '--primary-color-text', palette.primaryText)

	const backdrop = pick(r, '--app-backdrop', palette.pageBackground)
	const hasGradientBackdrop =
		backdrop.includes('gradient') && !backdrop.includes('color-mix')

	let backdropBlock = ''
	if (hasGradientBackdrop) {
		backdropBlock = `
html[data-theme='${theme.id}'] {
  background-color: ${palette.pageBackground} !important;
  background-image: ${backdrop} !important;
}
html[data-theme='${theme.id}'] body {
  background-color: ${palette.pageBackground} !important;
  color: ${palette.textPrimary} !important;
}
`
	}

	return `@use '../mixins/badge-theme' as badge;
@use '../mixins/glass' as glass;

// ${theme.name} — auto-ported from cpt-internal-tools customThemes.ts (${theme.id}).
// Concrete hex/rgba only (no color-mix — Samsung Tizen TV constraint).
${backdropBlock}
html[data-theme='${theme.id}'],
[data-theme='${theme.id}'] {
${coreTokenLines(r, extras).join('\n')}

  @include glass.glass-tokens(
    ${glass[0]},
    ${glass[1]},
    ${glass[2]},
    ${glass[3]},
    ${glass[4]},
    ${glass[5]},
    ${glass[6]},
    ${glass[7]},
    ${glass[8]}
  );

  @include badge.badge-theme-tokens(
    ${palette.primary},
    ${badgePrimaryText},
    rgb(${parseColor(palette.success)?.r ?? 0}, ${parseColor(palette.success)?.g ?? 0}, ${parseColor(palette.success)?.b ?? 0}),
    ${isDark ? '#ffffff' : palette.textPrimary},
    rgb(${parseColor(palette.info)?.r ?? 0}, ${parseColor(palette.info)?.g ?? 0}, ${parseColor(palette.info)?.b ?? 0}),
    ${isDark ? '#ffffff' : palette.textPrimary},
    rgb(${parseColor(palette.warn)?.r ?? 0}, ${parseColor(palette.warn)?.g ?? 0}, ${parseColor(palette.warn)?.b ?? 0}),
    ${isDark ? '#ffffff' : palette.textPrimary},
    rgb(${parseColor(palette.danger)?.r ?? 0}, ${parseColor(palette.danger)?.g ?? 0}, ${parseColor(palette.danger)?.b ?? 0}),
    #ffffff,
    rgb(${parseColor(palette.danger)?.r ?? 0}, ${parseColor(palette.danger)?.g ?? 0}, ${parseColor(palette.danger)?.b ?? 0})
  );
  @include badge.badge-theme-rules();
}
`
}

function aliasScss(sourceId: string, targetId: string, displayName: string): string {
	const sourcePath = path.join(THEMES_DIR, `${sourceId}.scss`)
	const content = fs.readFileSync(sourcePath, 'utf8')
	return content
		.replaceAll(`data-theme='${sourceId}'`, `data-theme='${targetId}'`)
		.replaceAll(`[data-theme='${sourceId}']`, `[data-theme='${targetId}']`)
		.replace(
			/^\/\/ .+$/m,
			`// ${displayName} — alias of legacy \`${sourceId}\` slug; matches cpt-internal-tools \`${targetId}\`.`,
		)
}

/** Canonical picker/cycle order aligned with cpt-internal-tools theme-inventory.md */
export const APP_THEME_IDS = [
	'light',
	'dark',
	'atlas-light',
	'atlas-blue',
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
	'github-dark',
	'github-light',
	'frostbyte',
	'embercore',
	'abyss',
	'tempest',
	'midas',
	'aurora',
	'evergreen',
	'maple',
	'bloom',
	'espresso',
	'moonstone',
	'rosegold',
	'cpt-cyberpunk',
	'nightfang',
	'neon-district',
	'macaron',
	'arcane',
	'cpt-vault',
	'biohack',
	'hearth',
	'tundra',
	'cpt-paperwork',
	'colorblind-red-light',
	'colorblind-red-dark',
	'colorblind-green-light',
	'colorblind-green-dark',
	'colorblind-blue-yellow-light',
	'colorblind-blue-yellow-dark',
	'colorblind-mono-light',
	'colorblind-mono-dark',
] as const

const TITLE_BY_ID: Record<string, string> = {
	light: 'Light',
	dark: 'Dark',
	'atlas-light': 'Atlas Light',
	'atlas-blue': 'Atlas Blue',
	...Object.fromEntries(CUSTOM_THEMES.map((t) => [t.id, t.name])),
	...Object.fromEntries(THEMES.map((t) => [t.id, t.name])),
	'dark-synth': 'Dark Synth',
	'ms-access-2010': 'MS Access 2010',
}

function main(): void {
	const write = process.argv.includes('--write')
	const generated: string[] = []

	for (const theme of CUSTOM_THEMES) {
		if (EXISTING.has(theme.id) || SKIP_GENERATE.has(theme.id)) continue
		const scss = generateThemeScss(theme)
		const outPath = path.join(THEMES_DIR, `${theme.id}.scss`)
		generated.push(theme.id)
		if (write) fs.writeFileSync(outPath, scss, 'utf8')
		else console.log(`Would write ${outPath}`)
	}

	const aliases: Array<[string, string, string]> = [
		['light', 'atlas-light', 'Atlas Light'],
		['dark', 'atlas-blue', 'Atlas Blue'],
	]
	for (const [src, dest, name] of aliases) {
		if (EXISTING.has(dest)) continue
		const scss = aliasScss(src, dest, name)
		generated.push(dest)
		if (write) fs.writeFileSync(path.join(THEMES_DIR, `${dest}.scss`), scss, 'utf8')
	}

	if (write) {
		updateMainScss()
		updateAppThemeCycle()
		updateLayoutValid()
		updateThemeToast()
	}

	console.log(`Generated ${generated.length} theme file(s): ${generated.join(', ')}`)
}

function updateMainScss(): void {
	const mainPath = path.join(DASHBOARD_ROOT, 'src/app/main.scss')
	const lines = fs.readFileSync(mainPath, 'utf8').split('\n')
	const useLines = [...APP_THEME_IDS].map(
		(id) => `@use '../styles/themes/${id}.scss';`,
	)
	useLines.push("@use '../styles/themes/code-freeze.scss';")
	const start = lines.findIndex((l) => l.startsWith("@use '../styles/themes/"))
	const end = lines.findIndex((l, i) => i > start && !l.startsWith("@use '../styles/themes/"))
	const next = [...lines.slice(0, start), ...useLines, ...lines.slice(end)]
	fs.writeFileSync(mainPath, next.join('\n'), 'utf8')
}

function updateAppThemeCycle(): void {
	const filePath = path.join(DASHBOARD_ROOT, 'src/constants/appThemeCycle.ts')
	const body = `/**
 * Canonical order for cycling UI themes (\`html[data-theme]\` + \`localStorage\` \`cpt-theme\`).
 * Keep in sync with the \`valid\` array in \`src/app/layout.tsx\` theme-init inline script.
 * Aligned with cpt-internal-tools theme-inventory.md (+ legacy light/dark slugs).
 */
export const APP_THEME_CYCLE_ORDER = [
${APP_THEME_IDS.map((id) => `  '${id}',`).join('\n')}
] as const;

export type AppTheme = (typeof APP_THEME_CYCLE_ORDER)[number];

const ORDER_SET = new Set<string>(APP_THEME_CYCLE_ORDER);

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return value != null && ORDER_SET.has(value);
}

export function parsePersistedAppTheme(raw: string | null, fallback: AppTheme = 'dark-synth'): AppTheme {
  return isAppTheme(raw) ? raw : fallback;
}

/** Next theme after \`current\`, wrapping after the last entry in \`APP_THEME_CYCLE_ORDER\`. */
export function nextAppThemeAfter(current: AppTheme): AppTheme {
  const idx = APP_THEME_CYCLE_ORDER.indexOf(current);
  const i = idx >= 0 ? idx : APP_THEME_CYCLE_ORDER.indexOf('dark-synth');
  const safe = i >= 0 ? i : 0;
  return APP_THEME_CYCLE_ORDER[(safe + 1) % APP_THEME_CYCLE_ORDER.length];
}
`
	fs.writeFileSync(filePath, body, 'utf8')
}

function updateLayoutValid(): void {
	const filePath = path.join(DASHBOARD_ROOT, 'src/app/layout.tsx')
	let content = fs.readFileSync(filePath, 'utf8')
	const valid = APP_THEME_IDS.map((id) => `'${id}'`).join(', ')
	content = content.replace(
		/var valid = \[[^\]]+\];/,
		`var valid = [${valid}];`,
	)
	fs.writeFileSync(filePath, content, 'utf8')
}

function updateThemeToast(): void {
	const filePath = path.join(DASHBOARD_ROOT, 'src/providers/ThemeChangeToast.tsx')
	const entries = APP_THEME_IDS.map(
		(id) => `  '${id}': '${TITLE_BY_ID[id] ?? id}',`,
	).join('\n')
	const body = `'use client';

import { useEffect, useRef } from 'react';
import { Toast } from 'primereact/toast';
import type { Toast as ToastType } from 'primereact/toast';
import { isAppTheme } from '@/constants/appThemeCycle';

interface ThemeToastDetail {
  theme: string;
}

const TITLE_BY_THEME: Record<string, string> = {
${entries}
};

function readThemeFromEvent(event: Event): string | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail = event.detail as ThemeToastDetail | null | undefined;
  if (!detail || typeof detail.theme !== 'string') return null;
  return isAppTheme(detail.theme) ? detail.theme : null;
}

export const ThemeChangeToast = () => {
  const toastRef = useRef<ToastType | null>(null);

  useEffect(() => {
    const onThemeToast = (event: Event) => {
      const theme = readThemeFromEvent(event);
      if (!theme) return;
      const name = TITLE_BY_THEME[theme] ?? theme;
      toastRef.current?.show({
        severity: 'info',
        summary: \`Theme changed to: \${name}\`,
        life: 3000,
      });
    };

    window.addEventListener('cpt-theme-toast', onThemeToast);
    return () => window.removeEventListener('cpt-theme-toast', onThemeToast);
  }, []);

  return <Toast ref={toastRef} position="bottom-right" />;
};
`
	fs.writeFileSync(filePath, body, 'utf8')
}

main()
