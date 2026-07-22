import { useState } from "react";
import { GameScreen } from "./screens/game/GameScreen";
import { HomeScreen } from "./screens/home/HomeScreen";
import { ResultScreen } from "./screens/result/ResultScreen";
import { RulesScreen } from "./screens/rules/RulesScreen";
import { StatsScreen } from "./screens/stats/StatsScreen";
import { DuelLobbyScreen } from "./screens/duel/DuelLobbyScreen";
import { DuelGameScreen, type DuelFinishResult } from "./screens/duel/DuelGameScreen";
import { DuelResultScreen } from "./screens/duel/DuelResultScreen";
import { generateRandomSecret, generateSecretForChallenge, getChallengeNumber } from "./game/dailySeed";
import type { Attempt, GameState, GameStatus, SecretCode } from "./game/types";
import { getDailyProgress, getSettings, recordDailyResult, saveDailyProgress } from "./lib/storage";
import { pushDailyResult } from "./lib/sync";

type View =
  | { name: "accueil" }
  | { name: "regles" }
  | { name: "stats" }
  | { name: "jeu"; mode: "defi" | "entrainement" }
  | {
      name: "resultat";
      mode: "defi" | "entrainement";
      challengeNumber?: number;
      secret: SecretCode;
      attempts: Attempt[];
      status: GameStatus;
    }
  | { name: "duel-lobby" }
  | { name: "duel-jeu"; duelId: string }
  | { name: "duel-resultat"; result: DuelFinishResult };

function App() {
  const [view, setView] = useState<View>({ name: "accueil" });
  const [trainingSecret, setTrainingSecret] = useState<SecretCode | null>(null);
  const colorblind = getSettings().colorblindMode;

  if (view.name === "jeu" && view.mode === "entrainement") {
    const secret = trainingSecret ?? generateRandomSecret();

    function handleFinish(state: GameState) {
      setView({
        name: "resultat",
        mode: "entrainement",
        secret: state.secret,
        attempts: state.attempts,
        status: state.status,
      });
    }

    return (
      <GameScreen
        secret={secret}
        title="Entraînement"
        colorblind={colorblind}
        onFinish={handleFinish}
        onExit={() => {
          setTrainingSecret(null);
          setView({ name: "accueil" });
        }}
      />
    );
  }

  if (view.name === "jeu" && view.mode === "defi") {
    const challengeNumber = getChallengeNumber();
    const secret = generateSecretForChallenge(challengeNumber);
    const saved = getDailyProgress(challengeNumber);

    function handleFinish(state: GameState) {
      const progress = {
        challengeNumber,
        attempts: state.attempts,
        status: state.status,
        statsRecorded: true,
      };
      saveDailyProgress(progress);
      recordDailyResult(progress);
      void pushDailyResult(progress);
      setView({
        name: "resultat",
        mode: "defi",
        challengeNumber,
        secret: state.secret,
        attempts: state.attempts,
        status: state.status,
      });
    }

    return (
      <GameScreen
        secret={secret}
        title={`Défi du jour #${challengeNumber}`}
        initialAttempts={saved?.attempts ?? []}
        initialStatus={saved?.status ?? "en-cours"}
        colorblind={colorblind}
        onFinish={handleFinish}
        onExit={() => setView({ name: "accueil" })}
      />
    );
  }

  if (view.name === "regles") {
    return <RulesScreen onClose={() => setView({ name: "accueil" })} />;
  }

  if (view.name === "stats") {
    return <StatsScreen onClose={() => setView({ name: "accueil" })} />;
  }

  if (view.name === "duel-lobby") {
    return (
      <DuelLobbyScreen
        onDuelReady={(duelId) => setView({ name: "duel-jeu", duelId })}
        onExit={() => setView({ name: "accueil" })}
      />
    );
  }

  if (view.name === "duel-jeu") {
    return (
      <DuelGameScreen
        duelId={view.duelId}
        colorblind={colorblind}
        onFinish={(result) => setView({ name: "duel-resultat", result })}
        onExit={() => setView({ name: "accueil" })}
      />
    );
  }

  if (view.name === "duel-resultat") {
    return (
      <DuelResultScreen
        result={view.result}
        onNewDuel={() => setView({ name: "duel-lobby" })}
        onGoHome={() => setView({ name: "accueil" })}
      />
    );
  }

  if (view.name === "resultat") {
    return (
      <ResultScreen
        challengeNumber={view.challengeNumber}
        secret={view.secret}
        attempts={view.attempts}
        status={view.status}
        colorblind={colorblind}
        onGoHome={() => setView({ name: "accueil" })}
        onPlayAgain={
          view.mode === "entrainement"
            ? () => {
                setTrainingSecret(generateRandomSecret());
                setView({ name: "jeu", mode: "entrainement" });
              }
            : undefined
        }
      />
    );
  }

  return (
    <HomeScreen
      onStartDaily={() => setView({ name: "jeu", mode: "defi" })}
      onResumeDaily={() => setView({ name: "jeu", mode: "defi" })}
      onViewDailyResult={() => {
        const challengeNumber = getChallengeNumber();
        const saved = getDailyProgress(challengeNumber);
        if (!saved) return;
        setView({
          name: "resultat",
          mode: "defi",
          challengeNumber,
          secret: generateSecretForChallenge(challengeNumber),
          attempts: saved.attempts,
          status: saved.status,
        });
      }}
      onStartTraining={() => {
        setTrainingSecret(generateRandomSecret());
        setView({ name: "jeu", mode: "entrainement" });
      }}
      onOpenRules={() => setView({ name: "regles" })}
      onOpenStats={() => setView({ name: "stats" })}
      onOpenDuel={() => setView({ name: "duel-lobby" })}
      onResumeDuel={(duelId) => setView({ name: "duel-jeu", duelId })}
    />
  );
}

export default App;
