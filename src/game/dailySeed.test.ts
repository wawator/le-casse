import { describe, expect, it } from "vitest";
import {
  CHALLENGE_EPOCH,
  generateSecretForChallenge,
  getChallengeNumber,
  parisDateString,
} from "./dailySeed";
import { CODE_LENGTH, PEG_COLORS } from "./types";

describe("getChallengeNumber", () => {
  it("renvoie #1 le jour de l'epoch (heure de Paris, midi pour éviter tout basculement de jour UTC)", () => {
    const epochNoon = new Date(`${CHALLENGE_EPOCH}T12:00:00+02:00`);
    expect(getChallengeNumber(epochNoon)).toBe(1);
  });

  it("incrémente d'un jour calendaire à Paris", () => {
    const dayAfter = new Date(`2026-09-02T12:00:00+02:00`);
    expect(getChallengeNumber(dayAfter)).toBe(2);
    const tenDaysAfter = new Date(`2026-09-11T12:00:00+02:00`);
    expect(getChallengeNumber(tenDaysAfter)).toBe(11);
  });

  it("s'appuie sur la date calendaire de Paris, pas sur UTC", () => {
    // 23:30 UTC le 2026-09-01 = 01:30 le 2026-09-02 à Paris (CEST, UTC+2).
    const lateUtc = new Date("2026-09-01T23:30:00Z");
    expect(parisDateString(lateUtc)).toBe("2026-09-02");
    expect(getChallengeNumber(lateUtc)).toBe(2);
  });
});

describe("generateSecretForChallenge", () => {
  it("est déterministe : même défi -> même code, toujours", () => {
    const a = generateSecretForChallenge(42);
    const b = generateSecretForChallenge(42);
    expect(a).toEqual(b);
  });

  it("produit un code de la bonne longueur avec des couleurs valides", () => {
    const secret = generateSecretForChallenge(7);
    expect(secret).toHaveLength(CODE_LENGTH);
    secret.forEach((color) => expect(PEG_COLORS).toContain(color));
  });

  it("varie selon le numéro de défi", () => {
    const secrets = new Set(
      Array.from({ length: 20 }, (_, i) => generateSecretForChallenge(i + 1).join("-")),
    );
    // Sur 20 tirages indépendants de 6^4 possibilités, on attend une large diversité.
    expect(secrets.size).toBeGreaterThan(10);
  });
});
