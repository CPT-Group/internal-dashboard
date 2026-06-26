'use client';

import type { JSX } from 'react';

/**
 * Barbie ambient layer — diagonal scrolling heart wallpaper and realistic
 * soap-bubble SVGs that rise from the bottom with a gentle sway. Pure CSS,
 * no JS.
 */
export function ThemeAmbientBarbieBubbles(): JSX.Element {
	return (
		<>
			<div className="app-ambient-overlay__barbie-hearts" />
			<svg
				className="app-ambient-overlay__barbie-bubbles"
				viewBox="0 0 1440 900"
				preserveAspectRatio="xMidYMid slice"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				<defs>
					<radialGradient id="bb-body" cx="35%" cy="32%" r="68%" gradientUnits="objectBoundingBox">
						<stop offset="0%"   stopColor="#ffffff" stopOpacity="0.66" />
						<stop offset="28%"  stopColor="#ffb6c1" stopOpacity="0.33" />
						<stop offset="62%"  stopColor="#ff69b4" stopOpacity="0.48" />
						<stop offset="85%"  stopColor="#e91e8c" stopOpacity="0.39" />
						<stop offset="100%" stopColor="#c2185b" stopOpacity="0.30" />
					</radialGradient>
					<radialGradient id="bb-sheen" cx="68%" cy="72%" r="58%" gradientUnits="objectBoundingBox">
						<stop offset="0%"   stopColor="#b0e8ff" stopOpacity="0.38" />
						<stop offset="45%"  stopColor="#d4b0ff" stopOpacity="0.26" />
						<stop offset="100%" stopColor="#ffffff"  stopOpacity="0" />
					</radialGradient>
				</defs>

				<g className="barbie-bubble barbie-bubble--1">
					<circle cx="210"  cy="960" r="46" fill="url(#bb-body)"  stroke="#ff69b4" strokeWidth="0.8" strokeOpacity="0.60" />
					<circle cx="210"  cy="960" r="46" fill="url(#bb-sheen)" />
					<circle cx="193"  cy="943" r="12" fill="#ffffff" fillOpacity="0.51" />
					<circle cx="189"  cy="939" r="5"  fill="#ffffff" fillOpacity="0.82" />
				</g>
				<g className="barbie-bubble barbie-bubble--2">
					<circle cx="520"  cy="930" r="30" fill="url(#bb-body)"  stroke="#ff69b4" strokeWidth="0.7" strokeOpacity="0.56" />
					<circle cx="520"  cy="930" r="30" fill="url(#bb-sheen)" />
					<circle cx="508"  cy="918" r="8"  fill="#ffffff" fillOpacity="0.53" />
					<circle cx="505"  cy="915" r="3"  fill="#ffffff" fillOpacity="0.82" />
				</g>
				<g className="barbie-bubble barbie-bubble--3">
					<circle cx="1050" cy="955" r="19" fill="url(#bb-body)"  stroke="#ff69b4" strokeWidth="0.6" strokeOpacity="0.56" />
					<circle cx="1050" cy="955" r="19" fill="url(#bb-sheen)" />
					<circle cx="1043" cy="947" r="5"  fill="#ffffff" fillOpacity="0.53" />
					<circle cx="1041" cy="945" r="2"  fill="#ffffff" fillOpacity="0.83" />
				</g>
				<g className="barbie-bubble barbie-bubble--4">
					<circle cx="1220" cy="945" r="40" fill="url(#bb-body)"  stroke="#ff69b4" strokeWidth="0.8" strokeOpacity="0.58" />
					<circle cx="1220" cy="945" r="40" fill="url(#bb-sheen)" />
					<circle cx="1205" cy="930" r="10" fill="#ffffff" fillOpacity="0.51" />
					<circle cx="1201" cy="926" r="4"  fill="#ffffff" fillOpacity="0.82" />
				</g>
				<g className="barbie-bubble barbie-bubble--5">
					<circle cx="370"  cy="975" r="24" fill="url(#bb-body)"  stroke="#ff69b4" strokeWidth="0.7" strokeOpacity="0.54" />
					<circle cx="370"  cy="975" r="24" fill="url(#bb-sheen)" />
					<circle cx="360"  cy="965" r="6"  fill="#ffffff" fillOpacity="0.51" />
					<circle cx="357"  cy="962" r="2.5" fill="#ffffff" fillOpacity="0.82" />
				</g>
				<g className="barbie-bubble barbie-bubble--6">
					<circle cx="1340" cy="935" r="14" fill="url(#bb-body)"  stroke="#ff69b4" strokeWidth="0.6" strokeOpacity="0.54" />
					<circle cx="1340" cy="935" r="14" fill="url(#bb-sheen)" />
					<circle cx="1334" cy="929" r="4"  fill="#ffffff" fillOpacity="0.51" />
					<circle cx="1332" cy="927" r="1.5" fill="#ffffff" fillOpacity="0.83" />
				</g>
				<g className="barbie-bubble barbie-bubble--7">
					<circle cx="740"  cy="985" r="56" fill="url(#bb-body)"  stroke="#ff69b4" strokeWidth="0.9" strokeOpacity="0.57" />
					<circle cx="740"  cy="985" r="56" fill="url(#bb-sheen)" />
					<circle cx="720"  cy="965" r="15" fill="#ffffff" fillOpacity="0.49" />
					<circle cx="715"  cy="960" r="6"  fill="#ffffff" fillOpacity="0.78" />
				</g>
				<g className="barbie-bubble barbie-bubble--8">
					<circle cx="950"  cy="950" r="32" fill="url(#bb-body)"  stroke="#ff69b4" strokeWidth="0.7" strokeOpacity="0.57" />
					<circle cx="950"  cy="950" r="32" fill="url(#bb-sheen)" />
					<circle cx="937"  cy="937" r="8"  fill="#ffffff" fillOpacity="0.51" />
					<circle cx="934"  cy="934" r="3"  fill="#ffffff" fillOpacity="0.82" />
				</g>
			</svg>
		</>
	)
}
