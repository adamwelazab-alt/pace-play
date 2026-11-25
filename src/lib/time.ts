/** Time-zone helpers. Clubs store tee times in their local time (Europe/London by default). */

function partsIn(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const { type, value } of f.formatToParts(date)) if (type !== "literal") p[type] = Number(value);
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Converts a wall-clock time at the club, such as 22 Nov 09:40 in London, to a real instant. */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let t = guess - offsetMs(new Date(guess), timeZone);
  t = guess - offsetMs(new Date(t), timeZone);
  return new Date(t);
}

/** The local calendar parts of an instant at the club. */
export function localParts(date: Date, timeZone: string) {
  return partsIn(date, timeZone);
}

/** Parses "2026-11-22 09:40", "2026-11-22T09:40", "22/11/2026 09:40" or an ISO time with a zone. */
export function parseLocalDateTime(input: string, timeZone: string): Date | null {
  const s = input.trim();
  if (/[zZ]$|[+-]\d\d:?\d\d$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (m) return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], timeZone);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T,]+(\d{1,2}):(\d{2})/);
  if (m) return zonedToUtc(+m[3], +m[2], +m[1], +m[4], +m[5], timeZone);
  return null;
}

/** Messages aren't sent late at night. Anything due between 21:00 and 08:00 waits until 09:00. */
export function inviteTime(teeTime: Date, delayHours: number, timeZone: string): Date {
  const due = new Date(teeTime.getTime() + delayHours * 3600_000);
  const p = partsIn(due, timeZone);
  if (p.hour >= 21) {
    const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
    return zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 9, 0, timeZone);
  }
  if (p.hour < 8) return zonedToUtc(p.year, p.month, p.day, 9, 0, timeZone);
  return due;
}

/** First instant of a month at the club. month is 1-12 and may overflow either way. */
export function monthStart(year: number, month: number, timeZone: string): Date {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, timeZone);
}

export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(date).replace(/,/g, "").replace(/ (\d\d:\d\d)$/, ", $1");
}

export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

export function formatDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(date).replace(/,/g, "");
}

/** The month that the next release covers, and when it happens. */
export function nextRelease(now: Date, timeZone: string) {
  const p = partsIn(now, timeZone);
  const at = monthStart(p.year, p.month + 1, timeZone);
  return { periodLabel: MONTHS[p.month - 1], at, atLabel: `1 ${MONTHS[p.month % 12]}`, daysLeft: Math.max(0, Math.ceil((at.getTime() - now.getTime()) / 86400_000)) };
}
