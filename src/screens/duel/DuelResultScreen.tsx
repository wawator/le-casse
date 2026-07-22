import { CloseIcon } from "../../components/icons";
import type { DuelFinishResult } from "./DuelGameScreen";
import styles from "./DuelResultScreen.module.css";

interface DuelResultScreenProps {
  result: DuelFinishResult;
  onNewDuel: () => void;
  onGoHome: () => void;
}

export function DuelResultScreen({ result, onNewDuel, onGoHome }: DuelResultScreenProps) {
  const isDraw = result.winner === null;
  const won = !isDraw && result.winner === result.myUserId;

  const variant = isDraw ? "draw" : won ? "won" : "lost";
  const title = isDraw ? "MATCH NUL" : won ? "DUEL REMPORTÉ !" : "DUEL PERDU";
  const subtitle = isDraw
    ? "Personne n'a percé le code à temps."
    : won
      ? "Ton complice n'a pas fait le poids."
      : "Ton adversaire a percé le code en premier.";

  return (
    <main className={[styles.screen, styles[`screen--${variant}`]].join(" ")}>
      <button type="button" className={styles.closeButton} onClick={onGoHome} aria-label="Retour à l'accueil">
        <CloseIcon />
      </button>

      <div className={styles.hero}>
        <h1 className={styles.title}>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className={styles.comparison}>
        <div className={[styles.side, won ? styles["side--winner"] : ""].join(" ")}>
          <span className={styles.sideLabel}>Toi</span>
          <span className={styles.sideValue}>{result.myAttempts.length}/10</span>
        </div>
        <div className={[styles.side, !isDraw && !won ? styles["side--winner"] : ""].join(" ")}>
          <span className={styles.sideLabel}>Adversaire</span>
          <span className={styles.sideValue}>{result.opponentAttempts}/10</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.primaryAction} onClick={onNewDuel}>
          Nouveau duel
        </button>
        <button type="button" className={styles.secondaryAction} onClick={onGoHome}>
          Retour à l'accueil
        </button>
      </div>
    </main>
  );
}
