export const PEG_COLORS = ["rouge", "orange", "jaune", "vert", "bleu", "violet"] as const;

export type PegColor = (typeof PEG_COLORS)[number];

export const CODE_LENGTH = 4;
export const MAX_TRIES = 10;

export type SecretCode = readonly [PegColor, PegColor, PegColor, PegColor];

export type Guess = readonly PegColor[];

export interface Feedback {
  /** Pions bien placés (couleur + position correctes). */
  wellPlaced: number;
  /** Pions de la bonne couleur mais mal placés. */
  misplaced: number;
}

export interface Attempt {
  guess: Guess;
  feedback: Feedback;
}

export type GameStatus = "en-cours" | "gagnee" | "perdue";

export interface GameState {
  secret: SecretCode;
  attempts: Attempt[];
  status: GameStatus;
}
