import { CODE_LENGTH } from "../game/types";
import type { Feedback, Guess } from "../game/types";
import { IndicatorRow } from "./IndicatorRow";
import { Peg } from "./Peg";
import styles from "./GuessRow.module.css";

interface GuessRowProps {
  attemptNumber: number;
  guess: Guess;
  feedback?: Feedback;
  status: "past" | "current" | "upcoming";
  colorblind: boolean;
  shake?: boolean;
  staggerIndex?: number;
}

export function GuessRow({
  attemptNumber,
  guess,
  feedback,
  status,
  colorblind,
  shake = false,
  staggerIndex = 0,
}: GuessRowProps) {
  const slots = Array.from({ length: CODE_LENGTH }, (_, i) => guess[i] ?? null);

  const className = [
    styles.row,
    status === "current" ? styles["row--current"] : "",
    status === "upcoming" ? styles["row--upcoming"] : "",
    shake ? styles["row--shake"] : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      style={{ animationDelay: `calc(var(--stagger-step) * ${staggerIndex})` }}
    >
      <span className={styles.index} aria-hidden="true">
        {String(attemptNumber).padStart(2, "0")}
      </span>
      <div className={styles.slots}>
        {slots.map((color, i) => (
          <Peg key={i} color={color} colorblind={colorblind} />
        ))}
      </div>
      <IndicatorRow feedback={feedback} />
    </div>
  );
}
