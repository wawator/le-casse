import { supabase } from "./supabaseClient";

let anonymousSessionReady: Promise<string | null> | null = null;

/** Best-effort : ne bloque jamais le jeu si Supabase est absent ou injoignable. */
export async function ensureAnonymousSession(): Promise<string | null> {
  if (!supabase) return null;
  if (!anonymousSessionReady) {
    anonymousSessionReady = (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) return data.session.user.id;
        const { data: signedIn, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        return signedIn.user?.id ?? null;
      } catch (error) {
        console.warn("[le-casse] session anonyme Supabase indisponible :", error);
        anonymousSessionReady = null;
        return null;
      }
    })();
  }
  return anonymousSessionReady;
}
