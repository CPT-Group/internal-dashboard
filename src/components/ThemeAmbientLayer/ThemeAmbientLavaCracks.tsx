'use client';

import type { JSX } from 'react';

/**
 * Embercore lava-cracks — SVG of glowing volcanic crack lines and bottom lava
 * pool gradients. Rendered inside `.app-ambient-overlay` (z-index 900) with
 * `mix-blend-mode: screen` so the orange glow composites additively with
 * content below — visible on dark surfaces, near-invisible on light text,
 * never blocking data. All animation is CSS only; pointer-events: none
 * is inherited from the parent overlay.
 */
export function ThemeAmbientLavaCracks(): JSX.Element {
	return (
		<svg
			className="app-ambient-overlay__lava-cracks"
			viewBox="0 0 1440 900"
			preserveAspectRatio="xMidYMid slice"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<defs>
				<filter id="ec-glow-bloom" x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
					<feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>

				<filter id="ec-glow-core" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
					<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>

				<filter id="ec-flame-heat" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
					<feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves="3" seed="2" result="noise">
						<animate attributeName="baseFrequency" dur="3s" values="0.02 0.06;0.02 0.14;0.02 0.06" repeatCount="indefinite" />
					</feTurbulence>
					<feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G" />
				</filter>

				<linearGradient id="ec-fg-outer" x1="0%" y1="100%" x2="0%" y2="0%">
					<stop offset="0%"   stopColor="#ff4500" stopOpacity="0" />
					<stop offset="25%"  stopColor="#ff4500" stopOpacity="0.4" />
					<stop offset="65%"  stopColor="#ff8c00" stopOpacity="0.15" />
					<stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
				</linearGradient>
				<linearGradient id="ec-fg-body" x1="0%" y1="100%" x2="0%" y2="0%">
					<stop offset="0%"   stopColor="#ff2200" stopOpacity="0.9" />
					<stop offset="45%"  stopColor="#ff7700" stopOpacity="0.55" />
					<stop offset="80%"  stopColor="#ffdd00" stopOpacity="0.2" />
					<stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
				</linearGradient>
				<linearGradient id="ec-fg-core" x1="0%" y1="100%" x2="0%" y2="0%">
					<stop offset="0%"   stopColor="#ffaa00" stopOpacity="0.95" />
					<stop offset="55%"  stopColor="#ffea00" stopOpacity="0.45" />
					<stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
				</linearGradient>

				<radialGradient id="ec-pool-center" cx="50%" cy="0%" r="100%" gradientTransform="scale(1,0.35) translate(0,0)">
					<stop offset="0%"   stopColor="#ff3300" stopOpacity="0.55" />
					<stop offset="60%"  stopColor="#ff6b00" stopOpacity="0.25" />
					<stop offset="100%" stopColor="#ff6b00" stopOpacity="0" />
				</radialGradient>
				<radialGradient id="ec-pool-left" cx="100%" cy="0%" r="100%">
					<stop offset="0%"   stopColor="#ff4400" stopOpacity="0.45" />
					<stop offset="100%" stopColor="#ff4400" stopOpacity="0" />
				</radialGradient>
				<radialGradient id="ec-pool-right" cx="0%" cy="0%" r="100%">
					<stop offset="0%"   stopColor="#ff5500" stopOpacity="0.4" />
					<stop offset="100%" stopColor="#ff5500" stopOpacity="0" />
				</radialGradient>
			</defs>

			<g className="ec-lava-pools">
				<ellipse className="ec-pool ec-pool--center" cx="720"  cy="928" rx="620" ry="220" fill="url(#ec-pool-center)" />
				<ellipse className="ec-pool ec-pool--left"   cx="-10"  cy="880" rx="320" ry="170" fill="url(#ec-pool-left)" />
				<ellipse className="ec-pool ec-pool--right"  cx="1450" cy="870" rx="300" ry="155" fill="url(#ec-pool-right)" />
			</g>

			<g className="ec-cracks ec-cracks--bloom" filter="url(#ec-glow-bloom)" strokeLinecap="round" strokeLinejoin="round" fill="none">
				<path className="ec-crack ec-crack--a"  d="M0,820 L48,718 L22,625 L72,532 L38,450 L88,362 L58,280 L92,195" strokeWidth="6" stroke="#ff5500" />
				<path className="ec-crack ec-crack--a1" d="M38,450 L118,382 L98,312" strokeWidth="4" stroke="#ff6b00" />
				<path className="ec-crack ec-crack--b"  d="M0,462 L54,408 L32,354 L80,294 L54,230" strokeWidth="5" stroke="#ff5500" />
				<path className="ec-crack ec-crack--c"  d="M688,900 L705,816 L662,732 L718,645 L678,562 L728,475 L695,390" strokeWidth="6" stroke="#ff4400" />
				<path className="ec-crack ec-crack--c1" d="M718,645 L792,594 L768,528 L812,465" strokeWidth="4" stroke="#ff6b00" />
				<path className="ec-crack ec-crack--d"  d="M1210,900 L1185,832 L1228,762 L1196,690 L1240,612 L1215,535" strokeWidth="5" stroke="#ff5500" />
				<path className="ec-crack ec-crack--e"  d="M1440,568 L1392,510 L1425,445 L1382,378" strokeWidth="5" stroke="#ff4400" />
			</g>

			<g className="ec-cracks ec-cracks--mid" strokeLinecap="round" strokeLinejoin="round" fill="none">
				<path className="ec-crack ec-crack--a"  d="M0,820 L48,718 L22,625 L72,532 L38,450 L88,362 L58,280 L92,195" strokeWidth="3" stroke="#ff7722" />
				<path className="ec-crack ec-crack--a1" d="M38,450 L118,382 L98,312" strokeWidth="2" stroke="#ff8833" />
				<path className="ec-crack ec-crack--b"  d="M0,462 L54,408 L32,354 L80,294 L54,230" strokeWidth="2.5" stroke="#ff7722" />
				<path className="ec-crack ec-crack--c"  d="M688,900 L705,816 L662,732 L718,645 L678,562 L728,475 L695,390" strokeWidth="3" stroke="#ff6600" />
				<path className="ec-crack ec-crack--c1" d="M718,645 L792,594 L768,528 L812,465" strokeWidth="2" stroke="#ff8833" />
				<path className="ec-crack ec-crack--d"  d="M1210,900 L1185,832 L1228,762 L1196,690 L1240,612 L1215,535" strokeWidth="2.5" stroke="#ff7722" />
				<path className="ec-crack ec-crack--e"  d="M1440,568 L1392,510 L1425,445 L1382,378" strokeWidth="2.5" stroke="#ff6600" />
			</g>

			<g className="ec-cracks ec-cracks--core" filter="url(#ec-glow-core)" strokeLinecap="round" strokeLinejoin="round" fill="none">
				<path className="ec-crack ec-crack--a"  d="M0,820 L48,718 L22,625 L72,532 L38,450 L88,362 L58,280 L92,195" strokeWidth="1.2" stroke="#ffcc88" />
				<path className="ec-crack ec-crack--a1" d="M38,450 L118,382 L98,312" strokeWidth="1" stroke="#ffbb66" />
				<path className="ec-crack ec-crack--b"  d="M0,462 L54,408 L32,354 L80,294 L54,230" strokeWidth="1" stroke="#ffcc88" />
				<path className="ec-crack ec-crack--c"  d="M688,900 L705,816 L662,732 L718,645 L678,562 L728,475 L695,390" strokeWidth="1.2" stroke="#ffddaa" />
				<path className="ec-crack ec-crack--c1" d="M718,645 L792,594 L768,528 L812,465" strokeWidth="1" stroke="#ffbb66" />
				<path className="ec-crack ec-crack--d"  d="M1210,900 L1185,832 L1228,762 L1196,690 L1240,612 L1215,535" strokeWidth="1" stroke="#ffcc88" />
				<path className="ec-crack ec-crack--e"  d="M1440,568 L1392,510 L1425,445 L1382,378" strokeWidth="1" stroke="#ffddaa" />
			</g>

			<g className="ec-cracks ec-cracks--surface" strokeLinecap="round" strokeLinejoin="round" fill="none">
				<path d="M288,900 L302,872 L285,848 L296,825" strokeWidth="3.5" stroke="#cc3300" filter="url(#ec-glow-bloom)" />
				<path d="M488,900 L500,876 L482,856" strokeWidth="3" stroke="#cc3300" filter="url(#ec-glow-bloom)" />
				<path d="M850,900 L864,874 L846,852 L860,828" strokeWidth="3.5" stroke="#cc3300" filter="url(#ec-glow-bloom)" />
				<path d="M1068,900 L1078,877 L1062,854" strokeWidth="3" stroke="#cc3300" filter="url(#ec-glow-bloom)" />
				<path d="M1358,900 L1365,882 L1352,862" strokeWidth="3" stroke="#cc3300" filter="url(#ec-glow-bloom)" />
				<path d="M288,900 L302,872 L285,848 L296,825" strokeWidth="1.5" stroke="#ff6633" />
				<path d="M488,900 L500,876 L482,856" strokeWidth="1.2" stroke="#ff6633" />
				<path d="M850,900 L864,874 L846,852 L860,828" strokeWidth="1.5" stroke="#ff6633" />
				<path d="M1068,900 L1078,877 L1062,854" strokeWidth="1.2" stroke="#ff6633" />
				<path d="M1358,900 L1365,882 L1352,862" strokeWidth="1.2" stroke="#ff6633" />
			</g>

			<g className="ec-flames">
				<g className="ec-flame ec-flame--1">
					<g transform="translate(38,450) scale(0.72) translate(-38,-450)">
						<g filter="url(#ec-flame-heat)">
							<path className="ec-f-bg"   fill="url(#ec-fg-outer)" d="M14,450 C8,427 28,393 38,380 C48,393 68,427 62,450 Z" />
							<path className="ec-f-mid"  fill="url(#ec-fg-body)"  d="M22,450 C18,432 32,402 38,392 C44,402 58,432 54,450 Z" />
							<path className="ec-f-core" fill="url(#ec-fg-core)"  d="M30,450 C28,437 35,416 38,408 C41,416 48,437 46,450 Z" />
						</g>
					</g>
				</g>
				<g className="ec-flame ec-flame--2">
					<g transform="translate(58,280) scale(0.72) translate(-58,-280)">
						<g filter="url(#ec-flame-heat)">
							<path className="ec-f-bg"   fill="url(#ec-fg-outer)" d="M34,280 C28,256 48,224 58,210 C68,224 88,256 82,280 Z" />
							<path className="ec-f-mid"  fill="url(#ec-fg-body)"  d="M42,280 C38,262 52,234 58,222 C64,234 78,262 74,280 Z" />
							<path className="ec-f-core" fill="url(#ec-fg-core)"  d="M50,280 C48,267 55,248 58,238 C61,248 68,267 66,280 Z" />
						</g>
					</g>
				</g>
				<g className="ec-flame ec-flame--3">
					<g transform="translate(718,645) scale(0.72) translate(-718,-645)">
						<g filter="url(#ec-flame-heat)">
							<path className="ec-f-bg"   fill="url(#ec-fg-outer)" d="M690,645 C684,619 708,585 718,570 C728,585 752,619 746,645 Z" />
							<path className="ec-f-mid"  fill="url(#ec-fg-body)"  d="M702,645 C697,624 712,593 718,581 C724,593 739,624 734,645 Z" />
							<path className="ec-f-core" fill="url(#ec-fg-core)"  d="M710,645 C708,631 715,610 718,603 C721,610 728,631 726,645 Z" />
						</g>
					</g>
				</g>
				<g className="ec-flame ec-flame--4">
					<g transform="translate(678,562) scale(0.72) translate(-678,-562)">
						<g filter="url(#ec-flame-heat)">
							<path className="ec-f-bg"   fill="url(#ec-fg-outer)" d="M654,562 C648,539 668,508 678,497 C688,508 708,539 702,562 Z" />
							<path className="ec-f-mid"  fill="url(#ec-fg-body)"  d="M662,562 C658,543 672,514 678,504 C684,514 698,543 694,562 Z" />
							<path className="ec-f-core" fill="url(#ec-fg-core)"  d="M670,562 C668,549 675,530 678,523 C681,530 688,549 686,562 Z" />
						</g>
					</g>
				</g>
				<g className="ec-flame ec-flame--5">
					<g transform="translate(1215,535) scale(0.72) translate(-1215,-535)">
						<g filter="url(#ec-flame-heat)">
							<path className="ec-f-bg"   fill="url(#ec-fg-outer)" d="M1187,535 C1181,509 1205,475 1215,460 C1225,475 1249,509 1243,535 Z" />
							<path className="ec-f-mid"  fill="url(#ec-fg-body)"  d="M1199,535 C1194,514 1209,483 1215,471 C1221,483 1236,514 1231,535 Z" />
							<path className="ec-f-core" fill="url(#ec-fg-core)"  d="M1207,535 C1205,521 1212,500 1215,493 C1218,500 1225,521 1223,535 Z" />
						</g>
					</g>
				</g>
				<g className="ec-flame ec-flame--6">
					<g transform="translate(302,872) scale(0.72) translate(-302,-872)">
						<g filter="url(#ec-flame-heat)">
							<path className="ec-f-bg"   fill="url(#ec-fg-outer)" d="M280,872 C274,852 296,823 302,817 C308,823 330,852 324,872 Z" />
							<path className="ec-f-mid"  fill="url(#ec-fg-body)"  d="M288,872 C284,856 298,830 302,824 C306,830 320,856 316,872 Z" />
							<path className="ec-f-core" fill="url(#ec-fg-core)"  d="M294,872 C292,860 299,843 302,838 C305,843 312,860 310,872 Z" />
						</g>
					</g>
				</g>
			</g>
		</svg>
	)
}
