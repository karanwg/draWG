"use client";

import { useState } from "react";
import { GameState, Player } from "../lib/types";

interface SentenceSubmissionProps {
  gameState: GameState;
  localPlayer: Player | null;
  isHost: boolean;
  onSubmitSentence: (sentence: string) => void;
  onUpdatePlayerSentence: (playerId: string, sentence: string) => void;
  onStartQuiz: () => void;
}

// Helper to check if player has submitted (even if sentence was edited to empty)
function hasSubmitted(player: Player): boolean {
  return player.sentence !== undefined;
}

// Helper to check if sentence is valid (non-empty)
function hasValidSentence(player: Player): boolean {
  return player.sentence !== undefined && player.sentence.trim().length > 0;
}

export function SentenceSubmission({
  gameState,
  localPlayer,
  isHost,
  onSubmitSentence,
  onUpdatePlayerSentence,
  onStartQuiz,
}: SentenceSubmissionProps) {
  const [sentence, setSentence] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!sentence.trim()) return;
    onSubmitSentence(sentence.trim());
    setSubmitted(true);
  };

  // Only count non-host players for submissions
  const participants = gameState.players.filter((p) => !p.isHost);
  const allPlayersSubmitted = participants.every((p) => hasSubmitted(p));
  const allHaveValidSentences = participants.every((p) => hasValidSentence(p));

  // Host sees moderation view
  if (isHost) {
    return (
      <div className="sentence-submission">
        <h2>📝 Waiting for Sentences</h2>
        <p className="instruction">
          Players are writing sentences for others to draw. You can edit them below.
        </p>

        <div className="submission-status">
          <h3>
            Submissions ({participants.filter((p) => hasSubmitted(p)).length}/
            {participants.length})
          </h3>
          <ul>
            {participants.map((player) => {
              const playerSubmitted = hasSubmitted(player);
              const hasValid = hasValidSentence(player);
              
              return (
                <li key={player.id}>
                  <span className={playerSubmitted ? (hasValid ? "done" : "warning") : "pending"}>
                    {playerSubmitted ? (hasValid ? "✅" : "⚠️") : "⏳"} {player.name}
                  </span>
                  {playerSubmitted && (
                    <div className="host-edit">
                      <input
                        type="text"
                        value={player.sentence ?? ""}
                        onChange={(e) =>
                          onUpdatePlayerSentence(player.id, e.target.value)
                        }
                        maxLength={100}
                        placeholder="Enter a sentence..."
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <button
          className="btn-primary"
          onClick={onStartQuiz}
          disabled={!allHaveValidSentences}
        >
          {allHaveValidSentences
            ? "Start Quiz Round 🧠"
            : allPlayersSubmitted
            ? "Some sentences are empty!"
            : "Waiting for all submissions..."}
        </button>
      </div>
    );
  }

  // Player view
  const playerHasSubmitted = localPlayer ? hasSubmitted(localPlayer) : false;

  return (
    <div className="sentence-submission">
      <h2>✏️ What Should They Draw?</h2>
      <p className="instruction">
        Get creative! Write something silly, weird, or wonderful for someone else to draw 🎨
      </p>

      {!submitted && !playerHasSubmitted ? (
        <div className="submission-form">
          <textarea
            placeholder="e.g., A cat riding a unicycle on the moon"
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            maxLength={100}
            rows={3}
          />
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!sentence.trim()}
          >
            Submit Sentence ✨
          </button>
        </div>
      ) : (
        <div className="submitted">
          <p>✅ Your sentence has been submitted!</p>
          {localPlayer?.sentence && (
            <p className="your-sentence">"{localPlayer.sentence}"</p>
          )}
          <p className="waiting-text">Waiting for other players...</p>
        </div>
      )}

      <div className="submission-status">
        <h4>
          Players Ready ({participants.filter((p) => hasSubmitted(p)).length}/
          {participants.length})
        </h4>
        <ul>
          {participants.map((player) => {
            const playerSubmitted = hasSubmitted(player);
            return (
              <li key={player.id}>
                <span className={playerSubmitted ? "done" : "pending"}>
                  {playerSubmitted ? "✅" : "⏳"} {player.name}
                  {player.id === localPlayer?.id && (
                    <span className="you-badge">YOU</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
