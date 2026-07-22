import styles from "./StreakChain.module.css";

interface StreakChainProps {
  count: number;
}

const MAX_VISIBLE_LINKS = 7;

export function StreakChain({ count }: StreakChainProps) {
  if (count <= 0) return null;

  const visible = Math.min(count, MAX_VISIBLE_LINKS);

  return (
    <div className={styles.wrap}>
      <div className={styles.chain} aria-hidden="true">
        {Array.from({ length: visible }, (_, i) => (
          <span key={i} className={styles.link} style={{ animationDelay: `calc(var(--stagger-step) * ${i})` }} />
        ))}
      </div>
      <span className={styles.label}>
        {count} jour{count > 1 ? "s" : ""} de récidive
      </span>
    </div>
  );
}
