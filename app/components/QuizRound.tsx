"use client";

import { useEffect, useState, useCallback } from "react";
import { GameState, Player, QUIZ_QUESTIONS, getUnlockedTools } from "../lib/types";

interface QuizRoundProps {
  gameState: GameState;
  localPlayer: Player | null;
  isHost: boolean;
  onSubmitAnswer: (questionIndex: number, answerIndex: number) => void;
  onUpdatePlayerSentence: (playerId: string, sentence: string) => void;
  onStartDrawing: () => void;
  onUpdateQuizTime: (time: number) => void;
}

const QUIZ_DURATION = 90; // 1 minute 30 seconds

export function QuizRound({
  gameState,
  localPlayer,
  isHost,
  onSubmitAnswer,
  onUpdatePlayerSentence,
  onStartDrawing,
  onUpdateQuizTime,
}: QuizRoundProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>(
    new Array(QUIZ_QUESTIONS.length).fill(null)
  );
  const [showResult, setShowResult] = useState(false);

  const currentQuestion = QUIZ_QUESTIONS[currentQuestionIndex];
  const participants = gameState.players.filter((p) => !p.isHost);

  // Timer countdown (host controls)
  useEffect(() => {
    if (!isHost) return;
    if (gameState.quizTimeRemaining <= 0) {
      // Time's up - move to drawing phase
      onStartDrawing();
      return;
    }

    const interval = setInterval(() => {
      onUpdateQuizTime(gameState.quizTimeRemaining - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost, gameState.quizTimeRemaining, onUpdateQuizTime, onStartDrawing]);

  const handleAnswer = useCallback((answerIndex: number) => {
    if (selectedAnswers[currentQuestionIndex] !== null) return;
    
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setSelectedAnswers(newAnswers);
    setShowResult(true);
    
    onSubmitAnswer(currentQuestionIndex, answerIndex);

    // Auto-advance to next question after showing result
    setTimeout(() => {
      setShowResult(false);
      if (currentQuestionIndex < QUIZ_QUESTIONS.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
    }, 1500);
  }, [currentQuestionIndex, selectedAnswers, onSubmitAnswer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const unlockedTools = localPlayer ? getUnlockedTools(localPlayer.quizScore) : [];
  const allQuestionsAnswered = selectedAnswers.every((a) => a !== null);

  // Host sees moderation view
  if (isHost) {
    return (
      <div className="quiz-round">
        <div className="quiz-header">
          <h2>🧠 Quiz in Progress</h2>
          <div className={`timer ${gameState.quizTimeRemaining <= 30 ? "warning" : ""}`}>
            ⏱️ {formatTime(gameState.quizTimeRemaining)}
          </div>
        </div>

        <div className="host-quiz-view">
          <div className="progress-overview">
            <h3>Player Progress</h3>
            <div className="player-progress-list">
              {participants.map((player) => {
                const answersCount = gameState.quizAnswers[player.id]?.filter(
                  (a) => a !== undefined
                ).length || 0;
                return (
                  <div key={player.id} className="player-progress-item">
                    <span className="player-name">{player.name}</span>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${(answersCount / QUIZ_QUESTIONS.length) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="progress-text">
                      {answersCount}/{QUIZ_QUESTIONS.length}
                    </span>
                    <span className="score-text">
                      Score: {player.quizScore}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sentence-moderation">
            <h4>📝 Edit Sentences (while players answer)</h4>
            <ul>
              {participants
                .filter((p) => p.sentence)
                .map((player) => (
                  <li key={player.id}>
                    <span className="player-name">{player.name}:</span>
                    <input
                      type="text"
                      value={player.sentence || ""}
                      onChange={(e) =>
                        onUpdatePlayerSentence(player.id, e.target.value)
                      }
                      maxLength={100}
                    />
                  </li>
                ))}
            </ul>
          </div>

          <div className="host-controls">
            <button className="btn-primary" onClick={onStartDrawing}>
              End Quiz Early & Start Drawing 🎨
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Player has finished all questions
  if (allQuestionsAnswered && !showResult) {
    return (
      <div className="quiz-round">
        <div className="quiz-header">
          <h2>🎉 Quiz Complete!</h2>
          <div className={`timer ${gameState.quizTimeRemaining <= 30 ? "warning" : ""}`}>
            ⏱️ {formatTime(gameState.quizTimeRemaining)}
          </div>
        </div>

        <div className="quiz-complete">
          <div className="score-card big">
            <h4>Your Score</h4>
            <div className="score">{localPlayer?.quizScore || 0}/{QUIZ_QUESTIONS.length}</div>
          </div>

          <div className="tools-unlocked">
            <h4>🎨 Your Drawing Tools</h4>
            <p className="tools-description">
              You unlocked {unlockedTools.length} tool{unlockedTools.length !== 1 ? "s" : ""} for the drawing phase!
            </p>
            <ul>
              {unlockedTools.map((tool, index) => (
                <li key={index}>
                  <span className="tool-emoji">{tool.icon}</span>
                  {tool.name}
                </li>
              ))}
            </ul>
          </div>

          <p className="waiting-text">
            ⏳ Waiting for timer to finish...
          </p>
        </div>
      </div>
    );
  }

  // Player answering questions
  return (
    <div className="quiz-round">
      <div className="quiz-header">
        <h2>🧠 Brain Warm-Up!</h2>
        <div className={`timer ${gameState.quizTimeRemaining <= 30 ? "warning" : ""}`}>
          ⏱️ {formatTime(gameState.quizTimeRemaining)}
        </div>
      </div>

      <div className="quiz-content">
        <div className="question-card">
          <div className="question-progress">
            Question {currentQuestionIndex + 1} of {QUIZ_QUESTIONS.length}
          </div>
          <h3>{currentQuestion.question}</h3>
          <div className="options">
            {currentQuestion.options.map((option, index) => {
              let className = "option";
              const isSelected = selectedAnswers[currentQuestionIndex] === index;
              const isCorrect = index === currentQuestion.correctIndex;
              
              if (showResult) {
                if (isCorrect) {
                  className += " correct";
                } else if (isSelected) {
                  className += " wrong";
                }
              } else if (isSelected) {
                className += " selected";
              }

              return (
                <button
                  key={index}
                  className={className}
                  onClick={() => handleAnswer(index)}
                  disabled={selectedAnswers[currentQuestionIndex] !== null}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {showResult && (
            <div className="result">
              {selectedAnswers[currentQuestionIndex] === currentQuestion.correctIndex ? (
                <p className="correct-text">🎉 Correct!</p>
              ) : (
                <p className="wrong-text">
                  ❌ Oops! It was: {currentQuestion.options[currentQuestion.correctIndex]}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="quiz-sidebar">
          <div className="score-card">
            <h4>Your Score</h4>
            <div className="score">{localPlayer?.quizScore || 0}</div>
          </div>

          <div className="question-dots">
            {QUIZ_QUESTIONS.map((_, index) => (
              <span
                key={index}
                className={`dot ${
                  selectedAnswers[index] !== null
                    ? selectedAnswers[index] === QUIZ_QUESTIONS[index].correctIndex
                      ? "correct"
                      : "wrong"
                    : index === currentQuestionIndex
                    ? "current"
                    : ""
                }`}
              />
            ))}
          </div>

          <div className="tools-unlocked">
            <h4>Unlocked Tools</h4>
            <ul>
              {unlockedTools.map((tool, index) => (
                <li key={index}>
                  <span className="tool-emoji">{tool.icon}</span>
                  {tool.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
