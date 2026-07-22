import { useRef, useState } from "react";
import { Button } from "../../components/Button";
import { ChevronLeftIcon, ChevronRightIcon } from "../../components/icons";
import { FeedbackIllustration, SearchIllustration, VaultIllustration } from "./illustrations";
import styles from "./RulesScreen.module.css";

interface RulesScreenProps {
  onClose: () => void;
}

const SLIDES = [
  {
    Illustration: SearchIllustration,
    title: "Perce le code",
    body: "Un code secret de 4 pions t'attend, choisi parmi 6 couleurs. Elles peuvent se répéter — ne relâche pas ta vigilance.",
  },
  {
    Illustration: FeedbackIllustration,
    title: "Lis les indices",
    body: "Après chaque tentative : un carré encre veut dire pion bien placé, un carré gris veut dire bonne couleur mais mauvaise place.",
  },
  {
    Illustration: VaultIllustration,
    title: "10 essais, un par jour",
    body: "Dix tentatives pour percer le coffre. Un seul défi par jour — rate-le, et reviens demain pour ta récidive.",
  },
];

export function RulesScreen({ onClose }: RulesScreenProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function goTo(index: number) {
    const el = trackRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, index));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    setActiveIndex(clamped);
  }

  /** Lit la position de scroll réelle plutôt que l'état React, pour rester correct
   * même si plusieurs clics arrivent avant qu'un re-render n'ait eu lieu. */
  function goToRelative(delta: number) {
    const el = trackRef.current;
    if (!el) return;
    const currentIndex = Math.round(el.scrollLeft / el.clientWidth);
    goTo(currentIndex + delta);
  }

  function handleScroll() {
    const el = trackRef.current;
    if (!el) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={onClose} aria-label="Retour">
          <ChevronLeftIcon />
        </button>
        <h1 className={styles.title}>Règles du jeu</h1>
      </div>

      <div className={styles.track} ref={trackRef} onScroll={handleScroll}>
        {SLIDES.map(({ Illustration, title, body }, i) => (
          <section className={styles.slide} key={i} aria-hidden={i !== activeIndex}>
            <Illustration />
            <h2 className={styles.slideTitle}>{title}</h2>
            <p className={styles.slideBody}>{body}</p>
          </section>
        ))}
      </div>

      <div className={styles.nav}>
        <button
          type="button"
          className={styles.arrowButton}
          onClick={() => goToRelative(-1)}
          disabled={activeIndex === 0}
          aria-label="Écran précédent"
        >
          <ChevronLeftIcon />
        </button>

        <div className={styles.dots}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              className={[styles.dot, i === activeIndex ? styles["dot--active"] : ""].join(" ")}
              onClick={() => goTo(i)}
              aria-label={`Aller à l'écran ${i + 1}`}
              aria-current={i === activeIndex}
            />
          ))}
        </div>

        <button
          type="button"
          className={styles.arrowButton}
          onClick={() => goToRelative(1)}
          disabled={activeIndex === SLIDES.length - 1}
          aria-label="Écran suivant"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className={styles.footer}>
        <Button variant="primary" onClick={onClose}>
          Compris, on y va
        </Button>
      </div>
    </main>
  );
}
