import { useState } from "react";
import { Peg } from "../../components/Peg";
import { CloseIcon, ShareIcon } from "../../components/icons";
import { buildShareText } from "../../game/share";
import type { Attempt, GameStatus, SecretCode } from "../../game/types";
import { getStats } from "../../lib/storage";
import { vibrate, HAPTIC_TAP } from "../../lib/haptics";
import { ResultTicket } from "./ResultTicket";
import styles from "./ResultScreen.module.css";

interface ResultScreenProps {
  challengeNumber?: number;
  attempts: Attempt[];
  secret: SecretCode;
  status: GameStatus;
  colorblind: boolean;
  onGoHome: () => void;
  onPlayAgain?: () => void;
}

export function ResultScreen({
  challengeNumber,
  attempts,
  secret,
  status,
  colorblind,
  onGoHome,
  onPlayAgain,
}: ResultScreenProps) {
  const [copied, setCopied] = useState(false);
  const stats = getStats();
  const won = status === "gagnee";
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;

  async function handleShare() {
    vibrate(HAPTIC_TAP);
    const text = buildShareText(challengeNumber ?? 0, attempts, status);

    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // L'utilisateur a annulé le partage : on retombe sur la copie.
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible : rien à faire de plus ici.
    }
  }

  return (
    <main className={[styles.screen, styles[won ? "screen--won" : "screen--lost"]].join(" ")}>
      <button type="button" className={styles.closeButton} onClick={onGoHome} aria-label="Retour à l'accueil">
        <CloseIcon />
      </button>

      <div className={styles.hero}>
        <h1 className={styles.title}>{won ? "CODE PERCÉ !" : "COFFRE VERROUILLÉ"}</h1>
        <p className={styles.subtitle}>
          {won
            ? `Percé en ${attempts.length} essai${attempts.length > 1 ? "s" : ""}`
            : "Le butin t'échappe, pour cette fois"}
        </p>
      </div>

      {!won && (
        <div className={styles.revealRow}>
          {secret.map((color, i) => (
            <span key={i} className={styles.revealPeg} style={{ animationDelay: `calc(var(--stagger-step) * ${i})` }}>
              <Peg color={color} size="lg" colorblind={colorblind} />
            </span>
          ))}
        </div>
      )}

      {challengeNumber !== undefined && (
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats.currentStreak}</span>
            <span className={styles.statLabel}>Récidive</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{winRate}%</span>
            <span className={styles.statLabel}>Réussite</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats.gamesPlayed}</span>
            <span className={styles.statLabel}>Casses</span>
          </div>
        </div>
      )}

      <div className={styles.ticketWrap}>
        <ResultTicket challengeNumber={challengeNumber} attempts={attempts} status={status} />
      </div>

      <div className={styles.actions}>
        {challengeNumber !== undefined && (
          <>
            <button type="button" className={styles.shareButton} onClick={handleShare}>
              <ShareIcon />
              Partager mon butin
            </button>
            {copied && <span className={styles.copiedHint}>Copié dans le presse-papiers !</span>}
          </>
        )}

        {onPlayAgain && (
          <button type="button" className={styles.shareButton} onClick={onPlayAgain}>
            Nouvelle partie
          </button>
        )}

        <button type="button" className={styles.secondaryAction} onClick={onGoHome}>
          Retour à l'accueil
        </button>
      </div>
    </main>
  );
}
