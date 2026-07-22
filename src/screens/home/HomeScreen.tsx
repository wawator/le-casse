import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { ChartIcon, GearIcon } from "../../components/icons";
import { LogoMark } from "../../components/LogoMark";
import { SettingsSheet } from "../../components/SettingsSheet";
import { StreakChain } from "../../components/StreakChain";
import { getChallengeNumber } from "../../game/dailySeed";
import { getMyOngoingDuels, type OngoingDuel } from "../../lib/duel";
import { getDailyProgress, getSettings, getStats, saveSettings } from "../../lib/storage";
import { isSupabaseConfigured } from "../../lib/supabaseClient";
import { DailyChallengeCard, type DailyChallengeState } from "./DailyChallengeCard";
import styles from "./HomeScreen.module.css";

interface HomeScreenProps {
  onStartDaily: () => void;
  onResumeDaily: () => void;
  onViewDailyResult: () => void;
  onStartTraining: () => void;
  onOpenRules: () => void;
  onOpenStats: () => void;
  onOpenDuel: () => void;
  onResumeDuel: (duelId: string) => void;
}

export function HomeScreen({
  onStartDaily,
  onResumeDaily,
  onViewDailyResult,
  onStartTraining,
  onOpenRules,
  onOpenStats,
  onOpenDuel,
  onResumeDuel,
}: HomeScreenProps) {
  const [challengeNumber] = useState(() => getChallengeNumber());
  const [dailyProgress] = useState(() => getDailyProgress(challengeNumber));
  const [stats] = useState(() => getStats());
  const [settings, setSettings] = useState(() => getSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ongoingDuels, setOngoingDuels] = useState<OngoingDuel[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    getMyOngoingDuels().then((duels) => {
      if (!cancelled) setOngoingDuels(duels);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const cardState: DailyChallengeState = !dailyProgress
    ? "not-played"
    : dailyProgress.status === "en-cours"
      ? "in-progress"
      : dailyProgress.status === "gagnee"
        ? "won"
        : "lost";

  const tries =
    cardState === "in-progress"
      ? (dailyProgress?.attempts.length ?? 0) + 1
      : dailyProgress?.attempts.length;

  function handleCardClick() {
    if (cardState === "not-played") onStartDaily();
    else if (cardState === "in-progress") onResumeDaily();
    else onViewDailyResult();
  }

  function handleColorblindChange(value: boolean) {
    setSettings(saveSettings({ colorblindMode: value }));
  }

  return (
    <main className={styles.screen}>
      <div className={styles.topBar}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setSettingsOpen(true)}
          aria-label="Réglages"
        >
          <GearIcon />
        </button>
        <button type="button" className={styles.iconButton} onClick={onOpenStats} aria-label="Statistiques">
          <ChartIcon />
        </button>
      </div>

      <div className={styles.hero}>
        <LogoMark />
        <h1 className={styles.wordmark}>LE CASSE</h1>
        <p className={styles.tagline}>Un code à percer chaque jour. Dix essais, aucune excuse.</p>
        {stats.currentStreak > 0 && (
          <div className={styles.streak}>
            <StreakChain count={stats.currentStreak} />
          </div>
        )}
      </div>

      <div className={styles.ctas}>
        <DailyChallengeCard
          challengeNumber={challengeNumber}
          state={cardState}
          tries={tries}
          onClick={handleCardClick}
        />

        <div className={styles.secondaryGroup}>
          <Button variant="secondary" onClick={onStartTraining}>
            Entraînement
          </Button>
          <span className={styles.hint}>Partie illimitée, code aléatoire à chaque fois</span>
        </div>

        {ongoingDuels.map((duel) => (
          <button
            key={duel.id}
            type="button"
            className={styles.duelOngoing}
            onClick={() => onResumeDuel(duel.id)}
          >
            <span className={styles.duelTitle}>Duel en cours</span>
            <span className={styles.duelBadge}>Reprendre</span>
          </button>
        ))}

        {isSupabaseConfigured ? (
          <button type="button" className={styles.duelTeaser} onClick={onOpenDuel}>
            <span className={styles.duelTitle}>Duel</span>
            <span className={styles.duelBadge}>Défier un complice</span>
          </button>
        ) : (
          <div className={styles.duelTeaser}>
            <span className={styles.duelTitle}>Duel</span>
            <span className={styles.duelBadge}>Bientôt</span>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.rulesLink} onClick={onOpenRules}>
          Règles du jeu
        </button>
      </div>

      {settingsOpen && (
        <SettingsSheet
          colorblind={settings.colorblindMode}
          onChangeColorblind={handleColorblindChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}
