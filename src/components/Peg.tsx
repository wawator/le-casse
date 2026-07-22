import type { PegColor } from "../game/types";
import { PEG_COLOR_LABEL, PEG_COLOR_LETTER, PEG_COLOR_VAR } from "./pegVisuals";
import styles from "./Peg.module.css";

interface PegProps {
  color: PegColor | null;
  size?: "sm" | "md" | "lg";
  colorblind?: boolean;
  interactive?: boolean;
  selected?: boolean;
  onClick?: () => void;
  label?: string;
}

export function Peg({
  color,
  size = "md",
  colorblind = false,
  interactive = false,
  selected = false,
  onClick,
  label,
}: PegProps) {
  const sizeClass = size === "sm" ? styles["peg--sm"] : size === "lg" ? styles["peg--lg"] : "";
  const className = [
    styles.peg,
    sizeClass,
    color === null ? styles["peg--empty"] : "",
    interactive ? styles["peg--interactive"] : "",
    selected ? styles["peg--selected"] : "",
  ]
    .filter(Boolean)
    .join(" ");

  const style = color ? { background: PEG_COLOR_VAR[color] } : undefined;
  const accessibleLabel = label ?? (color ? PEG_COLOR_LABEL[color] : "Emplacement vide");

  const content = colorblind && color ? <span className={styles.letter}>{PEG_COLOR_LETTER[color]}</span> : null;

  if (interactive) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        onClick={onClick}
        aria-label={accessibleLabel}
        aria-pressed={selected}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} style={style} role="img" aria-label={accessibleLabel}>
      {content}
    </div>
  );
}
