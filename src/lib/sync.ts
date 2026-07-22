import { ensureAnonymousSession } from "./auth";
import type { DailyProgress } from "./storage";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

/** Envoie le résultat du défi du jour à Supabase si connecté ; no-op sinon. */
export async function pushDailyResult(progress: DailyProgress): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    const userId = await ensureAnonymousSession();
    if (!userId) return;

    await supabase.from("daily_results").upsert(
      {
        user_id: userId,
        challenge_number: progress.challengeNumber,
        tries: progress.attempts.length,
        won: progress.status === "gagnee",
        grid: progress.attempts,
      },
      { onConflict: "user_id,challenge_number", ignoreDuplicates: true },
    );
  } catch (error) {
    console.warn("[le-casse] synchronisation Supabase impossible (mode hors-ligne conservé) :", error);
  }
}
