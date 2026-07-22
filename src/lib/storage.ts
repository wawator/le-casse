import type { Attempt, GameStatus } from "../game/types";

const PREFIX = "lecasse";

export interface Settings {
  colorblindMode: boolean;
  reducedMotion: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  colorblindMode: false,
  reducedMotion: false,
};

export interface DailyProgress {
  challengeNumber: number;
  attempts: Attempt[];
  status: GameStatus;
  statsRecorded: boolean;
}

export interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  /** Index 0 = victoire au 1er essai ... index 9 = victoire au 10e essai. */
  triesDistribution: number[];
  currentStreak: number;
  bestStreak: number;
  lastWonChallenge: number | null;
}

const DEFAULT_STATS: Stats = {
  gamesPlayed: 0,
  gamesWon: 0,
  triesDistribution: new Array(10).fill(0),
  currentStreak: 0,
  bestStreak: 0,
  lastWonChallenge: null,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${PREFIX}:${key}`);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    // Stockage indisponible (navigation privée, quota) : on continue en mémoire pour la session.
  }
}

export function getSettings(): Settings {
  return readJson("settings", DEFAULT_SETTINGS);
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  writeJson("settings", next);
  return next;
}

export function getDailyProgress(challengeNumber: number): DailyProgress | null {
  const stored = readJson<DailyProgress | null>(`daily:${challengeNumber}`, null);
  if (!stored || stored.challengeNumber !== challengeNumber) return null;
  return stored;
}

export function saveDailyProgress(progress: DailyProgress): void {
  writeJson(`daily:${progress.challengeNumber}`, progress);
}

export function getStats(): Stats {
  return readJson("stats", DEFAULT_STATS);
}

/** Met à jour les stats une seule fois par défi terminé (protégé par statsRecorded). */
export function recordDailyResult(progress: DailyProgress): Stats {
  const stats = getStats();
  const tries = progress.attempts.length;
  const won = progress.status === "gagnee";

  const next: Stats = {
    ...stats,
    gamesPlayed: stats.gamesPlayed + 1,
    gamesWon: stats.gamesWon + (won ? 1 : 0),
    triesDistribution: stats.triesDistribution.map((count, index) =>
      won && index === tries - 1 ? count + 1 : count,
    ),
  };

  if (won) {
    const isConsecutive = stats.lastWonChallenge === progress.challengeNumber - 1;
    next.currentStreak = isConsecutive ? stats.currentStreak + 1 : 1;
    next.bestStreak = Math.max(stats.bestStreak, next.currentStreak);
    next.lastWonChallenge = progress.challengeNumber;
  } else {
    next.currentStreak = 0;
  }

  writeJson("stats", next);
  return next;
}
