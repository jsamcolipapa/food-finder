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

/**
 * Evaluates the common subset of the OSM `opening_hours` syntax (weekday ranges with
 * time spans, `off`, `24/7`). Anything it cannot fully understand — months, sunrise,
 * comments, fallbacks — returns `unknown` rather than a guess. Uses device local time.
 */
export function openStatus(openingHours: string | undefined, now = new Date()): OpenStatus {
  const value = openingHours?.trim().toLowerCase();
  if (!value) {
    return 'unknown';
  }
  if (value === '24/7') {
    return 'open';
  }

  const week: Range[][] = [[], [], [], [], [], [], []];
  let parsedAny = false;
  for (const rule of value.split(';').map((r) => r.trim())) {
    if (!rule) continue;
    const m = /^([a-z,\-\s]*?)\s*(off|closed|\d.*)$/.exec(rule);
    if (!m) {
      return 'unknown';
    }
    const days = parseDays(m[1].trim());
    if (days === 'holiday-only') continue;
    const ranges = m[2] === 'off' || m[2] === 'closed' ? [] : parseTimes(m[2]);
    if (!days || !ranges) {
      return 'unknown';
    }
    // Later rules replace earlier ones for the days they cover.
    for (const d of days) {
      week[d] = ranges;
    }
    parsedAny = true;
  }
  if (!parsedAny) {
    return 'unknown';
  }

  const day = now.getDay();
  const minute = now.getHours() * 60 + now.getMinutes();
  const today = week[day].some(([s, e]) => minute >= s && minute < e);
  const spillover = week[(day + 6) % 7].some(([, e]) => minute < e - DAY_MINUTES);
  return today || spillover ? 'open' : 'closed';
}
