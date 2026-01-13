"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { DrawingTool, GameState, getUnlockedTools, Player, ToolType } from "../lib/types";

interface DrawingCanvasProps {
  gameState: GameState;
  localPlayer: Player | null;
  isHost: boolean;
  onSubmitDrawing: (drawingDataUrl: string) => void;
  onUpdateTime: (time: number) => void;
  onStartSlideshow: () => void;
}

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

interface CanvasAction {
  type: 'stroke' | 'fill';
  points?: Point[];
  color: string;
  size: number;
  toolType: ToolType;
  fillX?: number;
  fillY?: number;
}

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
}

// Flood fill algorithm
function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string,
  width: number,
  height: number
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const fillRgb = hexToRgb(fillColor);
  const startIdx = (Math.floor(startY) * width + Math.floor(startX)) * 4;
  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];

  // Don't fill if clicking on the same color
  if (startR === fillRgb.r && startG === fillRgb.g && startB === fillRgb.b) {
    return;
  }

  const tolerance = 32;
  const matchesStart = (idx: number) => {
    return (
      Math.abs(data[idx] - startR) <= tolerance &&
      Math.abs(data[idx + 1] - startG) <= tolerance &&
      Math.abs(data[idx + 2] - startB) <= tolerance
    );
  };

  const stack: [number, number][] = [[Math.floor(startX), Math.floor(startY)]];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const key = `${x},${y}`;

    if (visited.has(key)) continue;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const idx = (y * width + x) * 4;
    if (!matchesStart(idx)) continue;

    visited.add(key);

    data[idx] = fillRgb.r;
    data[idx + 1] = fillRgb.g;
    data[idx + 2] = fillRgb.b;
    data[idx + 3] = 255;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  ctx.putImageData(imageData, 0, 0);
}

