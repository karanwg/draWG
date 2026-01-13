"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameNetwork, getNetwork, resetNetwork } from "./networking";
import {
  createInitialGameState,
  DRAWING_DURATION,
  GameMessage,
  GameState,
  Player,
  QUIZ_DURATION,
  QUIZ_QUESTIONS,
} from "./types";

export function useGameState() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const networkRef = useRef<GameNetwork | null>(null);

  // Initialize network
  useEffect(() => {
    networkRef.current = getNetwork();
    return () => {
      // Don't reset on unmount as we want to persist the connection
    };
  }, []);

  const handleMessage = useCallback(
    (message: GameMessage) => {
      const network = networkRef.current;
      if (!network) return;

      console.log("Received message:", message.type, message.payload);

      if (network.isHost) {
        // Host handles all game logic
        setGameState((prevState) => {
          if (!prevState) return prevState;
          let newState = { ...prevState };

          switch (message.type) {
            case "player_joined": {
              const { playerName } = message.payload as { playerName: string };
              const newPlayer: Player = {
                id: message.senderId,
                name: playerName,
                isHost: false,
                quizScore: 0,
                thumbsUp: 0,
                thumbsDown: 0,
              };
              newState.players = [...prevState.players, newPlayer];
              break;
            }

            case "submit_sentence": {
              const { sentence } = message.payload as { sentence: string };
              newState.players = prevState.players.map((p) =>
                p.id === message.senderId ? { ...p, sentence } : p
              );
              break;
            }

            case "submit_quiz_answer": {
              const { questionIndex, answerIndex } = message.payload as {
                questionIndex: number;
                answerIndex: number;
              };
              const playerAnswers = prevState.quizAnswers[message.senderId] || [];
              playerAnswers[questionIndex] = answerIndex;
              newState.quizAnswers = {
                ...prevState.quizAnswers,
                [message.senderId]: playerAnswers,
              };

              // Calculate score
              let score = 0;
              playerAnswers.forEach((answer, idx) => {
                if (answer === QUIZ_QUESTIONS[idx]?.correctIndex) {
                  score++;
                }
              });
              newState.players = prevState.players.map((p) =>
                p.id === message.senderId ? { ...p, quizScore: score } : p
              );
              break;
            }

            case "submit_drawing": {
              const { drawingDataUrl } = message.payload as {
                drawingDataUrl: string;
              };
              newState.players = prevState.players.map((p) =>
                p.id === message.senderId ? { ...p, drawingDataUrl } : p
              );
              break;
            }

            case "submit_reaction": {
              const { targetPlayerId, reactionType } = message.payload as {
                targetPlayerId: string;
                reactionType: "thumbsUp" | "thumbsDown";
              };
              const reactions = prevState.reactions[targetPlayerId] || {
                thumbsUp: [],
                thumbsDown: [],
              };

              // Remove previous reaction from this player
              reactions.thumbsUp = reactions.thumbsUp.filter(
                (id) => id !== message.senderId
              );
              reactions.thumbsDown = reactions.thumbsDown.filter(
                (id) => id !== message.senderId
              );

              // Add new reaction
              reactions[reactionType].push(message.senderId);

              newState.reactions = {
                ...prevState.reactions,
                [targetPlayerId]: reactions,
              };

              // Update player thumbs counts
              newState.players = prevState.players.map((p) => {
                if (p.id === targetPlayerId) {
                  const r = newState.reactions[p.id] || {
                    thumbsUp: [],
                    thumbsDown: [],
                  };
                  return {
                    ...p,
                    thumbsUp: r.thumbsUp.length,
                    thumbsDown: r.thumbsDown.length,
                  };
                }
                return p;
              });
              break;
            }

            case "request_sync": {
              // Send current state to the requesting player
              network.sendToPlayer(message.senderId, {
                type: "game_state_update",
                payload: prevState,
                senderId: network.playerId,
              });
              return prevState;
            }
          }

          // Broadcast updated state to all players
          network.broadcastGameState(newState);
          return newState;
        });
      } else {
        // Player receives state updates from host
        if (message.type === "game_state_update") {
          const newState = message.payload as GameState;
          setGameState(newState);

          // Update local player
          const player = newState.players.find(
            (p) => p.id === network.playerId
          );
          if (player) {
            setLocalPlayer(player);
          }
        }
      }
    },
    []
  );

  const createRoom = useCallback(async (hostName: string) => {
    try {
      resetNetwork();
      const network = getNetwork();
      networkRef.current = network;

      const roomCode = await network.createRoom();

      const host: Player = {
        id: network.playerId,
        name: hostName,
        isHost: true,
        quizScore: 0,
        thumbsUp: 0,
        thumbsDown: 0,
      };

      const initialState = createInitialGameState(roomCode);
      initialState.players = [host];

      setGameState(initialState);
      setLocalPlayer(host);
      setIsConnected(true);

      network.onMessage(handleMessage);

      network.onConnection((playerId) => {
        console.log("Player connected:", playerId);
      });

      network.onDisconnection((playerId) => {
        setGameState((prev) => {
          if (!prev) return prev;
          const newState = {
            ...prev,
            players: prev.players.filter((p) => p.id !== playerId),
          };
          network.broadcastGameState(newState);
          return newState;
        });
      });

      return roomCode;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      throw err;
    }
  }, [handleMessage]);

  const joinRoom = useCallback(
    async (roomCode: string, playerName: string) => {
      try {
        resetNetwork();
        const network = getNetwork();
        networkRef.current = network;

        await network.joinRoom(roomCode, playerName);
        setIsConnected(true);

        network.onMessage(handleMessage);

        // Request current state
        network.send({
          type: "request_sync",
          payload: {},
          senderId: network.playerId,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to join room");
        throw err;
      }
    },
    [handleMessage]
  );

  const submitSentence = useCallback((sentence: string) => {
    const network = networkRef.current;
    if (!network) return;

    if (network.isHost) {
      setGameState((prev) => {
        if (!prev) return prev;
        const newState = {
          ...prev,
          players: prev.players.map((p) =>
            p.id === network.playerId ? { ...p, sentence } : p
          ),
        };
        network.broadcastGameState(newState);
        return newState;
      });
      setLocalPlayer((prev) => (prev ? { ...prev, sentence } : prev));
    } else {
      network.send({
        type: "submit_sentence",
        payload: { sentence },
        senderId: network.playerId,
      });
    }
  }, []);

  const submitQuizAnswer = useCallback(
    (questionIndex: number, answerIndex: number) => {
      const network = networkRef.current;
      if (!network) return;

      if (network.isHost) {
        setGameState((prev) => {
          if (!prev) return prev;
          const playerAnswers = prev.quizAnswers[network.playerId] || [];
          playerAnswers[questionIndex] = answerIndex;

          let score = 0;
          playerAnswers.forEach((answer, idx) => {
            if (answer === QUIZ_QUESTIONS[idx]?.correctIndex) {
              score++;
            }
          });

          const newState = {
            ...prev,
            quizAnswers: {
              ...prev.quizAnswers,
              [network.playerId]: playerAnswers,
            },
            players: prev.players.map((p) =>
              p.id === network.playerId ? { ...p, quizScore: score } : p
            ),
          };
          network.broadcastGameState(newState);
          return newState;
        });
        setLocalPlayer((prev) => {
          if (!prev) return prev;
          const answers = gameState?.quizAnswers[network.playerId] || [];
          answers[questionIndex] = answerIndex;
          let score = 0;
          answers.forEach((answer, idx) => {
            if (answer === QUIZ_QUESTIONS[idx]?.correctIndex) {
              score++;
            }
          });
          return { ...prev, quizScore: score };
        });
      } else {
        network.send({
          type: "submit_quiz_answer",
          payload: { questionIndex, answerIndex },
          senderId: network.playerId,
        });
      }
    },
    [gameState]
  );

  const submitDrawing = useCallback((drawingDataUrl: string) => {
    const network = networkRef.current;
    if (!network) return;

    if (network.isHost) {
      setGameState((prev) => {
        if (!prev) return prev;
        const newState = {
          ...prev,
          players: prev.players.map((p) =>
            p.id === network.playerId ? { ...p, drawingDataUrl } : p
          ),
        };
        network.broadcastGameState(newState);
        return newState;
      });
      setLocalPlayer((prev) => (prev ? { ...prev, drawingDataUrl } : prev));
    } else {
      network.send({
        type: "submit_drawing",
        payload: { drawingDataUrl },
        senderId: network.playerId,
      });
    }
  }, []);

  const submitReaction = useCallback(
    (targetPlayerId: string, reactionType: "thumbsUp" | "thumbsDown") => {
      const network = networkRef.current;
      if (!network) return;

      if (network.isHost) {
        setGameState((prev) => {
          if (!prev) return prev;
          const reactions = prev.reactions[targetPlayerId] || {
            thumbsUp: [],
            thumbsDown: [],
          };

          // Remove previous reaction from this player
          reactions.thumbsUp = reactions.thumbsUp.filter(
            (id) => id !== network.playerId
          );
          reactions.thumbsDown = reactions.thumbsDown.filter(
            (id) => id !== network.playerId
          );

          // Add new reaction
          reactions[reactionType].push(network.playerId);

          const newReactions = {
            ...prev.reactions,
            [targetPlayerId]: reactions,
          };

          const newState = {
            ...prev,
            reactions: newReactions,
            players: prev.players.map((p) => {
              if (p.id === targetPlayerId) {
                const r = newReactions[p.id] || {
                  thumbsUp: [],
                  thumbsDown: [],
                };
                return {
                  ...p,
                  thumbsUp: r.thumbsUp.length,
                  thumbsDown: r.thumbsDown.length,
                };
              }
              return p;
            }),
          };
          network.broadcastGameState(newState);
          return newState;
        });
      } else {
        network.send({
          type: "submit_reaction",
          payload: { targetPlayerId, reactionType },
          senderId: network.playerId,
        });
      }
    },
    []
  );

  // Host-only actions
  const startSentenceSubmission = useCallback(() => {
    const network = networkRef.current;
    if (!network?.isHost || !gameState) return;

    const newState: GameState = {
      ...gameState,
      phase: "sentence_submission",
    };
    setGameState(newState);
    network.broadcastGameState(newState);
  }, [gameState]);

  const updatePlayerSentence = useCallback(
    (playerId: string, sentence: string) => {
      const network = networkRef.current;
      if (!network?.isHost || !gameState) return;

      const newState: GameState = {
        ...gameState,
        players: gameState.players.map((p) =>
          p.id === playerId ? { ...p, sentence } : p
        ),
      };
      setGameState(newState);
      network.broadcastGameState(newState);
    },
    [gameState]
  );

  const startQuiz = useCallback(() => {
    const network = networkRef.current;
    if (!network?.isHost || !gameState) return;

    const newState: GameState = {
      ...gameState,
      phase: "quiz",
      currentQuestionIndex: 0,
      quizTimeRemaining: QUIZ_DURATION,
    };
    setGameState(newState);
    network.broadcastGameState(newState);
  }, [gameState]);

  const updateQuizTime = useCallback((time: number) => {
    const network = networkRef.current;
    if (!network?.isHost) return;

    setGameState((prev) => {
      if (!prev) return prev;
      const newState = { ...prev, quizTimeRemaining: time };
      network.broadcastGameState(newState);
      return newState;
    });
  }, []);

  const nextQuestion = useCallback(() => {
    const network = networkRef.current;
    if (!network?.isHost || !gameState) return;

    const newIndex = gameState.currentQuestionIndex + 1;
    if (newIndex >= QUIZ_QUESTIONS.length) {
      // Quiz is over, start drawing phase
      startDrawingPhase();
    } else {
      const newState: GameState = {
        ...gameState,
        currentQuestionIndex: newIndex,
      };
      setGameState(newState);
      network.broadcastGameState(newState);
    }
  }, [gameState]);

  const startDrawingPhase = useCallback(() => {
    const network = networkRef.current;
    if (!network?.isHost || !gameState) return;

    // Only participants (non-host) get sentences assigned
    const participants = gameState.players.filter((p) => !p.isHost);
    const playersWithSentences = participants.filter((p) => p.sentence);
    
    // Create a derangement (permutation where no element is in its original position)
    // This guarantees no player gets their own sentence
    const createDerangement = (items: { sentence: string; authorId: string }[]) => {
      if (items.length < 2) return items;
      
      const result = [...items];
      let isDerangement = false;
      
      // Keep shuffling until we get a valid derangement
      let attempts = 0;
      while (!isDerangement && attempts < 100) {
        // Fisher-Yates shuffle
        for (let i = result.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [result[i], result[j]] = [result[j], result[i]];
        }
        
        // Check if it's a valid derangement (no one in original position)
        isDerangement = result.every((item, index) => item.authorId !== items[index].authorId);
        attempts++;
      }
      
      // If we couldn't find a derangement after 100 attempts (very unlikely),
      // just do a simple rotation which guarantees no one gets their own
      if (!isDerangement) {
        const rotated = [...items];
        rotated.push(rotated.shift()!);
        return rotated;
      }
      
      return result;
    };

    const sentences = playersWithSentences.map((p) => ({
      sentence: p.sentence!,
      authorId: p.id,
    }));

    // Create deranged assignment
    const derangedSentences = createDerangement(sentences);

    // Assign sentences to participants
    const assignments: Record<string, string> = {};
    participants.forEach((player, index) => {
      // Use deranged sentence at this index
      const assignedSentence = derangedSentences[index % derangedSentences.length];
      assignments[player.id] = assignedSentence.sentence;
    });

    const newState: GameState = {
      ...gameState,
      phase: "drawing",
      drawingTimeRemaining: DRAWING_DURATION,
      players: gameState.players.map((p) => ({
        ...p,
        assignedSentence: p.isHost ? undefined : assignments[p.id],
      })),
    };
    setGameState(newState);
    setLocalPlayer((prev) =>
      prev ? { ...prev, assignedSentence: prev.isHost ? undefined : assignments[prev.id] } : prev
    );
    network.broadcastGameState(newState);
  }, [gameState]);

  const updateDrawingTime = useCallback((time: number) => {
    const network = networkRef.current;
    if (!network?.isHost) return;

    setGameState((prev) => {
      if (!prev) return prev;
      const newState = { ...prev, drawingTimeRemaining: time };
      network.broadcastGameState(newState);
      return newState;
    });
  }, []);

  const startSlideshow = useCallback(() => {
    const network = networkRef.current;
    if (!network?.isHost || !gameState) return;

    const newState: GameState = {
      ...gameState,
      phase: "slideshow",
      currentSlideIndex: 0,
      slideTimeRemaining: 5,
    };
    setGameState(newState);
    network.broadcastGameState(newState);
  }, [gameState]);

  const updateSlideTime = useCallback((time: number) => {
    const network = networkRef.current;
    if (!network?.isHost || !gameState) return;

    const newState: GameState = {
      ...gameState,
      slideTimeRemaining: time,
    };
    setGameState(newState);
    network.broadcastGameState(newState);
  }, [gameState]);

  const nextSlide = useCallback(() => {
    const network = networkRef.current;
    if (!network?.isHost || !gameState) return;

    // Filter out host - only count participant drawings
    const playersWithDrawings = gameState.players.filter(
      (p) => !p.isHost && p.drawingDataUrl
    );
    const newIndex = gameState.currentSlideIndex + 1;

    if (newIndex >= playersWithDrawings.length) {
      // Slideshow is over, show leaderboard
      const newState: GameState = {
        ...gameState,
        phase: "leaderboard",
      };
      setGameState(newState);
      network.broadcastGameState(newState);
    } else {
      const newState: GameState = {
        ...gameState,
        currentSlideIndex: newIndex,
        slideTimeRemaining: 5, // Reset timer for new slide
      };
      setGameState(newState);
      network.broadcastGameState(newState);
    }
  }, [gameState]);

  const resetGame = useCallback(() => {
    const network = networkRef.current;
    if (!network?.isHost || !gameState) return;

    const newState: GameState = {
      ...gameState,
      phase: "lobby",
      currentQuestionIndex: 0,
      quizAnswers: {},
      quizTimeRemaining: QUIZ_DURATION,
      drawingTimeRemaining: DRAWING_DURATION,
      currentSlideIndex: 0,
      slideTimeRemaining: 5,
      reactions: {},
      players: gameState.players.map((p) => ({
        ...p,
        sentence: undefined,
        quizScore: 0,
        drawingDataUrl: undefined,
        assignedSentence: undefined,
        thumbsUp: 0,
        thumbsDown: 0,
      })),
    };
    setGameState(newState);
    network.broadcastGameState(newState);
  }, [gameState]);

  return {
    gameState,
    localPlayer,
    isConnected,
    error,
    isHost: networkRef.current?.isHost ?? false,
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
    nextQuestion,
    startDrawingPhase,
    updateDrawingTime,
    startSlideshow,
    updateSlideTime,
    nextSlide,
    resetGame,
  };
}
