import styles from "./LogoMark.module.css";

/** Molette de coffre + cadenas : élément signature de l'accueil. */
export function LogoMark() {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360;
    const isAccent = i % 3 === 0;
    return (
      <rect
        key={i}
        x="47"
        y="4"
        width="6"
        height={isAccent ? 12 : 7}
        rx="2"
        fill={isAccent ? "var(--color-accent)" : "var(--color-ink)"}
        transform={`rotate(${angle} 50 50)`}
      />
    );
  });

  return (
    <svg className={styles.wrap} viewBox="0 0 100 100" fill="none" role="img" aria-label="LE CASSE">
      <g className={styles.dial}>
        <circle cx="50" cy="50" r="46" fill="var(--color-surface)" />
        {ticks}
        <circle cx="50" cy="50" r="30" fill="var(--color-bg)" />
      </g>
      <rect x="36" y="46" width="28" height="22" rx="4" fill="var(--color-ink)" />
      <path
        d="M41 46v-7a9 9 0 0 1 18 0v7"
        stroke="var(--color-ink)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="50" cy="57" r="3" fill="var(--color-accent)" />
    </svg>
  );
}
