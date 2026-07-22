import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Attempt, GameStatus, PegColor } from "../game/types";
import { ensureAnonymousSession } from "./auth";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

export type DuelStatus = "en-attente" | "en-cours" | "terminee";

export interface DuelRow {
  id: string;
  status: DuelStatus;
  player_a: string;
  player_b: string | null;
  winner: string | null;
  created_at: string;
}

export interface SubmitGuessResult {
  wellPlaced: number;
  misplaced: number;
  attemptNumber: number;
  duelStatus: DuelStatus;
  winner: string | null;
}

export interface OpponentProgress {
  attempts: number;
  solved: boolean;
}

/** Le duel n'a pas de mode dégradé : il exige un backend réel et une session. */
async function requireSession(): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Le mode duel nécessite une connexion — vérifie ta configuration Supabase.");
  }
  const userId = await ensureAnonymousSession();
  if (!userId) {
    throw new Error("Impossible de démarrer une session. Vérifie ta connexion et réessaie.");
  }
  return userId;
}

export async function getMyUserId(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  return ensureAnonymousSession();
}

export async function createDuel(): Promise<string> {
  await requireSession();
  const { data, error } = await supabase!.rpc("create_duel");
  if (error) throw error;
  return data as string;
}

export async function joinDuel(duelId: string): Promise<void> {
  await requireSession();
  const { error } = await supabase!.rpc("join_duel", { p_duel_id: duelId });
  if (error) throw error;
}

export async function submitDuelGuess(duelId: string, guess: PegColor[]): Promise<SubmitGuessResult> {
  await requireSession();
  const { data, error } = await supabase!.rpc("submit_duel_guess", {
    p_duel_id: duelId,
    p_guess: guess,
  });
  if (error) throw error;
  return {
    wellPlaced: data.wellPlaced,
    misplaced: data.misplaced,
    attemptNumber: data.attemptNumber,
    duelStatus: data.duelStatus,
    winner: data.winner,
  };
}

export async function getDuel(duelId: string): Promise<DuelRow> {
  await requireSession();
  const { data, error } = await supabase!
    .from("duels")
    .select("id, status, player_a, player_b, winner, created_at")
    .eq("id", duelId)
    .single();
  if (error) throw error;
  return data as DuelRow;
}

export interface OngoingDuel {
  id: string;
  createdAt: string;
}

/**
 * Duels en cours où je participe — pour proposer une reprise depuis l'accueil.
 * Tolérant : ne jette jamais (utilisé pour un affichage optionnel, pas une action).
 */
export async function getMyOngoingDuels(): Promise<OngoingDuel[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const userId = await ensureAnonymousSession();
    if (!userId) return [];

    const { data, error } = await supabase
      .from("duels")
      .select("id, created_at")
      .eq("status", "en-cours")
      .or(`player_a.eq.${userId},player_b.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => ({ id: row.id as string, createdAt: row.created_at as string }));
  } catch (error) {
    console.warn("[le-casse] impossible de récupérer les duels en cours :", error);
    return [];
  }
}

/** Reconstruit l'historique de mes essais dans le format du jeu solo (pour réutiliser GameScreen tel quel). */
export async function getMyAttempts(duelId: string): Promise<Attempt[]> {
  const userId = await requireSession();
  const { data, error } = await supabase!
    .from("duel_guesses")
    .select("guess, well_placed, misplaced")
    .eq("duel_id", duelId)
    .eq("player_id", userId)
    .order("attempt_number", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    guess: row.guess as PegColor[],
    feedback: { wellPlaced: row.well_placed as number, misplaced: row.misplaced as number },
  }));
}

export async function getOpponentProgress(duelId: string, opponentId: string): Promise<OpponentProgress> {
  await requireSession();
  const { data, error } = await supabase!
    .from("duel_progress_events")
    .select("attempt_number, solved")
    .eq("duel_id", duelId)
    .eq("player_id", opponentId)
    .order("attempt_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  const last = data?.[0];
  return { attempts: last?.attempt_number ?? 0, solved: last?.solved ?? false };
}

export function deriveGameStatus(duelStatus: DuelStatus, iWon: boolean): GameStatus {
  if (duelStatus !== "terminee") return "en-cours";
  return iWon ? "gagnee" : "perdue";
}

interface DuelProgressHandler {
  onProgress: (event: { playerId: string; attemptNumber: number; solved: boolean }) => void;
}

/**
 * N'écoute QUE duel_progress_events (jamais la table duels : sa colonne
 * "code" échapperait au GRANT/REVOKE via la réplication logique du realtime).
 * Pour connaître le statut/gagnant authoritatif, refaire un getDuel() après
 * un événement de progression pertinent — cet appel REST respecte, lui, les
 * colonnes autorisées.
 */
export function subscribeToDuel(duelId: string, handlers: DuelProgressHandler): () => void {
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase
    .channel(`duel-${duelId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "duel_progress_events", filter: `duel_id=eq.${duelId}` },
      (payload) => {
        const row = payload.new as { player_id: string; attempt_number: number; solved: boolean };
        handlers.onProgress({ playerId: row.player_id, attemptNumber: row.attempt_number, solved: row.solved });
      },
    )
    .subscribe();

  return () => {
    supabase!.removeChannel(channel);
  };
}
