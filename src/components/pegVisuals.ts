import type { PegColor } from "../game/types";

export const PEG_COLOR_VAR: Record<PegColor, string> = {
  rouge: "var(--peg-rouge)",
  orange: "var(--peg-orange)",
  jaune: "var(--peg-jaune)",
  vert: "var(--peg-vert)",
  bleu: "var(--peg-bleu)",
  violet: "var(--peg-violet)",
};

/** Lettres distinctes pour l'option daltonisme (un seul indice par couleur). */
export const PEG_COLOR_LETTER: Record<PegColor, string> = {
  rouge: "R",
  orange: "O",
  jaune: "J",
  vert: "V",
  bleu: "B",
  violet: "P",
};

export const PEG_COLOR_LABEL: Record<PegColor, string> = {
  rouge: "Rouge",
  orange: "Orange",
  jaune: "Jaune",
  vert: "Vert",
  bleu: "Bleu",
  violet: "Violet",
};
