"use client";

import { useEffect, useState } from "react";
import { GameState, Player } from "../lib/types";

interface SlideshowProps {
  gameState: GameState;
  localPlayer: Player | null;
  isHost: boolean;
  onSubmitReaction: (targetPlayerId: string, reactionType: "thumbsUp" | "thumbsDown") => void;
  onNextSlide: () => void;
}

export function Slideshow({
  gameState,
  localPlayer,
  isHost,
  onSubmitReaction,
  onNextSlide,
}: SlideshowProps) {
  const [timeRemaining, setTimeRemaining] = useState(5);
  const [hasReacted, setHasReacted] = useState(false);

  // Only show drawings from non-host players
  const playersWithDrawings = gameState.players.filter((p) => !p.isHost && p.drawingDataUrl);
  const currentPlayer = playersWithDrawings[gameState.currentSlideIndex];

  // Reset state when slide changes
  useEffect(() => {
    setTimeRemaining(5);
    setHasReacted(false);
  }, [gameState.currentSlideIndex]);

  // Auto-advance timer (host only)
  useEffect(() => {
    if (!isHost) return;
    if (timeRemaining <= 0) {
      onNextSlide();
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((t) => t - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost, timeRemaining, onNextSlide]);

  const handleReaction = (type: "thumbsUp" | "thumbsDown") => {
    if (!currentPlayer || hasReacted || isHost) return;
    onSubmitReaction(currentPlayer.id, type);
    setHasReacted(true);
  };

  if (!currentPlayer) {
    return (
      <div className="slideshow">
        <h2>🖼️ No drawings to show!</h2>
        <p>No one submitted a drawing this round.</p>
      </div>
    );
  }

  const reactions = gameState.reactions[currentPlayer.id] || {
    thumbsUp: [],
    thumbsDown: [],
  };

  return (
    <div className="slideshow">
      <div className="slideshow-header">
        <h2>🖼️ Gallery Time!</h2>
        <div className="slide-progress">
          {gameState.currentSlideIndex + 1} / {playersWithDrawings.length}
        </div>
        <div className="timer">⏱️ {timeRemaining}s</div>
      </div>

      <div className="slide-content">
        <div className="artist-info">
          <span className="artist-name">🎨 {currentPlayer.name}</span>
          {currentPlayer.assignedSentence && (
            <span className="prompt">"{currentPlayer.assignedSentence}"</span>
          )}
        </div>

        <div className="drawing-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentPlayer.drawingDataUrl}
            alt={`Drawing by ${currentPlayer.name}`}
            className="drawing-image"
          />
        </div>

        <div className="reactions">
          <div className="reaction-counts">
            <span className="thumbs-up">👍 {reactions.thumbsUp.length}</span>
            <span className="thumbs-down">👎 {reactions.thumbsDown.length}</span>
          </div>

          {/* Players can vote (but not on their own drawing and not if they're host) */}
          {!isHost && localPlayer && currentPlayer.id !== localPlayer.id && (
            <div className="reaction-buttons">
              {!hasReacted ? (
                <>
                  <button
                    className="reaction-btn thumbs-up"
                    onClick={() => handleReaction("thumbsUp")}
                  >
                    👍
                  </button>
                  <button
                    className="reaction-btn thumbs-down"
                    onClick={() => handleReaction("thumbsDown")}
                  >
                    👎
                  </button>
                </>
              ) : (
                <p className="reacted-text">Thanks for voting! ✨</p>
              )}
            </div>
          )}

          {!isHost && currentPlayer.id === localPlayer?.id && (
            <p className="own-drawing-text">This is your masterpiece! 🎨</p>
          )}

          {isHost && (
            <p className="host-text">Players are voting...</p>
          )}
        </div>
      </div>

      {isHost && (
        <div className="host-controls">
          <button className="btn-secondary" onClick={onNextSlide}>
            Skip to Next →
          </button>
        </div>
      )}
    </div>
  );
}
