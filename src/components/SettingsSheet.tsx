import { useEffect } from "react";
import { CloseIcon } from "./icons";
import { Toggle } from "./Toggle";
import styles from "./SettingsSheet.module.css";

interface SettingsSheetProps {
  colorblind: boolean;
  onChangeColorblind: (value: boolean) => void;
  onClose: () => void;
}

export function SettingsSheet({ colorblind, onChangeColorblind, onClose }: SettingsSheetProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Réglages"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Réglages</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fermer">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.row}>
          <div className={styles.rowText}>
            <span className={styles.rowLabel}>Mode daltonisme</span>
            <span className={styles.rowHint}>Ajoute une lettre distinctive sur chaque pion</span>
          </div>
          <Toggle checked={colorblind} onChange={onChangeColorblind} label="Mode daltonisme" />
        </div>
      </div>
    </div>
  );
}
