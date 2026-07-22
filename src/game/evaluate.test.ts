import { describe, expect, it } from "vitest";
import { evaluateGuess } from "./evaluate";
import { submitGuess, createGame } from "./game";
import type { SecretCode } from "./types";

describe("evaluateGuess", () => {
  it("compte 4 bien placés quand la proposition est identique au secret", () => {
    const secret: SecretCode = ["rouge", "vert", "bleu", "jaune"];
    expect(evaluateGuess(secret, ["rouge", "vert", "bleu", "jaune"])).toEqual({
      wellPlaced: 4,
      misplaced: 0,
    });
  });

  it("ne compte rien quand aucune couleur ne correspond", () => {
    const secret: SecretCode = ["rouge", "rouge", "rouge", "rouge"];
    expect(evaluateGuess(secret, ["vert", "vert", "vert", "vert"])).toEqual({
      wellPlaced: 0,
      misplaced: 0,
    });
  });

  it("détecte les pions mal placés sans double comptage", () => {
    const secret: SecretCode = ["rouge", "vert", "bleu", "jaune"];
    // "vert" et "rouge" présents mais décalés ; "orange" absent ; "jaune" bien placé.
    expect(evaluateGuess(secret, ["vert", "rouge", "orange", "jaune"])).toEqual({
      wellPlaced: 1,
      misplaced: 2,
    });
  });

  it("ne double-compte pas un secret avec doublons face à une proposition avec doublons", () => {
    const secret: SecretCode = ["rouge", "rouge", "vert", "bleu"];
    // Le secret ne contient que deux "rouge" : la proposition en propose trois,
    // un seul excédentaire doit rester non compté.
    expect(evaluateGuess(secret, ["rouge", "rouge", "rouge", "vert"])).toEqual({
      wellPlaced: 2,
      misplaced: 1,
    });
  });

  it("ne double-compte pas une proposition avec doublons face à un secret avec un seul exemplaire", () => {
    const secret: SecretCode = ["rouge", "vert", "bleu", "jaune"];
    expect(evaluateGuess(secret, ["rouge", "rouge", "rouge", "rouge"])).toEqual({
      wellPlaced: 1,
      misplaced: 0,
    });
  });

  it("gère le cas 0 bien placé / 0 mal placé (toutes couleurs absentes)", () => {
    const secret: SecretCode = ["rouge", "vert", "bleu", "jaune"];
    expect(evaluateGuess(secret, ["orange", "orange", "violet", "violet"])).toEqual({
      wellPlaced: 0,
      misplaced: 0,
    });
  });
});

describe("submitGuess / createGame", () => {
  const secret: SecretCode = ["rouge", "vert", "bleu", "jaune"];

  it("passe le statut à gagnee sur un coup parfait", () => {
    const game = createGame(secret);
    const next = submitGuess(game, ["rouge", "vert", "bleu", "jaune"]);
    expect(next.status).toBe("gagnee");
    expect(next.attempts).toHaveLength(1);
  });

  it("passe le statut à perdue après 10 essais infructueux", () => {
    let game = createGame(secret);
    for (let i = 0; i < 10; i++) {
      game = submitGuess(game, ["orange", "orange", "violet", "violet"]);
    }
    expect(game.status).toBe("perdue");
    expect(game.attempts).toHaveLength(10);
  });

  it("reste en-cours tant que le nombre max d'essais n'est pas atteint", () => {
    let game = createGame(secret);
    game = submitGuess(game, ["orange", "orange", "violet", "violet"]);
    expect(game.status).toBe("en-cours");
  });

  it("n'accepte plus de coup une fois la partie terminée", () => {
    let game = createGame(secret);
    game = submitGuess(game, ["rouge", "vert", "bleu", "jaune"]);
    const after = submitGuess(game, ["orange", "orange", "violet", "violet"]);
    expect(after).toBe(game);
  });

  it("ne mute jamais l'état reçu (transition pure)", () => {
    const game = createGame(secret);
    const snapshotAttempts = game.attempts;
    submitGuess(game, ["rouge", "vert", "bleu", "jaune"]);
    expect(game.attempts).toBe(snapshotAttempts);
    expect(game.attempts).toHaveLength(0);
  });
});
