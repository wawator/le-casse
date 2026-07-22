import { useEffect, useRef, useState } from "react";
import { Board } from "../../components/Board";
import { Button } from "../../components/Button";
import { ColorPalette } from "../../components/ColorPalette";
import { BackspaceIcon, ChevronLeftIcon } from "../../components/icons";
import { CODE_LENGTH } from "../../game/types";
import type { Attempt, GameStatus, PegColor } from "../../game/types";
import {
  deriveGameStatus,
  getDuel,
  getMyAttempts,
  getMyUserId,
  getOpponentProgress,
  submitDuelGuess,
  subscribeToDuel,
  type DuelStatus,
} from "../../lib/duel";
import { HAPTIC_ERROR, HAPTIC_SUCCESS, HAPTIC_TAP, vibrate } from "../../lib/haptics";
import styles from "./DuelGameScreen.module.css";

export interface DuelFinishResult {
  duelId: string;
  status: GameStatus;
  myAttempts: Attempt[];
  opponentAttempts: number;
  winner: string | null;
  myUserId: string;
}

interface DuelGameScreenProps {
  duelId: string;
  colorblind: boolean;
  onFinish: (result: DuelFinishResult) => void;
  onExit: () => void;
}

export function DuelGameScreen({ duelId, colorblind, onFinish, onExit }: DuelGameScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [currentGuess, setCurrentGuess] = useState<PegColor[]>([]);
  const [opponentProgress, setOpponentProgress] = useState({ attempts: 0, solved: false });
  const [submitting, setSubmitting] = useState(false);
  const [invalidShake, setInvalidShake] = useState(false);

  const myUserIdRef = useRef<string | null>(null);
  const opponentIdRef = useRef<string | null>(null);
  const attemptsRef = useRef<Attempt[]>([]);
  const opponentProgressRef = useRef({ attempts: 0, solved: false });
  const duelIdRef = useRef(duelId);
  const finishedRef = useRef(false);
  const shakeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    attemptsRef.current = attempts;
  }, [attempts]);
  useEffect(() => {
    opponentProgressRef.current = opponentProgress;
  }, [opponentProgress]);

  function finishNow(duel: { status: DuelStatus; winner: string | null }, userId: string) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const iWon = duel.winner === userId;
    onFinish({
      duelId: duelIdRef.current,
      status: deriveGameStatus(duel.status, iWon),
      myAttempts: attemptsRef.current,
      opponentAttempts: opponentProgressRef.current.attempts,
      winner: duel.winner,
      myUserId: userId,
    });
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const userId = await getMyUserId();
        if (!userId) throw new Error("Session indisponible. Reviens à l'accueil et réessaie.");
        const duel = await getDuel(duelId);
        const myAttemptsData = await getMyAttempts(duelId);
        const opponentId = duel.player_a === userId ? duel.player_b : duel.player_a;

        if (cancelled) return;
        myUserIdRef.current = userId;
        opponentIdRef.current = opponentId;
        setAttempts(myAttemptsData);

        if (opponentId) {
          const progress = await getOpponentProgress(duelId, opponentId);
          if (!cancelled) setOpponentProgress(progress);
        }

        setLoading(false);

        if (duel.status === "terminee") {
          finishNow(duel, userId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de charger ce duel.");
          setLoading(false);
        }
      }
    })();

    const unsubscribe = subscribeToDuel(duelId, {
      onProgress: (event) => {
        if (event.playerId !== opponentIdRef.current) return;
        setOpponentProgress({ attempts: event.attemptNumber, solved: event.solved });

        // L'adversaire a peut-être terminé le duel (percé le code, ou épuisé
        // ses essais) : on revérifie le statut authoritatif par REST plutôt
        // que de faire confiance à un payload realtime sur "duels".
        if (event.solved || event.attemptNumber >= 10) {
          getDuel(duelId)
            .then((duel) => {
              if (duel.status === "terminee" && myUserIdRef.current) {
                finishNow(duel, myUserIdRef.current);
              }
            })
            .catch(() => {
              // Re-tentative silencieuse : le prochain événement de
              // progression (ou mon propre prochain coup) redéclenchera la vérification.
            });
        }
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelId]);

  function handlePick(color: PegColor) {
    if (submitting || currentGuess.length >= CODE_LENGTH) return;
    vibrate(HAPTIC_TAP);
    setCurrentGuess((prev) => [...prev, color]);
  }

  function handleRemoveLast() {
    if (currentGuess.length === 0) return;
    vibrate(HAPTIC_TAP);
    setCurrentGuess((prev) => prev.slice(0, -1));
  }

  async function handleSubmit() {
    if (submitting) return;

    if (currentGuess.length !== CODE_LENGTH) {
      vibrate(HAPTIC_ERROR);
      setInvalidShake(true);
      if (shakeTimeout.current) clearTimeout(shakeTimeout.current);
      shakeTimeout.current = setTimeout(() => setInvalidShake(false), 400);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await submitDuelGuess(duelId, currentGuess);
      const newAttempt: Attempt = {
        guess: currentGuess,
        feedback: { wellPlaced: result.wellPlaced, misplaced: result.misplaced },
      };
      setAttempts((prev) => [...prev, newAttempt]);
      setCurrentGuess([]);

      if (result.duelStatus === "terminee" && myUserIdRef.current) {
        vibrate(result.winner === myUserIdRef.current ? HAPTIC_SUCCESS : HAPTIC_ERROR);
        finishNow({ status: "terminee", winner: result.winner }, myUserIdRef.current);
      } else {
        vibrate(HAPTIC_TAP);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cette tentative n'a pas pu être envoyée.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.screen}>
        <div className={styles.loading}>Connexion au duel…</div>
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerStart}>
          <button type="button" className={styles.backButton} onClick={onExit} aria-label="Retour">
            <ChevronLeftIcon />
          </button>
          <h1 className={styles.title}>Duel</h1>
        </div>
        <span className={styles.counter}>Essai {Math.min(attempts.length + 1, 10)}/10</span>
      </header>

      <div className={styles.opponentStrip}>
        <span className={styles.opponentLabel}>Adversaire</span>
        <div className={styles.opponentTrack}>
          <div className={styles.opponentFill} style={{ width: `${(opponentProgress.attempts / 10) * 100}%` }} />
        </div>
        <span className={styles.opponentCount}>{opponentProgress.attempts}/10</span>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <Board
        attempts={attempts}
        currentGuess={currentGuess}
        isGameOver={submitting}
        colorblind={colorblind}
        shakeCurrentRow={invalidShake}
      />

      <footer className={styles.controls}>
        <ColorPalette onPick={handlePick} colorblind={colorblind} disabled={submitting || currentGuess.length >= CODE_LENGTH} />
        <div className={styles.actions}>
          <Button
            variant="secondary"
            className={styles.eraseButton}
            onClick={handleRemoveLast}
            disabled={currentGuess.length === 0 || submitting}
            aria-label="Effacer le dernier pion"
          >
            <BackspaceIcon />
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            TENTER LE CODE
          </Button>
        </div>
      </footer>
    </main>
  );
}
