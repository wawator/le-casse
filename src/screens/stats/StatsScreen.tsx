import { ChevronLeftIcon } from "../../components/icons";
import { StreakChain } from "../../components/StreakChain";
import { getStats } from "../../lib/storage";
import { TriesBarChart } from "./TriesBarChart";
import styles from "./StatsScreen.module.css";

interface StatsScreenProps {
  onClose: () => void;
}

export function StatsScreen({ onClose }: StatsScreenProps) {
  const stats = getStats();
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  const hasDistribution = stats.triesDistribution.some((count) => count > 0);

  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={onClose} aria-label="Retour">
          <ChevronLeftIcon />
        </button>
        <h1 className={styles.title}>Statistiques</h1>
      </div>

      <div className={styles.content}>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.tileValue}>{stats.gamesPlayed}</span>
            <span className={styles.tileLabel}>Casses tentés</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileValue}>{winRate}%</span>
            <span className={styles.tileLabel}>Taux de réussite</span>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Récidive</h2>
          <div className={styles.streakCard}>
            <StreakChain count={stats.currentStreak} />
            {stats.currentStreak === 0 && <span className={styles.streakRecord}>Pas de série en cours</span>}
            <span className={styles.streakRecord}>
              Record : <strong>{stats.bestStreak}</strong> jour{stats.bestStreak > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Répartition des essais</h2>
          {hasDistribution ? (
            <TriesBarChart distribution={stats.triesDistribution} />
          ) : (
            <div className={styles.emptyState}>
              <p>
                {stats.gamesPlayed > 0
                  ? "Aucun coffre percé pour l'instant. Ta prochaine victoire lancera ce graphe."
                  : "Aucun casse encore tenté. Perce le défi du jour pour lancer tes stats."}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
