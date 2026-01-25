/**
 * Seque Server - Message Protocol
 * All message types between client and server
 */

import type { GameState, PlayerAction, TurnActions } from '../engine/src';

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
  nextTurnDeadline: number | null; // null if game over
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
