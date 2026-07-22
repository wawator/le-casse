import type { Feedback, Guess, SecretCode } from "./types";

/**
 * Évaluation classique Mastermind : bien placés d'abord, puis mal placés,
 * sans double comptage d'un même pion (secret ou proposition).
 */
export function evaluateGuess(secret: SecretCode, guess: Guess): Feedback {
  const secretRemaining: (string | null)[] = [...secret];
  const guessRemaining: (string | null)[] = [...guess];

  let wellPlaced = 0;
  for (let i = 0; i < secretRemaining.length; i++) {
    if (guessRemaining[i] === secretRemaining[i]) {
      wellPlaced++;
      secretRemaining[i] = null;
      guessRemaining[i] = null;
    }
  }

  let misplaced = 0;
  for (let i = 0; i < guessRemaining.length; i++) {
    const color = guessRemaining[i];
    if (color === null) continue;
    const matchIndex = secretRemaining.indexOf(color);
    if (matchIndex !== -1) {
      misplaced++;
      secretRemaining[matchIndex] = null;
    }
  }

  return { wellPlaced, misplaced };
}

export function isWinningFeedback(feedback: Feedback, codeLength: number): boolean {
  return feedback.wellPlaced === codeLength;
}
