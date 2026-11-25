"use server";
import { lookupInvite, lookupRoundForMember, saveRatings } from "@/lib/ratings";
import { getViewer } from "@/lib/auth";
import type { RatingInput } from "@/lib/rules";

type Result = { ok: true } | { ok: false; errors: Record<string, string> };

export async function submitByToken(token: string, ratings: RatingInput[]): Promise<Result> {
  const inv = await lookupInvite(token);
  if (inv.state !== "ok") return { ok: false, errors: { form: "This link has expired." } };
  const res = await saveRatings(inv.round, ratings);
  return res.ok ? { ok: true } : res;
}

export async function submitByRound(roundId: string, ratings: RatingInput[]): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: { form: "Please sign in again." } };
  const round = await lookupRoundForMember(roundId, viewer.id);
  if (!round) return { ok: false, errors: { form: "This round can't be rated any more." } };
  const res = await saveRatings(round, ratings);
  return res.ok ? { ok: true } : res;
}
