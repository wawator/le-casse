import type { ReactNode } from "react";
import styles from "./illustrations.module.css";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <div className={styles.shadow} />
      <div className={styles.card}>{children}</div>
    </div>
  );
}

const PEG_COLORS = ["var(--peg-rouge)", "var(--peg-vert)", "var(--peg-bleu)", "var(--peg-jaune)"];

export function SearchIllustration() {
  return (
    <Frame>
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        {PEG_COLORS.map((color, i) => (
          <circle key={i} cx={24 + i * 24} cy="88" r="9" fill={color} />
        ))}
        <circle cx="66" cy="46" r="26" fill="var(--color-bg)" stroke="var(--color-ink)" strokeWidth="5" />
        <circle cx="66" cy="46" r="12" fill="none" stroke="var(--color-accent)" strokeWidth="4" />
        <line x1="85" y1="65" x2="102" y2="82" stroke="var(--color-ink)" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </Frame>
  );
}

export function FeedbackIllustration() {
  return (
    <Frame>
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        {PEG_COLORS.map((color, i) => (
          <circle key={i} cx={22 + i * 24} cy="34" r="10" fill={color} />
        ))}
        <rect x="14" y="66" width="16" height="16" rx="4" fill="var(--color-ink)" />
        <rect x="34" y="66" width="16" height="16" rx="4" fill="var(--color-ink)" />
        <rect x="14" y="86" width="16" height="16" rx="4" fill="var(--indicator-misplaced)" />
        <rect x="34" y="86" width="16" height="16" rx="4" fill="var(--color-border)" />
      </svg>
    </Frame>
  );
}

export function VaultIllustration() {
  return (
    <Frame>
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <rect x="20" y="22" width="80" height="80" rx="12" fill="var(--color-bg)" stroke="var(--color-ink)" strokeWidth="5" />
        {/* rivets */}
        <circle cx="30" cy="32" r="2.5" fill="var(--color-border)" />
        <circle cx="90" cy="32" r="2.5" fill="var(--color-border)" />
        <circle cx="30" cy="92" r="2.5" fill="var(--color-border)" />
        <circle cx="90" cy="92" r="2.5" fill="var(--color-border)" />
        {/* poignée */}
        <rect x="86" y="52" width="9" height="24" rx="4.5" fill="var(--color-ink)" />
        {/* molette */}
        <circle cx="52" cy="64" r="17" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="3" />
        <rect x="49" y="50" width="6" height="8" rx="2" fill="var(--color-ink)" />
        <circle cx="52" cy="64" r="4" fill="var(--color-accent)" />
        <circle cx="94" cy="28" r="15" fill="var(--color-accent)" />
        <text
          x="94"
          y="33"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontWeight="800"
          fontSize="14"
          fill="var(--color-ink)"
        >
          10
        </text>
      </svg>
    </Frame>
  );
}
