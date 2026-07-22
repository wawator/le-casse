import { useEffect, useRef } from "react";
import { MAX_TRIES } from "../game/types";
import type { Attempt, Guess } from "../game/types";
import { GuessRow } from "./GuessRow";
import styles from "./Board.module.css";

interface BoardProps {
  attempts: Attempt[];
  currentGuess: Guess;
  isGameOver: boolean;
  colorblind: boolean;
  shakeCurrentRow: boolean;
  shakeAttemptIndex?: number | null;
}

export function Board({
  attempts,
  currentGuess,
  isGameOver,
  colorblind,
  shakeCurrentRow,
  shakeAttemptIndex = null,
}: BoardProps) {
  const currentRowRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [attempts.length]);

  const rows = Array.from({ length: MAX_TRIES }, (_, i) => {
    const attemptNumber = i + 1;
    const pastAttempt = attempts[i];

    if (pastAttempt) {
      return (
        <li key={attemptNumber}>
          <GuessRow
            attemptNumber={attemptNumber}
            guess={pastAttempt.guess}
            feedback={pastAttempt.feedback}
            status="past"
            colorblind={colorblind}
            shake={shakeAttemptIndex === i}
          />
        </li>
      );
    }

    const isCurrent = !isGameOver && attempts.length === i;
    if (isCurrent) {
      return (
        <li key={attemptNumber} ref={currentRowRef}>
          <GuessRow
            attemptNumber={attemptNumber}
            guess={currentGuess}
            status="current"
            colorblind={colorblind}
            shake={shakeCurrentRow}
          />
        </li>
      );
    }

    return (
      <li key={attemptNumber}>
        <GuessRow attemptNumber={attemptNumber} guess={[]} status="upcoming" colorblind={colorblind} />
      </li>
    );
  });

  return <ul className={styles.board}>{rows}</ul>;
}
