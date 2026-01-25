/**
 * Multiplayer Types - Client-side types for WebSocket multiplayer
 * Re-exports server protocol types and adds client-specific types
 */

// Re-export all protocol types from server
// Note: We duplicate these here to avoid cross-package imports in the browser
// These MUST stay in sync with server/src/protocol.ts

import type { GameState, PlayerAction, TurnActions } from '../../../engine/src';

// ============================================================================
// Client → Server Messages
// ============================================================================

export interface CreateRoomMessage {
  type: 'CREATE_ROOM';
  displayName: string;
  timerSeconds?: number;
}

export interface JoinRoomMessage {
  type: 'JOIN_ROOM';
  roomCode: string;
  displayName: string;
}

export interface ReadyMessage {
  type: 'READY';
}

export interface ActionMessage {
  type: 'ACTION';
  turn: number;
  action: PlayerAction;
}

export interface LeaveMessage {
  type: 'LEAVE';
}

export interface ReconnectMessage {
  type: 'RECONNECT';
  roomCode: string;
  playerId: string;
}

export type ClientMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | ReadyMessage
  | ActionMessage
  | LeaveMessage
  | ReconnectMessage;

// ============================================================================
// Server → Client Messages
// ============================================================================

export interface RoomCreatedMessage {
  type: 'ROOM_CREATED';
  roomCode: string;
  playerId: string;
}

export interface RoomJoinedMessage {
  type: 'ROOM_JOINED';
  playerId: string;
  opponent: { displayName: string };
  timerSeconds: number;
}

export interface PlayerJoinedMessage {
  type: 'PLAYER_JOINED';
  opponent: { displayName: string };
}

export interface PlayerReadyMessage {
  type: 'PLAYER_READY';
  playerId: string;
}

export interface GameStartMessage {
  type: 'GAME_START';
  seed: number;
  yourRole: 'player1' | 'player2';
  turnDeadline: number;
  initialState: GameState;
}

export interface ActionAckMessage {
  type: 'ACTION_ACK';
  turn: number;
}

export interface OpponentReadyMessage {
  type: 'OPPONENT_READY';
  turn: number;
}

export interface TurnResolvedMessage {
  type: 'TURN_RESOLVED';
  turn: number;
  actions: TurnActions;
  newState: GameState;
  nextTurnDeadline: number | null;
}

export interface GameOverMessage {
  type: 'GAME_OVER';
  winner: 'player1' | 'player2' | null;
  finalState: GameState;
  replayId: string;
}

export interface StateSyncMessage {
  type: 'STATE_SYNC';
  gameState: GameState;
  turn: number;
  pending: {
    player1: boolean;
    player2: boolean;
  };
  turnDeadline: number;
}

export interface ErrorMessage {
  type: 'ERROR';
  code: ErrorCode;
  message: string;
}

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_EXPIRED'
  | 'ALREADY_SUBMITTED'
  | 'ALREADY_PLAYING'
  | 'TURN_EXPIRED'
  | 'INVALID_TURN'
  | 'INVALID_ACTION'
  | 'NOT_IN_ROOM'
  | 'MATCH_NOT_FOUND'
  | 'MATCH_NOT_ACTIVE'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR';

export type ServerMessage =
  | RoomCreatedMessage
  | RoomJoinedMessage
  | PlayerJoinedMessage
  | PlayerReadyMessage
  | GameStartMessage
  | ActionAckMessage
  | OpponentReadyMessage
  | TurnResolvedMessage
  | GameOverMessage
  | StateSyncMessage
  | ErrorMessage;

// ============================================================================
// Client-Specific Types
// ============================================================================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export type LobbyPhase = 
  | 'menu'           // Choose create or join
  | 'creating'       // Entering display name for create
  | 'joining'        // Entering room code + display name
  | 'waiting'        // Created room, waiting for opponent
  | 'lobby'          // Both players present, ready phase
  | 'starting';      // Both ready, waiting for GAME_START

export interface MultiplayerState {
  // Connection
  connectionState: ConnectionState;
  
  // Room/Lobby
  phase: LobbyPhase;
  roomCode: string | null;
  playerId: string | null;
  myRole: 'player1' | 'player2' | null;
  myDisplayName: string;
  opponent: { displayName: string } | null;
  myReady: boolean;
  opponentReady: boolean;
  timerSeconds: number;
  
  // Game
  gameState: GameState | null;
  turnDeadline: number | null;
  submittingAction: boolean;        // True while awaiting ACTION_ACK
  submittingStartTime: number | null; // Timestamp when submit started
  actionSubmitted: boolean;         // True after ACTION_ACK received
  opponentSubmittedThisTurn: boolean;
  lastResolvedTurn: TurnActions | null;
  
  // Results
  winner: 'player1' | 'player2' | null;
  replayId: string | null;
  
  // Errors
  error: { code: ErrorCode; message: string } | null;
}

export const initialMultiplayerState: MultiplayerState = {
  connectionState: 'disconnected',
  phase: 'menu',
  roomCode: null,
  playerId: null,
  myRole: null,
  myDisplayName: '',
  opponent: null,
  myReady: false,
  opponentReady: false,
  timerSeconds: 30,
  gameState: null,
  turnDeadline: null,
  submittingAction: false,
  submittingStartTime: null,
  actionSubmitted: false,
  opponentSubmittedThisTurn: false,
  lastResolvedTurn: null,
  winner: null,
  replayId: null,
  error: null,
};
