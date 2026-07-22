import { describe, expect, it } from "vitest";
import { buildShareText } from "./share";
import type { Attempt } from "./types";

const attempts: Attempt[] = [
  { guess: ["rouge", "vert", "bleu", "jaune"], feedback: { wellPlaced: 1, misplaced: 2 } },
  { guess: ["rouge", "vert", "bleu", "orange"], feedback: { wellPlaced: 4, misplaced: 0 } },
];

describe("buildShareText", () => {
  it("affiche le score et une ligne de points par tentative sur une victoire", () => {
    expect(buildShareText(42, attempts, "gagnee")).toBe(
      ["LE CASSE #42 · 2/10", "⚫⚪⚪⬜", "⚫⚫⚫⚫"].join("\n"),
    );
  });

  it("affiche X/10 sur une défaite, sans révéler le code secret", () => {
    const text = buildShareText(42, attempts, "perdue");
    expect(text.startsWith("LE CASSE #42 · X/10")).toBe(true);
    expect(text).not.toMatch(/rouge|vert|bleu|jaune|orange|violet/);
  });
});
