/** navigator.vibrate n'existe pas partout (iOS Safari, notamment) : no-op silencieux sinon. */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

export const HAPTIC_TAP = 10;
export const HAPTIC_SUCCESS = [20, 40, 20];
export const HAPTIC_ERROR = [15, 30, 15, 30, 15];
