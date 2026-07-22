import { CODE_LENGTH, PEG_COLORS, type PegColor, type SecretCode } from "./types";

/** Le défi #1 tombe le 2026-09-01. */
export const CHALLENGE_EPOCH = "2026-09-01";
const PARIS_TIME_ZONE = "Europe/Paris";
const MS_PER_DAY = 86_400_000;

/** Renvoie la date calendaire (YYYY-MM-DD) telle que vécue à Paris. */
export function parisDateString(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function daysBetweenDateStrings(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/** Numéro du défi du jour : #1 le jour de CHALLENGE_EPOCH, +1 par jour ensuite. */
export function getChallengeNumber(now: Date = new Date()): number {
  const today = parisDateString(now);
  return daysBetweenDateStrings(CHALLENGE_EPOCH, today) + 1;
}

/** xmur3 : dérive une graine 32 bits stable à partir d'une chaîne. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 : PRNG déterministe rapide, suffisant pour un tirage de couleurs. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seedInput: string): () => number {
  const seedFn = xmur3(seedInput);
  return mulberry32(seedFn());
}

/** Génère le code secret déterministe du défi n, identique pour tout le monde. */
export function generateSecretForChallenge(challengeNumber: number): SecretCode {
  const rng = createRng(`le-casse-defi-${challengeNumber}`);
  const colors: PegColor[] = [];
  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = Math.floor(rng() * PEG_COLORS.length);
    colors.push(PEG_COLORS[index]);
  }
  return colors as unknown as SecretCode;
}

/** Génère un code secret aléatoire (non déterministe) pour le mode entraînement. */
export function generateRandomSecret(): SecretCode {
  const colors: PegColor[] = [];
  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = Math.floor(Math.random() * PEG_COLORS.length);
    colors.push(PEG_COLORS[index]);
  }
  return colors as unknown as SecretCode;
}
