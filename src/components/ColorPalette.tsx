import { PEG_COLORS, type PegColor } from "../game/types";
import { Peg } from "./Peg";
import styles from "./ColorPalette.module.css";

interface ColorPaletteProps {
  onPick: (color: PegColor) => void;
  colorblind: boolean;
  disabled?: boolean;
}

export function ColorPalette({ onPick, colorblind, disabled = false }: ColorPaletteProps) {
  const className = [styles.palette, disabled ? styles["palette--disabled"] : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} role="group" aria-label="Palette de couleurs">
      {PEG_COLORS.map((color) => (
        <Peg
          key={color}
          color={color}
          size="lg"
          colorblind={colorblind}
          interactive={!disabled}
          onClick={() => onPick(color)}
          label={`Ajouter ${color}`}
        />
      ))}
    </div>
  );
}
