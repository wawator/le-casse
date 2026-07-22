import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { ChevronLeftIcon, ShareIcon } from "../../components/icons";
import { createDuel, getDuel, joinDuel } from "../../lib/duel";
import styles from "./DuelLobbyScreen.module.css";

interface DuelLobbyScreenProps {
  onDuelReady: (duelId: string) => void;
  onExit: () => void;
}

type Mode = "choix" | "creation" | "rejoindre";

const POLL_INTERVAL_MS = 2000;

export function DuelLobbyScreen({ onDuelReady, onExit }: DuelLobbyScreenProps) {
  const [mode, setMode] = useState<Mode>("choix");
  const [duelId, setDuelId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  async function handleCreate() {
    setMode("creation");
    setBusy(true);
    setError(null);
    try {
      const id = await createDuel();
      setDuelId(id);
      // Rejoindre un duel ne génère aucun événement de progression : on
      // attend qu'un adversaire arrive via un simple sondage périodique.
      pollRef.current = setInterval(async () => {
        try {
          const duel = await getDuel(id);
          if (duel.status === "en-cours") {
            if (pollRef.current) clearInterval(pollRef.current);
            onDuelReady(id);
          }
        } catch {
          // Erreur réseau transitoire : le prochain sondage réessaiera.
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer le duel.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    const code = joinCode.trim();
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      await joinDuel(code);
      onDuelReady(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de rejoindre ce duel.");
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    if (!duelId) return;
    const text = `Rejoins mon duel sur LE CASSE : ${duelId}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // annulé par l'utilisateur : on retombe sur la copie.
      }
    }
    try {
      await navigator.clipboard.writeText(duelId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // presse-papiers indisponible.
    }
  }

  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={onExit} aria-label="Retour">
          <ChevronLeftIcon />
        </button>
        <h1 className={styles.title}>Duel</h1>
      </div>

      <div className={styles.content}>
        {mode === "choix" && (
          <>
            <button
              type="button"
              className={[styles.optionCard, styles["optionCard--primary"]].join(" ")}
              onClick={handleCreate}
            >
              <span className={styles.optionTitle}>Créer un duel</span>
              <span className={styles.optionHint}>Génère un code à partager avec un complice</span>
            </button>
            <button
              type="button"
              className={[styles.optionCard, styles["optionCard--secondary"]].join(" ")}
              onClick={() => setMode("rejoindre")}
            >
              <span className={styles.optionTitle}>Rejoindre un duel</span>
              <span className={styles.optionHint}>Tu as reçu un code ? Entre-le ici</span>
            </button>
          </>
        )}

        {mode === "creation" && (
          <div className={styles.panel}>
            {duelId ? (
              <div className={styles.codeBox}>
                <span className={styles.codeLabel}>Code du duel</span>
                <span className={styles.codeValue}>{duelId}</span>
                <div className={styles.codeActions}>
                  <Button variant="primary" onClick={handleShare}>
                    <ShareIcon /> Partager
                  </Button>
                </div>
                {copied && <span className={styles.codeLabel}>Copié dans le presse-papiers !</span>}
                <div className={styles.waiting}>
                  <span className={styles.pulse} />
                  En attente d'un adversaire…
                </div>
              </div>
            ) : (
              <p className={styles.codeLabel}>Création du duel…</p>
            )}
            {error && <span className={styles.error}>{error}</span>}
          </div>
        )}

        {mode === "rejoindre" && (
          <div className={styles.panel}>
            <input
              className={styles.input}
              type="text"
              inputMode="text"
              placeholder="Colle le code reçu"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              aria-label="Code du duel"
            />
            {error && <span className={styles.error}>{error}</span>}
            <Button variant="primary" onClick={handleJoin} disabled={busy || !joinCode.trim()}>
              Rejoindre
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
