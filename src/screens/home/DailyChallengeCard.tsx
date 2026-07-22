import { CheckIcon, LockIcon } from "../../components/icons";
import styles from "./DailyChallengeCard.module.css";

export type DailyChallengeState = "not-played" | "in-progress" | "won" | "lost";

interface DailyChallengeCardProps {
  challengeNumber: number;
  state: DailyChallengeState;
  tries?: number;
  onClick: () => void;
}

export function DailyChallengeCard({ challengeNumber, state, tries, onClick }: DailyChallengeCardProps) {
  const title = `Défi du jour #${challengeNumber}`;

  const subtitle =
    state === "not-played"
      ? "10 essais pour percer le code"
      : state === "in-progress"
        ? `Reprendre — essai ${tries}/10`
        : state === "won"
          ? `Percé en ${tries} essai${tries && tries > 1 ? "s" : ""} — voir le butin`
          : "Coffre resté fermé — voir le code";

  return (
    <button
      type="button"
      className={[styles.card, styles[`card--${state}`]].join(" ")}
      onClick={onClick}
    >
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </span>
      {state === "won" && (
        <span className={styles.badge}>
          <CheckIcon />
        </span>
      )}
      {state === "lost" && (
        <span className={styles.badge}>
          <LockIcon />
        </span>
      )}
    </button>
  );
}
