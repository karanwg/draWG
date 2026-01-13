"use client";

import Peer, { DataConnection } from "peerjs";
import { GameMessage, GameState, Player } from "./types";

type MessageHandler = (message: GameMessage) => void;
type ConnectionHandler = (playerId: string) => void;

export class GameNetwork {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConnection: DataConnection | null = null;
  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  private disconnectionHandlers: ConnectionHandler[] = [];
  public playerId: string = "";
  public isHost: boolean = false;
  private roomCode: string = "";

  generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async createRoom(): Promise<string> {
    this.roomCode = this.generateRoomCode();
    this.isHost = true;
    
    return new Promise((resolve, reject) => {
      // Create peer with room code as ID (host)
      this.peer = new Peer(`drawg-host-${this.roomCode}`, {
        debug: 1,
      });

      this.peer.on("open", (id) => {
        this.playerId = id;
        console.log("Host peer opened with ID:", id);
        resolve(this.roomCode);
      });

      this.peer.on("connection", (conn) => {
        console.log("Player connecting:", conn.peer);
        this.setupConnection(conn);
      });

      this.peer.on("error", (err) => {
        console.error("Peer error:", err);
        reject(err);
      });
    });
  }

  async joinRoom(roomCode: string, playerName: string): Promise<string> {
    this.roomCode = roomCode.toUpperCase();
    this.isHost = false;

    return new Promise((resolve, reject) => {
      // Create peer with unique ID for player
      const playerId = `drawg-player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.peer = new Peer(playerId, {
        debug: 1,
      });

      this.peer.on("open", (id) => {
        this.playerId = id;
        console.log("Player peer opened with ID:", id);

        // Connect to host
        const hostId = `drawg-host-${this.roomCode}`;
        const conn = this.peer!.connect(hostId, {
          reliable: true,
          metadata: { playerName },
        });

        conn.on("open", () => {
          console.log("Connected to host");
          this.hostConnection = conn;
          this.setupConnection(conn);
          
          // Send join message
          this.send({
            type: "player_joined",
            payload: { playerName },
            senderId: this.playerId,
          });
          
          resolve(this.playerId);
        });

        conn.on("error", (err) => {
          console.error("Connection error:", err);
          reject(err);
        });
      });

      this.peer.on("error", (err) => {
        console.error("Peer error:", err);
        if (err.type === "peer-unavailable") {
          reject(new Error("Room not found. Please check the code."));
        } else {
          reject(err);
        }
      });
    });
  }

  private setupConnection(conn: DataConnection) {
    conn.on("open", () => {
      this.connections.set(conn.peer, conn);
      this.connectionHandlers.forEach((handler) => handler(conn.peer));
    });

    conn.on("data", (data) => {
      const message = data as GameMessage;
      this.messageHandlers.forEach((handler) => handler(message));
    });

    conn.on("close", () => {
      this.connections.delete(conn.peer);
      this.disconnectionHandlers.forEach((handler) => handler(conn.peer));
    });

    conn.on("error", (err) => {
      console.error("Connection error:", err);
    });
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  onConnection(handler: ConnectionHandler) {
    this.connectionHandlers.push(handler);
    return () => {
      this.connectionHandlers = this.connectionHandlers.filter((h) => h !== handler);
    };
  }

  onDisconnection(handler: ConnectionHandler) {
    this.disconnectionHandlers.push(handler);
    return () => {
      this.disconnectionHandlers = this.disconnectionHandlers.filter((h) => h !== handler);
    };
  }

  send(message: GameMessage) {
    if (this.isHost) {
      // Host broadcasts to all players
      this.connections.forEach((conn) => {
        if (conn.open) {
          conn.send(message);
        }
      });
    } else if (this.hostConnection?.open) {
      // Player sends to host
      this.hostConnection.send(message);
    }
  }

  sendToPlayer(playerId: string, message: GameMessage) {
    const conn = this.connections.get(playerId);
    if (conn?.open) {
      conn.send(message);
    }
  }

  broadcastGameState(state: GameState) {
    this.send({
      type: "game_state_update",
      payload: state,
      senderId: this.playerId,
    });
  }

  disconnect() {
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    this.hostConnection?.close();
    this.peer?.destroy();
    this.peer = null;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}

// Singleton instance
let networkInstance: GameNetwork | null = null;

export function getNetwork(): GameNetwork {
  if (!networkInstance) {
    networkInstance = new GameNetwork();
  }
  return networkInstance;
}

export function resetNetwork() {
  if (networkInstance) {
    networkInstance.disconnect();
    networkInstance = null;
  }
}
