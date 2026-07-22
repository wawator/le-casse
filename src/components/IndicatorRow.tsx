import type { Feedback } from "../game/types";
import { CODE_LENGTH } from "../game/types";
import styles from "./IndicatorRow.module.css";

interface IndicatorRowProps {
  feedback?: Feedback;
}

export function IndicatorRow({ feedback }: IndicatorRowProps) {
  const wellPlaced = feedback?.wellPlaced ?? 0;
  const misplaced = feedback?.misplaced ?? 0;
  const empty = CODE_LENGTH - wellPlaced - misplaced;

  const dots = [
    ...Array.from({ length: wellPlaced }, () => "well" as const),
    ...Array.from({ length: misplaced }, () => "misplaced" as const),
    ...Array.from({ length: empty }, () => "empty" as const),
  ];

  const label = feedback
    ? `${wellPlaced} bien placé${wellPlaced > 1 ? "s" : ""}, ${misplaced} mal placé${misplaced > 1 ? "s" : ""}`
    : "Pas encore évalué";

  return (
    <div className={styles.grid} role="img" aria-label={label}>
      {dots.map((kind, i) => (
        <span
          key={i}
          className={[styles.dot, kind !== "empty" ? styles[`dot--${kind}`] : ""].join(" ")}
        />
      ))}
    </div>
  );
}
