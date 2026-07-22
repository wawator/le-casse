import { evaluateGuess, isWinningFeedback } from "./evaluate";
import { CODE_LENGTH, MAX_TRIES, type GameState, type Guess, type SecretCode } from "./types";

export function createGame(secret: SecretCode): GameState {
  return { secret, attempts: [], status: "en-cours" };
}

/** Transition pure : renvoie un nouvel état, ne mute jamais l'état reçu. */
export function submitGuess(state: GameState, guess: Guess): GameState {
  if (state.status !== "en-cours") return state;
  if (guess.length !== CODE_LENGTH) {
    throw new Error(`La tentative doit contenir ${CODE_LENGTH} pions.`);
  }

  const feedback = evaluateGuess(state.secret, guess);
  const attempts = [...state.attempts, { guess, feedback }];
  const won = isWinningFeedback(feedback, CODE_LENGTH);
  const status = won ? "gagnee" : attempts.length >= MAX_TRIES ? "perdue" : "en-cours";

  return { ...state, attempts, status };
}
