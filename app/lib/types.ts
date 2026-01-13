// Game Types
export type GamePhase = 
  | 'lobby' 
  | 'sentence_submission' 
  | 'quiz' 
  | 'drawing' 
  | 'slideshow' 
  | 'leaderboard';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  sentence?: string;
  quizScore: number;
  drawingDataUrl?: string;
  assignedSentence?: string;
  thumbsUp: number;
  thumbsDown: number;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
}

export type ToolType = 'pen' | 'eraser' | 'fill' | 'brush' | 'spray';

export interface DrawingTool {
  name: string;
  icon: string;
  color: string;
  size: number;
  type: ToolType;
  unlockThreshold: number; // number of correct answers needed
}

export interface GameState {
  phase: GamePhase;
  roomCode: string;
  players: Player[];
  currentQuestionIndex: number;
  quizAnswers: Record<string, number[]>; // playerId -> answers
  quizTimeRemaining: number;
  drawingTimeRemaining: number;
  currentSlideIndex: number;
  slideTimeRemaining: number;
  reactions: Record<string, { thumbsUp: string[]; thumbsDown: string[] }>; // playerId -> who reacted
}

// Message types for PeerJS communication
export type MessageType = 
  | 'player_joined'
  | 'player_left'
  | 'game_state_update'
  | 'submit_sentence'
  | 'submit_quiz_answer'
  | 'submit_drawing'
  | 'submit_reaction'
  | 'start_game'
  | 'start_quiz'
  | 'start_drawing'
  | 'start_slideshow'
  | 'end_game'
  | 'update_sentence'
  | 'request_sync';

export interface GameMessage {
  type: MessageType;
  payload: unknown;
  senderId: string;
}

// Initial drawing tools available to everyone
export const BASE_TOOLS: DrawingTool[] = [
  { name: 'Pencil', icon: '✏️', color: '#000000', size: 3, type: 'pen', unlockThreshold: 0 },
];

// Tools unlocked based on quiz performance (in order of unlock)
export const UNLOCKABLE_TOOLS: DrawingTool[] = [
  { name: 'Eraser', icon: '🧹', color: '#ffffff', size: 20, type: 'eraser', unlockThreshold: 1 },
  { name: 'Fill', icon: '🪣', color: '#000000', size: 0, type: 'fill', unlockThreshold: 2 },
  { name: 'Brush', icon: '🖌️', color: '#000000', size: 12, type: 'brush', unlockThreshold: 3 },
  { name: 'Fine Pen', icon: '🖊️', color: '#000000', size: 1, type: 'pen', unlockThreshold: 4 },
];

// Colors unlocked based on quiz performance
export interface UnlockableColor {
  name: string;
  color: string;
  unlockThreshold: number;
}

export const UNLOCKABLE_COLORS: UnlockableColor[] = [
  { name: 'Red', color: '#ef4444', unlockThreshold: 5 },
  { name: 'Blue', color: '#3b82f6', unlockThreshold: 6 },
  { name: 'Green', color: '#22c55e', unlockThreshold: 7 },
  { name: 'Yellow', color: '#eab308', unlockThreshold: 8 },
];

export function getUnlockedColors(quizScore: number): UnlockableColor[] {
  return UNLOCKABLE_COLORS.filter((c) => quizScore >= c.unlockThreshold);
}

// Hardcoded quiz questions
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correctIndex: 2,
  },
  {
    id: 2,
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correctIndex: 1,
  },
  {
    id: 3,
    question: "What is 7 × 8?",
    options: ["54", "56", "58", "64"],
    correctIndex: 1,
  },
  {
    id: 4,
    question: "Who painted the Mona Lisa?",
    options: ["Van Gogh", "Picasso", "Da Vinci", "Michelangelo"],
    correctIndex: 2,
  },
  {
    id: 5,
    question: "What is the largest ocean on Earth?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    correctIndex: 3,
  },
  {
    id: 6,
    question: "How many continents are there?",
    options: ["5", "6", "7", "8"],
    correctIndex: 2,
  },
  {
    id: 7,
    question: "What gas do plants absorb from the air?",
    options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"],
    correctIndex: 2,
  },
  {
    id: 8,
    question: "Which animal is known as the 'King of the Jungle'?",
    options: ["Tiger", "Elephant", "Lion", "Gorilla"],
    correctIndex: 2,
  },
];

export function getUnlockedTools(quizScore: number): DrawingTool[] {
  const tools = [...BASE_TOOLS];
  for (const tool of UNLOCKABLE_TOOLS) {
    if (quizScore >= tool.unlockThreshold) {
      tools.push(tool);
    }
  }
  return tools;
}

export const QUIZ_DURATION = 90; // 1 minute 30 seconds
export const DRAWING_DURATION = 120; // 2 minutes

export function createInitialGameState(roomCode: string): GameState {
  return {
    phase: 'lobby',
    roomCode,
    players: [],
    currentQuestionIndex: 0,
    quizAnswers: {},
    quizTimeRemaining: QUIZ_DURATION,
    drawingTimeRemaining: DRAWING_DURATION,
    currentSlideIndex: 0,
    slideTimeRemaining: 5,
    reactions: {},
  };
}
