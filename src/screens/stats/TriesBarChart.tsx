import styles from "./TriesBarChart.module.css";

interface TriesBarChartProps {
  distribution: number[];
}

export function TriesBarChart({ distribution }: TriesBarChartProps) {
  const maxCount = Math.max(1, ...distribution);

  return (
    <div className={styles.chart} role="img" aria-label="Répartition des victoires par nombre d'essais">
      {distribution.map((count, i) => {
        const heightPercent = count > 0 ? Math.max(8, (count / maxCount) * 100) : 0;
        return (
          <div className={styles.column} key={i}>
            {count > 0 && <span className={styles.value}>{count}</span>}
            <div className={styles.barTrack}>
              <div
                className={[styles.bar, count === 0 ? styles["bar--empty"] : ""].join(" ")}
                style={{ height: count > 0 ? `${heightPercent}%` : "2px" }}
              />
            </div>
            <span className={styles.label}>{i + 1}</span>
          </div>
        );
      })}
    </div>
  );
}
