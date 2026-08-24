// Best-effort date-range extraction from free text (a page title, e.g.
// "San Diego Auto Show - Jan 1-4" or "Comic Con (Mar 15-17, 2027)") -- used
// by the Quick Add Event bookmarklet flow to pre-fill the date fields from
// whatever title the source page happened to have. Purely local regex, no
// AI/API call -- this tool exists specifically to work without either.
// Pre-fills an editable field, never decides silently.

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function monthIndex(name: string): number | null {
  const key = name.slice(0, 3).toLowerCase();
  return key in MONTHS ? MONTHS[key] : null;
}

function toIsoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function nearestFutureYear(month: number, day: number, now: Date): number {
  const thisYear = now.getUTCFullYear();
  const candidate = new Date(Date.UTC(thisYear, month, day));
  const cutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  return candidate.getTime() >= cutoff.getTime() ? thisYear : thisYear + 1;
}

const DATE_RANGE_PATTERN =
  /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–]\s*(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?)?/g;

export type ParsedDateRange = { startDate: string; endDate: string; matchedText: string; matchIndex: number } | null;

export function parseDateRangeFromText(text: string, now: Date = new Date()): ParsedDateRange {
  if (!text) return null;

  const yearMatch = text.match(/\b(20\d{2})\b/);
  const explicitYear = yearMatch ? Number(yearMatch[1]) : null;

  for (const match of text.matchAll(DATE_RANGE_PATTERN)) {
    const startMonth = monthIndex(match[1]);
    const startDay = Number(match[2]);
    if (startMonth === null || startDay < 1 || startDay > 31) continue;

    const startYear = explicitYear ?? nearestFutureYear(startMonth, startDay, now);
    const startDate = toIsoDate(startYear, startMonth, startDay);

    let endDate = startDate;
    if (match[4]) {
      const endMonth = match[3] ? monthIndex(match[3]) : startMonth;
      const endDay = Number(match[4]);
      if (endMonth !== null && endDay >= 1 && endDay <= 31) {
        const endYear = explicitYear ?? nearestFutureYear(endMonth, endDay, now);
        endDate = toIsoDate(endYear, endMonth, endDay);
      }
    }

    return { startDate, endDate, matchedText: match[0], matchIndex: match.index ?? -1 };
  }

  return null;
}

// If the matched date text sits at the tail of the string (the common
// "Event Name - Jan 1-4" / "Event Name (Jan 1-4)" shape), strip it plus any
// leading separator/parens so the saved event name doesn't repeat the dates
// that are now in their own fields. Leaves the name untouched if the date
// text is in the middle of a longer sentence -- too risky to guess there.
export function stripTrailingDateText(text: string, parsed: ParsedDateRange): string {
  if (!parsed || parsed.matchIndex < 0) return text;
  const tailStart = parsed.matchIndex + parsed.matchedText.length;
  const afterMatch = text.slice(tailStart);
  if (!/^\)?[\s,]*$/.test(afterMatch)) return text; // date wasn't at the tail -- leave it alone

  const before = text.slice(0, parsed.matchIndex);
  return before.replace(/[\s\-–,(]+$/, "").trim() || text;
}
