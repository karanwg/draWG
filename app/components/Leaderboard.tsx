"use client";

import { useMemo } from "react";
import { GameState, Player } from "../lib/types";

interface LeaderboardProps {
  gameState: GameState;
  localPlayer: Player | null;
  isHost: boolean;
  onPlayAgain: () => void;
}

export function Leaderboard({
  gameState,
  localPlayer,
  isHost,
  onPlayAgain,
}: LeaderboardProps) {
  const { topLiked, topDisliked, participants } = useMemo(() => {
    // Only show participants (non-host players)
    const participantsWithDrawings = gameState.players.filter(
      (p) => !p.isHost && p.drawingDataUrl
    );

    // Sort by thumbs up (descending)
    const sortedByLikes = [...participantsWithDrawings].sort(
      (a, b) => b.thumbsUp - a.thumbsUp
    );

    // Sort by thumbs down (descending)
    const sortedByDislikes = [...participantsWithDrawings].sort(
      (a, b) => b.thumbsDown - a.thumbsDown
    );

    return {
      topLiked: sortedByLikes.slice(0, 3),
      topDisliked: sortedByDislikes.slice(0, 3).filter((p) => p.thumbsDown > 0),
      participants: participantsWithDrawings,
    };
  }, [gameState.players]);

  const getMedal = (index: number) => {
    switch (index) {
      case 0:
        return "🥇";
      case 1:
        return "🥈";
      case 2:
        return "🥉";
      default:
        return "";
    }
  };

  return (
    <div className="leaderboard">
      <h1>🏆 And the Winners Are...</h1>

      <div className="leaderboard-sections">
        <div className="section liked">
          <h2>👍 Most Liked Drawings</h2>
          {topLiked.length > 0 ? (
            <ol>
              {topLiked.map((player, index) => (
                <li key={player.id} className={`rank-${index + 1}`}>
                  <div className="player-entry">
                    <span className="medal">{getMedal(index)}</span>
                    <div className="player-info">
                      <span className="player-name">
                        {player.name}
                        {player.id === localPlayer?.id && (
                          <span className="you-badge">YOU</span>
                        )}
                      </span>
                      <span className="votes">👍 {player.thumbsUp}</span>
                    </div>
                    {player.drawingDataUrl && (
                      <div className="mini-drawing">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={player.drawingDataUrl}
                          alt={`Drawing by ${player.name}`}
                        />
                      </div>
                    )}
                  </div>
                  {player.assignedSentence && (
                    <p className="prompt">"{player.assignedSentence}"</p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="no-results">No votes yet!</p>
          )}
        </div>

        <div className="section disliked">
          <h2>👎 Most Controversial</h2>
          {topDisliked.length > 0 ? (
            <ol>
              {topDisliked.map((player, index) => (
                <li key={player.id} className={`rank-${index + 1}`}>
                  <div className="player-entry">
                    <span className="medal">{getMedal(index)}</span>
                    <div className="player-info">
                      <span className="player-name">
                        {player.name}
                        {player.id === localPlayer?.id && (
                          <span className="you-badge">YOU</span>
                        )}
                      </span>
                      <span className="votes">👎 {player.thumbsDown}</span>
                    </div>
                    {player.drawingDataUrl && (
                      <div className="mini-drawing">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={player.drawingDataUrl}
                          alt={`Drawing by ${player.name}`}
                        />
                      </div>
                    )}
                  </div>
                  {player.assignedSentence && (
                    <p className="prompt">"{player.assignedSentence}"</p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="no-results">Everyone was loved! 💕</p>
          )}
        </div>
      </div>

      <div className="all-drawings">
        <h2>🖼️ All Drawings</h2>
        <div className="drawings-grid">
          {participants.map((player) => (
              <div key={player.id} className="drawing-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={player.drawingDataUrl}
                  alt={`Drawing by ${player.name}`}
                />
                <div className="card-info">
                  <span className="artist">{player.name}</span>
                  <span className="reactions">
                    👍 {player.thumbsUp} | 👎 {player.thumbsDown}
                  </span>
                </div>
                {player.assignedSentence && (
                  <p className="prompt">"{player.assignedSentence}"</p>
                )}
              </div>
            ))}
        </div>
      </div>

      {isHost && (
        <div className="host-controls">
          <button className="btn-primary" onClick={onPlayAgain}>
            🔄 Play Again
          </button>
        </div>
      )}
    </div>
  );
}
