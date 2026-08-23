// Best-effort parser for SerpApi's google_events date fields, which are free
// text with no year ("Mar 15", "Sat, Mar 15, 9 AM - 5 PM PDT", "Mar 15 - 17").
// Stored as UTC midnight-to-midnight so the existing UTC-based display
// formatting (formatDateRange in events/page.tsx) shows the right calendar
// day regardless of the event's real timezone/hours, which we don't reliably
// have.

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function monthIndex(name: string): number | null {
  const key = name.slice(0, 3).toLowerCase();
  return key in MONTHS ? MONTHS[key] : null;
}

function buildDate(month: number, day: number, year: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Finds the nearest occurrence of month/day that isn't more than a couple
// days in the past relative to `now` (google_events only lists
// current/upcoming events, so a "past" match means we guessed the wrong year).
function nearestFutureDate(month: number, day: number, now: Date): Date {
  const thisYear = buildDate(month, day, now.getUTCFullYear());
  const cutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  return thisYear.getTime() >= cutoff.getTime() ? thisYear : buildDate(month, day, now.getUTCFullYear() + 1);
}

function parseMonthDay(text: string): { month: number; day: number } | null {
  const match = text.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})/);
  if (!match) return null;
  const month = monthIndex(match[1]);
  const day = Number(match[2]);
  if (month === null || !Number.isInteger(day) || day < 1 || day > 31) return null;
  return { month, day };
}

function parseEndFragment(when: string | undefined, startMonth: number): { month: number; day: number } | null {
  if (!when) return null;

  const fullMatches = Array.from(when.matchAll(/([A-Za-z]{3,9})\.?\s+(\d{1,2})/g));
  if (fullMatches.length >= 2) {
    const [, monthText, dayText] = fullMatches[fullMatches.length - 1];
    const month = monthIndex(monthText);
    const day = Number(dayText);
    if (month !== null && Number.isInteger(day)) return { month, day };
  }

  const rangeMatch = when.match(/[-–]\s*(\d{1,2})\b/);
  if (rangeMatch) {
    const day = Number(rangeMatch[1]);
    if (Number.isInteger(day) && day >= 1 && day <= 31) return { month: startMonth, day };
  }

  return null;
}

export function parseSerpEventWindow(
  dateInfo: { start_date?: string; when?: string } | undefined,
  now: Date = new Date(),
): { startsAt: string; endsAt: string } | null {
  const startText = dateInfo?.start_date?.trim();
  if (!startText) return null;

  const startParsed = parseMonthDay(startText);
  if (!startParsed) return null;

  const startDate = nearestFutureDate(startParsed.month, startParsed.day, now);

  const endFragment = parseEndFragment(dateInfo?.when, startParsed.month);
  let endDate = startDate;
  if (endFragment) {
    const candidate = nearestFutureDate(endFragment.month, endFragment.day, now);
    if (candidate.getTime() >= startDate.getTime()) endDate = candidate;
  }

  return {
    startsAt: `${toIsoDate(startDate)}T00:00:00.000Z`,
    endsAt: `${toIsoDate(endDate)}T23:59:59.000Z`,
  };
}
