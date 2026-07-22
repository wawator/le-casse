import { useRef, useState } from "react";
import { Board } from "../../components/Board";
import { Button } from "../../components/Button";
import { ColorPalette } from "../../components/ColorPalette";
import { BackspaceIcon, ChevronLeftIcon } from "../../components/icons";
import { submitGuess } from "../../game/game";
import { CODE_LENGTH } from "../../game/types";
import type { Attempt, GameState, GameStatus, PegColor, SecretCode } from "../../game/types";
import { HAPTIC_ERROR, HAPTIC_SUCCESS, HAPTIC_TAP, vibrate } from "../../lib/haptics";
import styles from "./GameScreen.module.css";

interface GameScreenProps {
  secret: SecretCode;
  title: string;
  initialAttempts?: Attempt[];
  initialStatus?: GameStatus;
  colorblind: boolean;
  onFinish: (state: GameState) => void;
  onExit: () => void;
}

export function GameScreen({
  secret,
  title,
  initialAttempts = [],
  initialStatus = "en-cours",
  colorblind,
  onFinish,
  onExit,
}: GameScreenProps) {
  const [attempts, setAttempts] = useState<Attempt[]>(initialAttempts);
  const [status, setStatus] = useState<GameStatus>(initialStatus);
  const [currentGuess, setCurrentGuess] = useState<PegColor[]>([]);
  const [invalidShake, setInvalidShake] = useState(false);
  const [zeroZeroIndex, setZeroZeroIndex] = useState<number | null>(null);
  const shakeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isGameOver = status !== "en-cours";

  function handlePick(color: PegColor) {
    if (isGameOver || currentGuess.length >= CODE_LENGTH) return;
    vibrate(HAPTIC_TAP);
    setCurrentGuess((prev) => [...prev, color]);
  }

  function handleRemoveLast() {
    if (currentGuess.length === 0) return;
    vibrate(HAPTIC_TAP);
    setCurrentGuess((prev) => prev.slice(0, -1));
  }

  function scheduleShakeReset() {
    if (shakeTimeout.current) clearTimeout(shakeTimeout.current);
    shakeTimeout.current = setTimeout(() => {
      setInvalidShake(false);
      setZeroZeroIndex(null);
    }, 400);
  }

  function handleSubmit() {
    if (isGameOver) return;

    if (currentGuess.length !== CODE_LENGTH) {
      vibrate(HAPTIC_ERROR);
      setInvalidShake(true);
      scheduleShakeReset();
      return;
    }

    const nextState = submitGuess({ secret, attempts, status }, currentGuess);
    const lastFeedback = nextState.attempts[nextState.attempts.length - 1]?.feedback;

    setAttempts(nextState.attempts);
    setStatus(nextState.status);
    setCurrentGuess([]);

    if (nextState.status === "gagnee") {
      vibrate(HAPTIC_SUCCESS);
    } else if (nextState.status === "perdue") {
      vibrate(HAPTIC_ERROR);
    } else if (lastFeedback && lastFeedback.wellPlaced === 0 && lastFeedback.misplaced === 0) {
      vibrate(HAPTIC_ERROR);
      setZeroZeroIndex(nextState.attempts.length - 1);
      scheduleShakeReset();
    } else {
      vibrate(HAPTIC_TAP);
    }

    if (nextState.status !== "en-cours") {
      onFinish(nextState);
    }
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerStart}>
          <button type="button" className={styles.backButton} onClick={onExit} aria-label="Retour">
            <ChevronLeftIcon />
          </button>
          <h1 className={styles.title}>{title}</h1>
        </div>
        <span className={styles.counter}>
          Essai {Math.min(attempts.length + (isGameOver ? 0 : 1), 10)}/10
        </span>
      </header>

      <Board
        attempts={attempts}
        currentGuess={currentGuess}
        isGameOver={isGameOver}
        colorblind={colorblind}
        shakeCurrentRow={invalidShake}
        shakeAttemptIndex={zeroZeroIndex}
      />

      <footer className={styles.controls}>
        <ColorPalette
          onPick={handlePick}
          colorblind={colorblind}
          disabled={isGameOver || currentGuess.length >= CODE_LENGTH}
        />
        <div className={styles.actions}>
          <Button
            variant="secondary"
            className={styles.eraseButton}
            onClick={handleRemoveLast}
            disabled={currentGuess.length === 0}
            aria-label="Effacer le dernier pion"
          >
            <BackspaceIcon />
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isGameOver}>
            TENTER LE CODE
          </Button>
        </div>
      </footer>
    </main>
  );
}
