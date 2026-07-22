import { CODE_LENGTH } from "./types";
import type { Attempt, GameStatus } from "./types";

function feedbackToDots(attempt: Attempt): string {
  const { wellPlaced, misplaced } = attempt.feedback;
  const empty = CODE_LENGTH - wellPlaced - misplaced;
  return "⚫".repeat(wellPlaced) + "⚪".repeat(misplaced) + "⬜".repeat(empty);
}

/** Texte partageable, façon Wordle : aucune couleur du code secret n'y figure. */
export function buildShareText(
  challengeNumber: number,
  attempts: Attempt[],
  status: GameStatus,
): string {
  const scoreLabel = status === "gagnee" ? `${attempts.length}/10` : "X/10";
  const header = `LE CASSE #${challengeNumber} · ${scoreLabel}`;
  const rows = attempts.map(feedbackToDots);
  return [header, ...rows].join("\n");
}
