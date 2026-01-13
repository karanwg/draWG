"use client";

import { useState } from "react";
import { GameState, Player } from "../lib/types";

interface LobbyProps {
  gameState: GameState | null;
  localPlayer: Player | null;
  isHost: boolean;
  isConnected: boolean;
  error: string | null;
  onCreateRoom: (hostName: string) => Promise<string>;
  onJoinRoom: (roomCode: string, playerName: string) => Promise<void>;
  onStartGame: () => void;
}

export function Lobby({
  gameState,
  localPlayer,
  isHost,
  isConnected,
  error,
  onCreateRoom,
  onJoinRoom,
  onStartGame,
}: LobbyProps) {
  const [mode, setMode] = useState<"select" | "host" | "join">("select");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateRoom = async () => {
    setIsLoading(true);
    try {
      await onCreateRoom("Host");
    } catch {
      // Error is handled by parent
    }
    setIsLoading(false);
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    setIsLoading(true);
    try {
      await onJoinRoom(roomCode.trim().toUpperCase(), playerName.trim());
    } catch {
      // Error is handled by parent
    }
    setIsLoading(false);
  };

  if (isConnected && gameState) {
    // Only show participants (non-host players)
    const participants = gameState.players.filter((p) => !p.isHost);

    return (
      <div className="lobby-connected">
        <div className="room-info">
          <h2>Room Code</h2>
          <div className="room-code">{gameState.roomCode}</div>
          <p className="room-hint">Share this code with players</p>
        </div>

        <div className="players-list">
          <h3>Players ({participants.length})</h3>
          {participants.length === 0 ? (
            <p className="no-players">No players have joined yet...</p>
          ) : (
            <ul>
              {participants.map((player) => (
                <li key={player.id}>
                  {player.name}
                  {player.id === localPlayer?.id && (
                    <span className="you-badge">YOU</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {isHost ? (
          <button
            className="btn-primary"
            onClick={onStartGame}
            disabled={participants.length < 2}
          >
            {participants.length < 2
              ? "Waiting for at least 2 players..."
              : "Start Game"}
          </button>
        ) : (
          <p className="waiting-text">Waiting for host to start the game...</p>
        )}
      </div>
    );
  }

  if (mode === "select") {
    return (
      <div className="lobby-select">
        <h1>draWG</h1>

        <div className="mode-buttons">
          <button className="btn-large" onClick={() => setMode("host")}>
            🎓 Host a Game
          </button>
          <button className="btn-large" onClick={() => setMode("join")}>
            🎮 Join a Game
          </button>
        </div>
      </div>
    );
  }

  if (mode === "host") {
    return (
      <div className="lobby-form">
        <button className="btn-back" onClick={() => setMode("select")}>
          ← Back
        </button>
        <h2>Host a Game</h2>
        <p className="host-description">
          Create a room and share the code with your players
        </p>
        <button
          className="btn-primary"
          onClick={handleCreateRoom}
          disabled={isLoading}
        >
          {isLoading ? "Creating..." : "Create Room"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="lobby-form">
      <button className="btn-back" onClick={() => setMode("select")}>
        ← Back
      </button>
      <h2>Join a Game</h2>
      <input
        type="text"
        placeholder="Room code"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        maxLength={4}
        className="room-input"
      />
      <input
        type="text"
        placeholder="Your name"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        maxLength={20}
      />
      <button
        className="btn-primary"
        onClick={handleJoinRoom}
        disabled={!playerName.trim() || roomCode.length !== 4 || isLoading}
      >
        {isLoading ? "Joining..." : "Join Room"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
