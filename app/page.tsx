"use client";

import { DrawingCanvas } from "./components/DrawingCanvas";
import { Leaderboard } from "./components/Leaderboard";
import { Lobby } from "./components/Lobby";
import { QuizRound } from "./components/QuizRound";
import { SentenceSubmission } from "./components/SentenceSubmission";
import { Slideshow } from "./components/Slideshow";
import { useGameState } from "./lib/useGameState";

export default function Home() {
  const {
    gameState,
    localPlayer,
    isConnected,
    error,
    isHost,
    createRoom,
    joinRoom,
    submitSentence,
    submitQuizAnswer,
    submitDrawing,
    submitReaction,
    startSentenceSubmission,
    updatePlayerSentence,
    startQuiz,
    updateQuizTime,
    startDrawingPhase,
    updateDrawingTime,
    startSlideshow,
    nextSlide,
    resetGame,
  } = useGameState();

  const renderPhase = () => {
    if (!gameState) {
      return (
        <Lobby
          gameState={null}
          localPlayer={null}
          isHost={false}
          isConnected={false}
          error={error}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onStartGame={startSentenceSubmission}
        />
      );
    }

    switch (gameState.phase) {
      case "lobby":
        return (
          <Lobby
            gameState={gameState}
            localPlayer={localPlayer}
            isHost={isHost}
            isConnected={isConnected}
            error={error}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onStartGame={startSentenceSubmission}
          />
        );

      case "sentence_submission":
        return (
          <SentenceSubmission
            gameState={gameState}
            localPlayer={localPlayer}
            isHost={isHost}
            onSubmitSentence={submitSentence}
            onUpdatePlayerSentence={updatePlayerSentence}
            onStartQuiz={startQuiz}
          />
        );

      case "quiz":
        return (
          <QuizRound
            gameState={gameState}
            localPlayer={localPlayer}
            isHost={isHost}
            onSubmitAnswer={submitQuizAnswer}
            onUpdatePlayerSentence={updatePlayerSentence}
            onStartDrawing={startDrawingPhase}
            onUpdateQuizTime={updateQuizTime}
          />
        );

      case "drawing":
        return (
          <DrawingCanvas
            gameState={gameState}
            localPlayer={localPlayer}
            isHost={isHost}
            onSubmitDrawing={submitDrawing}
            onUpdateTime={updateDrawingTime}
            onStartSlideshow={startSlideshow}
          />
        );

      case "slideshow":
        return (
          <Slideshow
            gameState={gameState}
            localPlayer={localPlayer}
            isHost={isHost}
            onSubmitReaction={submitReaction}
            onNextSlide={nextSlide}
          />
        );

      case "leaderboard":
        return (
          <Leaderboard
            gameState={gameState}
            localPlayer={localPlayer}
            isHost={isHost}
            onPlayAgain={resetGame}
          />
        );

      default:
        return <div>Unknown phase</div>;
    }
  };

  return (
    <div className="game-container">
      {renderPhase()}
    </div>
  );
}
