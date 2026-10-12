import { OpenStatus } from './models';

const DAYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
const DAY_MINUTES = 24 * 60;

type Range = [start: number, end: number];

function parseDays(selector: string): number[] | 'holiday-only' | null {
  if (!selector) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  const days = new Set<number>();
  let sawHoliday = false;
  for (const token of selector.split(',').map((t) => t.trim())) {
    if (token === 'ph' || token === 'sh') {
      sawHoliday = true;
      continue;
    }
    const [from, to, ...rest] = token.split('-').map((t) => DAYS.indexOf(t.trim()));
    if (from === undefined || from < 0 || rest.length) {
      return null;
    }
    if (to === undefined) {
      days.add(from);
      continue;
    }
    if (to < 0) {
      return null;
    }
    for (let d = from; ; d = (d + 1) % 7) {
      days.add(d);
      if (d === to) break;
    }
  }
  if (!days.size) {
    return sawHoliday ? 'holiday-only' : null;
  }
  return [...days];
}

function parseTimes(spec: string): Range[] | null {
  const ranges: Range[] = [];
  for (const part of spec.split(',')) {
    const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(part.trim());
    if (!m) {
      return null;
    }
    const start = +m[1] * 60 + +m[2];
    let end = +m[3] * 60 + +m[4];
    if (start > DAY_MINUTES || end > DAY_MINUTES || +m[2] > 59 || +m[4] > 59) {
      return null;
    }
    if (end <= start) {
      end += DAY_MINUTES;
    }
    ranges.push([start, end]);
  }
  return ranges;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Closes in…" / "Opens in…" replace the clock time inside this window. */
const SOON_MINUTES = 45;

export interface HoursInfo {
  status: OpenStatus;
  /** Short human-readable summary, e.g. "Open · closes 10 PM". */
  label: string;
  /** True when the place is open but closes within the next 45 minutes. */
  closingSoon: boolean;
}

/**
 * Parses the common subset of the OSM `opening_hours` syntax (weekday ranges with time
 * spans, `off`, `24/7`) into per-weekday ranges. Returns null for anything it cannot
 * fully understand — months, sunrise, comments, fallbacks — rather than guessing.
 */
function parseWeek(openingHours: string | undefined): Range[][] | 'always' | null {
  const value = openingHours?.trim().toLowerCase();
  if (!value) {
    return null;
  }
  if (value === '24/7') {
    return 'always';
  }

  const week: Range[][] = [[], [], [], [], [], [], []];
  let parsedAny = false;
  for (const rule of value.split(';').map((r) => r.trim())) {
    if (!rule) continue;
    const m = /^([a-z,\-\s]*?)\s*(off|closed|\d.*)$/.exec(rule);
    if (!m) {
      return null;
    }
    const days = parseDays(m[1].trim());
    if (days === 'holiday-only') continue;
    const ranges = m[2] === 'off' || m[2] === 'closed' ? [] : parseTimes(m[2]);
    if (!days || !ranges) {
      return null;
    }
    // Later rules replace earlier ones for the days they cover.
    for (const d of days) {
      week[d] = ranges;
    }
    parsedAny = true;
  }
  return parsedAny ? week : null;
}

function formatClock(minuteOfDay: number): string {
  const minutes = ((minuteOfDay % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  if (minutes === 0) return 'midnight';
  if (minutes === 12 * 60) return 'noon';
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour < 12 ? 'AM' : 'PM'}`;
}

/**
 * Describes whether a place is open and when that next changes. Uses device local time,
 * on the assumption that the user is near the places they are browsing.
 */
export function describeHours(openingHours: string | undefined, now = new Date()): HoursInfo {
  const week = parseWeek(openingHours);
  if (week === null) {
    return { status: 'unknown', label: 'Hours unknown', closingSoon: false };
  }
  if (week === 'always') {
    return { status: 'open', label: 'Open 24 hours', closingSoon: false };
  }

  // Lay yesterday through next week out on one timeline (minutes since today 00:00) and
  // merge touching spans, so "until midnight" followed by "from midnight" is one span.
  const today = now.getDay();
  const spans: Range[] = [];
  for (let offset = -1; offset <= 7; offset++) {
    for (const [start, end] of week[(today + offset + 7) % 7]) {
      spans.push([start + offset * DAY_MINUTES, end + offset * DAY_MINUTES]);
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) {
      last[1] = Math.max(last[1], span[1]);
    } else {
      merged.push([...span]);
    }
  }

  const minute = now.getHours() * 60 + now.getMinutes();
  const current = merged.find(([start, end]) => minute >= start && minute < end);
  if (current) {
    const left = current[1] - minute;
    if (left > 6 * DAY_MINUTES) {
      return { status: 'open', label: 'Open 24 hours', closingSoon: false };
    }
    if (left <= SOON_MINUTES) {
      return { status: 'open', label: `Closes in ${left} min`, closingSoon: true };
    }
    return {
      status: 'open',
      label: `Open · closes ${formatClock(current[1])}`,
      closingSoon: false,
    };
  }

  const next = merged.find(([start]) => start > minute);
  if (!next) {
    return { status: 'closed', label: 'Closed', closingSoon: false };
  }
  const wait = next[0] - minute;
  if (wait <= SOON_MINUTES) {
    return { status: 'closed', label: `Opens in ${wait} min`, closingSoon: false };
  }
  const dayOffset = Math.floor(next[0] / DAY_MINUTES);
  const day = dayOffset === 0 ? '' : `${DAY_NAMES[(today + dayOffset) % 7]} `;
  return {
    status: 'closed',
    label: `Closed · opens ${day}${formatClock(next[0])}`,
    closingSoon: false,
  };
}

export function openStatus(openingHours: string | undefined, now = new Date()): OpenStatus {
  return describeHours(openingHours, now).status;
}
