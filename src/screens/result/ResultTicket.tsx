import { CODE_LENGTH } from "../../game/types";
import type { Attempt, GameStatus } from "../../game/types";
import styles from "./ResultTicket.module.css";

interface ResultTicketProps {
  challengeNumber?: number;
  attempts: Attempt[];
  status: GameStatus;
}

export function ResultTicket({ challengeNumber, attempts, status }: ResultTicketProps) {
  const scoreLabel = status === "gagnee" ? `${attempts.length}/10` : "X/10";

  return (
    <div className={styles.ticket}>
      <div className={styles.heading}>
        <span className={styles.headingLabel}>
          {challengeNumber !== undefined ? `LE CASSE #${challengeNumber}` : "LE CASSE · Entraînement"}
        </span>
        <span className={styles.headingScore}>{scoreLabel}</span>
      </div>

      <div className={styles.rows}>
        {attempts.map((attempt, rowIndex) => {
          const { wellPlaced, misplaced } = attempt.feedback;
          const empty = CODE_LENGTH - wellPlaced - misplaced;
          const dots = [
            ...Array.from({ length: wellPlaced }, () => "well" as const),
            ...Array.from({ length: misplaced }, () => "misplaced" as const),
            ...Array.from({ length: empty }, () => "empty" as const),
          ];
          return (
            <div
              key={rowIndex}
              className={styles.row}
              style={{ animationDelay: `calc(var(--stagger-step) * ${rowIndex})` }}
            >
              {dots.map((kind, i) => (
                <span key={i} className={[styles.dot, kind !== "empty" ? styles[`dot--${kind}`] : ""].join(" ")} />
              ))}
            </div>
          );
        })}
      </div>

      <span className={[styles.stamp, status === "perdue" ? styles["stamp--lost"] : ""].join(" ")}>
        {status === "gagnee" ? "PERCÉ" : "ÉCHEC"}
      </span>
    </div>
  );
}
