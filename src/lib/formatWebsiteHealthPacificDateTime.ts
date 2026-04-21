/**
 * Website Health shows scan and row timestamps in US Pacific (`America/Los_Angeles`),
 * including standard and daylight offsets (often called "PST/PDT" colloquially).
 */
export const WEBSITE_HEALTH_DISPLAY_TIMEZONE = 'America/Los_Angeles';

/**
 * Renders like `9:53am 4/21/2026` (12-hour clock, lowercase am/pm, M/D/YYYY).
 */
export function formatWebsiteHealthPacificDateTime(value: string | Date): string {
  const dt = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(dt.valueOf())) {
    return typeof value === 'string' ? value : String(value);
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: WEBSITE_HEALTH_DISPLAY_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const parts = formatter.formatToParts(dt);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';

  const month = pick('month');
  const day = pick('day');
  const year = pick('year');
  const hour = pick('hour');
  const minute = pick('minute');
  const rawPeriod = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
  const period = rawPeriod.toLowerCase();

  return `${hour}:${minute}${period} ${month}/${day}/${year}`;
}
