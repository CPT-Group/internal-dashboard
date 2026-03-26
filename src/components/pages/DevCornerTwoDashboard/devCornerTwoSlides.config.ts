/**
 * Dev Corner Two carousel — toggle each slide on/off without deleting components.
 * Order matches rotation: In Progress → Recently Completed → Requested → Completions by developer → GitHub.
 *
 * (Today velocity + Dev load matrix are not in this list yet; re-add when restored to the carousel.)
 */
export type DevCornerTwoSlideId =
  | 'inProgress'
  | 'recentlyCompleted'
  | 'requested'
  | 'completedByDev'
  | 'github';

export interface DevCornerTwoSlideToggle {
  id: DevCornerTwoSlideId;
  /** Include this slide in the carousel when true. */
  enabled: boolean;
  /** Dwell time for this slide when it is active (ms). */
  durationMs: number;
}

export const DEV_CORNER_TWO_SLIDE_TOGGLES: DevCornerTwoSlideToggle[] = [
  { id: 'inProgress', enabled: false, durationMs: 25_000 },
  { id: 'recentlyCompleted', enabled: false, durationMs: 25_000 },
  { id: 'requested', enabled: false, durationMs: 25_000 },
  { id: 'completedByDev', enabled: false, durationMs: 25_000 },
  { id: 'github', enabled: true, durationMs: 300_000 },
];
