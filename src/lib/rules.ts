/** The rating rules, kept in one place so they're easy to change. No database access in here. */

export const STAR_WORDS = ["", "Very slow, held everyone up", "Slow, often behind", "About right", "Kept a good pace", "Quick and ready to play"];

export const LOW_REASONS = [
  "Slow between shots",
  "Long ball searches",
  "Didn't let faster groups through",
  "Too many practice swings",
  "On the phone a lot",
];

/** 1 or 2 stars is a low rating. It needs a reason and goes to the secretary before it counts. */
export const isLow = (stars: number) => stars <= 2;

export const NOTE_MAX = 1000;

export type RatingInput = { rateeId: string; stars: number; reasons: string[]; note: string };

export type ValidationResult = { ok: true; ratings: RatingInput[] } | { ok: false; errors: Record<string, string> };

/** Checks a submitted set of ratings. Partners left unrated are skipped. */
export function validateRatings(input: unknown, partnerIds: string[]): ValidationResult {
  const errors: Record<string, string> = {};
  if (!Array.isArray(input)) return { ok: false, errors: { form: "Something went wrong. Please try again." } };
  const out: RatingInput[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const r = raw as Partial<RatingInput>;
    const id = String(r?.rateeId ?? "");
    const stars = Number(r?.stars ?? 0);
    if (!stars) continue;
    if (!partnerIds.includes(id) || seen.has(id)) {
      errors.form = "One of those players wasn't in your group.";
      continue;
    }
    seen.add(id);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      errors[id] = "Pick between 1 and 5 stars.";
      continue;
    }
    const reasons = Array.isArray(r.reasons) ? r.reasons.filter((x): x is string => LOW_REASONS.includes(String(x))) : [];
    const note = String(r.note ?? "").trim().slice(0, NOTE_MAX);
    if (isLow(stars) && reasons.length === 0 && note.length === 0) {
      errors[id] = "Please pick a reason or write a short note.";
      continue;
    }
    out.push({ rateeId: id, stars, reasons: isLow(stars) ? reasons : [], note });
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  if (out.length === 0) return { ok: false, errors: { form: "Rate at least one player, or close this page to skip." } };
  return { ok: true, ratings: out };
}

export type LowRatingRecord = { rateeId: string; createdAt: Date };

/**
 * Looks for raters who keep marking the same people down. Returns plain-English warnings for
 * the secretary, or an empty list if nothing looks odd.
 *
 * Repeated low ratings of one person are only flagged when other members disagree, meaning
 * they rate that person 3.5 stars or more on average. If everyone finds someone slow, a
 * repeat low rating is just consistent.
 */
export function patternWarnings(opts: {
  raterName: string;
  rateeId: string;
  rateeName: string;
  lowRatings: LowRatingRecord[]; // every low rating this rater has given, any status
  totalRatings: number; // every rating this rater has given
  othersOnRatee: number[]; // stars other members gave this ratee in the last 90 days
  now: Date;
}): string[] {
  const { raterName, rateeId, rateeName, lowRatings, totalRatings, othersOnRatee, now } = opts;
  const first = raterName.split(" ")[0];
  const rateeFirst = rateeName.split(" ")[0];
  const day = 86400_000;
  const out: string[] = [];
  const othersAvg = othersOnRatee.length >= 3 ? othersOnRatee.reduce((a, b) => a + b, 0) / othersOnRatee.length : null;
  const othersDisagree = othersAvg !== null && othersAvg >= 3.5;

  const last30 = lowRatings.filter((r) => now.getTime() - r.createdAt.getTime() <= 30 * day);
  const distinct = new Set(last30.map((r) => r.rateeId)).size;
  const sameRatee = lowRatings.filter((r) => r.rateeId === rateeId && now.getTime() - r.createdAt.getTime() <= 90 * day).length;

  if (othersDisagree && last30.length >= 3 && distinct <= 2) {
    out.push(`${first} has given ${last30.length} low ratings in the last 30 days, all to the same ${distinct === 1 ? "member" : "2 members"}.`);
  }
  if (othersDisagree && sameRatee >= 2) {
    out.push(`${first} has rated ${rateeName} low ${sameRatee} times in the last 90 days, but other members give ${rateeFirst} ${othersAvg!.toFixed(1)} stars on average.`);
  }
  if (totalRatings >= 6 && lowRatings.length / totalRatings > 0.5) {
    out.push(`${first} gives low ratings to most people they play with (${lowRatings.length} of ${totalRatings}).`);
  }
  return out;
}

/** Turns UK mobile numbers into the +44 format that Twilio needs. Returns null if it isn't a number. */
export function normalisePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+44" + s.slice(1);
  if (!s.startsWith("+")) s = "+" + s;
  return /^\+\d{8,15}$/.test(s) ? s : null;
}

export function normaliseEmail(input: string | null | undefined): string | null {
  const s = (input ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