export function DrawingCanvas({
  gameState,
  localPlayer,
  isHost,
  onSubmitDrawing,
  onUpdateTime,
  onStartSlideshow,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [actions, setActions] = useState<CanvasAction[]>([]);
  const [currentAction, setCurrentAction] = useState<CanvasAction | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedTool, setSelectedTool] = useState<DrawingTool | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#000000');

  const unlockedTools = localPlayer ? getUnlockedTools(localPlayer.quizScore) : [];
  const participants = gameState.players.filter((p) => !p.isHost);

  // Get color tools for the color picker
  const colorTools = unlockedTools.filter(t => t.type === 'pen' && t.color !== '#000000');
  const hasColorOptions = colorTools.length > 0;

  // Set default tool
  useEffect(() => {
    if (!selectedTool && unlockedTools.length > 0) {
      setSelectedTool(unlockedTools[0]);
    }
  }, [unlockedTools, selectedTool]);

  // Timer countdown (host controls)
  useEffect(() => {
    if (!isHost) return;
    if (gameState.drawingTimeRemaining <= 0) return;

    const interval = setInterval(() => {
      onUpdateTime(gameState.drawingTimeRemaining - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isHost, gameState.drawingTimeRemaining, onUpdateTime]);

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all actions
    const allActions = currentAction ? [...actions, currentAction] : actions;

    for (const action of allActions) {
      if (action.type === 'fill' && action.fillX !== undefined && action.fillY !== undefined) {
        floodFill(ctx, action.fillX, action.fillY, action.color, canvas.width, canvas.height);
      } else if (action.type === 'stroke' && action.points) {
        const strokeOptions = action.toolType === 'brush' 
          ? { size: action.size, thinning: 0, smoothing: 0.7, streamline: 0.7 }
          : { size: action.size, thinning: 0.5, smoothing: 0.5, streamline: 0.5 };

        const outlinePoints = getStroke(
          action.points.map((p) => [p.x, p.y, p.pressure || 0.5]),
          strokeOptions
        );

        const pathData = getSvgPathFromStroke(outlinePoints);
        const path = new Path2D(pathData);
        ctx.fillStyle = action.color;
        ctx.fill(path);
      }
    }
  }, [actions, currentAction]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const getPointerPos = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure,
    };
  };

  const getToolColor = (tool: DrawingTool): string => {
    // Eraser is always white
    if (tool.type === 'eraser') {
      return '#ffffff';
    }
    // Pen, brush, and fill tools use selected color
    if (tool.type === 'pen' || tool.type === 'brush' || tool.type === 'fill') {
      return selectedColor;
    }
    return tool.color;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (hasSubmitted || !selectedTool) return;
    e.preventDefault();
    
    const point = getPointerPos(e);
    const color = getToolColor(selectedTool);

    if (selectedTool.type === 'fill') {
      // Immediate fill action
      const fillAction: CanvasAction = {
        type: 'fill',
        color,
        size: 0,
        toolType: 'fill',
        fillX: point.x,
        fillY: point.y,
      };
      setActions((prev) => [...prev, fillAction]);
    } else {
      // Start stroke
      setIsDrawing(true);
      setCurrentAction({
        type: 'stroke',
        points: [point],
        color,
        size: selectedTool.size,
        toolType: selectedTool.type,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !currentAction || currentAction.type !== 'stroke') return;
    e.preventDefault();
    const point = getPointerPos(e);
    setCurrentAction({
      ...currentAction,
      points: [...(currentAction.points || []), point],
    });
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentAction) return;
    setIsDrawing(false);
    setActions((prev) => [...prev, currentAction]);
    setCurrentAction(null);
  };

  const handleClear = () => {
    setActions([]);
    setCurrentAction(null);
  };

  const handleUndo = () => {
    setActions((prev) => prev.slice(0, -1));
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL("image/png");
    onSubmitDrawing(dataUrl);
    setHasSubmitted(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const allPlayersSubmitted = participants.every((p) => p.drawingDataUrl);

  // Host sees moderation view
  if (isHost) {
    return (
      <div className="drawing-phase">
        <div className="drawing-header">
          <h2>🎨 Drawing in Progress</h2>
          <div className={`timer ${gameState.drawingTimeRemaining <= 30 ? "warning" : ""}`}>
            ⏱️ {formatTime(gameState.drawingTimeRemaining)}
          </div>
        </div>

        <div className="host-drawing-view">
          <div className="progress-overview">
            <h3>Player Progress</h3>
            <div className="player-progress-list">
              {participants.map((player) => (
                <div key={player.id} className="player-progress-item drawing">
                  <span className="player-name">{player.name}</span>
                  <span className="prompt-preview">
                    "{player.assignedSentence}"
                  </span>
                  <span className={`status ${player.drawingDataUrl ? "done" : "drawing"}`}>
                    {player.drawingDataUrl ? "✅ Submitted" : "🎨 Drawing..."}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="submission-stats">
            <div className="stat">
              <span className="stat-number">
                {participants.filter((p) => p.drawingDataUrl).length}
              </span>
              <span className="stat-label">Submitted</span>
            </div>
            <div className="stat">
              <span className="stat-number">
                {participants.filter((p) => !p.drawingDataUrl).length}
              </span>
              <span className="stat-label">Still Drawing</span>
            </div>
          </div>

          <div className="host-controls">
            <button
              className="btn-primary"
              onClick={onStartSlideshow}
              disabled={!allPlayersSubmitted && gameState.drawingTimeRemaining > 0}
            >
              {allPlayersSubmitted
                ? "Start Slideshow 🖼️"
                : gameState.drawingTimeRemaining <= 0
                ? "Time's Up! Start Slideshow 🖼️"
                : `Waiting for drawings... (${formatTime(gameState.drawingTimeRemaining)})`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Player drawing view
  return (
    <div className="drawing-phase">
      <div className="drawing-header">
        <h2>🎨 Time to Draw!</h2>
        <div className={`timer ${gameState.drawingTimeRemaining <= 30 ? "warning" : ""}`}>
          ⏱️ {formatTime(gameState.drawingTimeRemaining)}
        </div>
      </div>

      {localPlayer?.assignedSentence && (
        <div className="prompt">
          <p>Draw this:</p>
          <h3>"{localPlayer.assignedSentence}"</h3>
        </div>
      )}

      <div className="drawing-area">
        <div className="toolbar">
          <div className="tools">
            {unlockedTools.map((tool, index) => (
              <button
                key={index}
                className={`tool ${selectedTool === tool ? "active" : ""} ${tool.type}`}
                onClick={() => setSelectedTool(tool)}
                title={tool.name}
                disabled={hasSubmitted}
              >
                <span className="tool-icon">{tool.icon}</span>
              </button>
            ))}
          </div>

          {/* Color picker for pen/brush/fill tools (not eraser) */}
          {hasColorOptions && selectedTool && selectedTool.type !== 'eraser' && (
            <div className="color-picker">
              <button
                className={`color-btn ${selectedColor === '#000000' ? 'active' : ''}`}
                onClick={() => setSelectedColor('#000000')}
                disabled={hasSubmitted}
              >
                <span className="color-dot" style={{ backgroundColor: '#000000' }} />
              </button>
              {colorTools.map((tool, index) => (
                <button
                  key={index}
                  className={`color-btn ${selectedColor === tool.color ? 'active' : ''}`}
                  onClick={() => setSelectedColor(tool.color)}
                  disabled={hasSubmitted}
                >
                  <span className="color-dot" style={{ backgroundColor: tool.color }} />
                </button>
              ))}
            </div>
          )}

          <div className="actions">
            <button onClick={handleUndo} disabled={actions.length === 0 || hasSubmitted}>
              ↩️ Undo
            </button>
            <button onClick={handleClear} disabled={actions.length === 0 || hasSubmitted}>
              🗑️ Clear
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className={`canvas ${selectedTool?.type === 'fill' ? 'fill-cursor' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: "none", opacity: hasSubmitted ? 0.7 : 1 }}
        />

        {!hasSubmitted ? (
          <button className="btn-primary" onClick={handleSubmit}>
            ✅ Submit Drawing
          </button>
        ) : (
          <div className="submitted-text">
            <p>Drawing submitted! ✅</p>
            <p className="waiting-text">Waiting for other players...</p>
          </div>
        )}
      </div>
    </div>
  );
}
