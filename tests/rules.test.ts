import { describe, expect, it } from "vitest";
import { normalisePhone, patternWarnings, validateRatings } from "@/lib/rules";
import { inviteTime, parseLocalDateTime, zonedToUtc } from "@/lib/time";
import { parseCsv } from "@/lib/csv";
import { teeTimesFromCsv } from "@/lib/importer";

describe("validateRatings", () => {
  const partners = ["a", "b", "c"];
  it("needs a reason for 1 or 2 stars", () => {
    const r = validateRatings([{ rateeId: "a", stars: 2, reasons: [], note: "" }], partners);
    expect(r.ok).toBe(false);
  });
  it("accepts a low rating with a reason, and skips unrated players", () => {
    const r = validateRatings([{ rateeId: "a", stars: 1, reasons: ["Long ball searches"], note: "" }, { rateeId: "b", stars: 0, reasons: [], note: "" }], partners);
    expect(r.ok && r.ratings.length).toBe(1);
  });
  it("lets high ratings go without a note", () => {
    expect(validateRatings([{ rateeId: "c", stars: 5, reasons: [], note: "" }], partners).ok).toBe(true);
  });
  it("rejects players who weren't in the group and made-up reasons", () => {
    expect(validateRatings([{ rateeId: "zzz", stars: 4, reasons: [], note: "" }], partners).ok).toBe(false);
    expect(validateRatings([{ rateeId: "a", stars: 1, reasons: ["hacked"], note: "" }], partners).ok).toBe(false);
  });
  it("rejects an empty submission and bad star counts", () => {
    expect(validateRatings([], partners).ok).toBe(false);
    expect(validateRatings([{ rateeId: "a", stars: 9, reasons: [], note: "" }], partners).ok).toBe(false);
  });
});

describe("patternWarnings", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  const d = (days: number) => new Date(now.getTime() - days * 86400_000);
  it("flags someone who keeps rating the same two members down", () => {
    const w = patternWarnings({ raterName: "Colin Fairweather", rateeId: "s", rateeName: "Stuart Bell", now, totalRatings: 20, othersOnRatee: [4, 4, 5, 3],
      lowRatings: [{ rateeId: "s", createdAt: d(2) }, { rateeId: "g", createdAt: d(5) }, { rateeId: "s", createdAt: d(9) }, { rateeId: "g", createdAt: d(20) }] });
    expect(w[0]).toBe("Colin has given 4 low ratings in the last 30 days, all to the same 2 members.");
    expect(w[1]).toBe("Colin has rated Stuart Bell low 2 times in the last 90 days, but other members give Stuart 4.0 stars on average.");
  });
  it("doesn't flag repeat low ratings when everyone finds that player slow", () => {
    expect(patternWarnings({ raterName: "Tom H", rateeId: "m", rateeName: "Mark W", now, totalRatings: 30, othersOnRatee: [2, 1, 2, 3],
      lowRatings: [{ rateeId: "m", createdAt: d(1) }, { rateeId: "m", createdAt: d(10) }, { rateeId: "m", createdAt: d(20) }] })).toEqual([]);
  });
  it("stays quiet for a one-off", () => {
    expect(patternWarnings({ raterName: "Tom H", rateeId: "m", rateeName: "Mark", now, totalRatings: 30, othersOnRatee: [5, 4, 4], lowRatings: [{ rateeId: "m", createdAt: d(1) }] })).toEqual([]);
  });
});

describe("times", () => {
  it("reads London tee times in summer and winter", () => {
    expect(parseLocalDateTime("2026-07-04 09:40", "Europe/London")!.toISOString()).toBe("2026-07-04T08:40:00.000Z");
    expect(parseLocalDateTime("22/11/2026 09:40", "Europe/London")!.toISOString()).toBe("2026-11-22T09:40:00.000Z");
  });
  it("sends 5 hours after the tee time", () => {
    const tee = zonedToUtc(2026, 11, 22, 9, 40, "Europe/London");
    expect(inviteTime(tee, 5, "Europe/London").toISOString()).toBe("2026-11-22T14:40:00.000Z");
  });
  it("holds late messages until 9am next day", () => {
    const tee = zonedToUtc(2026, 11, 22, 16, 30, "Europe/London");
    expect(inviteTime(tee, 5, "Europe/London").toISOString()).toBe("2026-11-23T09:00:00.000Z");
  });
});

describe("imports", () => {
  it("reads quoted CSV and groups players by booking", () => {
    const rows = parseCsv('﻿Booking Ref,Date,Time,Course,Member ID\r\nB1,2026-11-22,09:40,"Old Course, Main",1001\r\nB1,2026-11-22,09:40,"Old Course, Main",1002\r\n');
    const b = teeTimesFromCsv(rows);
    expect(b).toEqual([{ externalId: "B1", teeTime: "2026-11-22 09:40", course: "Old Course, Main", memberIds: ["1001", "1002"] }]);
  });
  it("turns UK mobiles into +44", () => {
    expect(normalisePhone("07700 900123")).toBe("+447700900123");
    expect(normalisePhone("hello")).toBeNull();
  });
});
