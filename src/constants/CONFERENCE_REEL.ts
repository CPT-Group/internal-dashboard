/**
 * Copy for the conference room text reel (news-ticker style).
 * Sourced from CPT Group website and internal context; see docs/cpt-group-website-info.md.
 */

export const CONFERENCE_REEL_PHRASES = [
  'CPT Group — Class Action Administration',
  'Settlement Administration',
  '30 years of experience',
  'Thousands of cases administered',
  'Billions in settlement funds',
  'Irvine, CA',
  'Elevating standards in class action administration',
  '1-800-542-0900',
  'Best-in-class service',
  'Value-added philosophy',
  'Class member support 1-877-705-5021',
  'Attorney support 1-888-636-2106',
  'info@cptgroup.com',
] as const;

/** Single string for the reel (infinite loop); join with bullet. */
export const CONFERENCE_REEL_TEXT = CONFERENCE_REEL_PHRASES.join('  •  ');
