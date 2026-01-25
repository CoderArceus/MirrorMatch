/**
 * Seque Server - Match & Turn Logic
 * Handles match creation, action submission, turn resolution
 */

import { randomInt } from 'crypto';
import type { GameState, PlayerAction, TurnActions } from '../../engine/src';
import { createInitialGameState, resolveTurn, getLegalActions, isActionLegal } from '../../engine/src';
import { log } from './logger.js';
import {
  assertHistoryInvariant,
  assertGameActive,
  assertCanonicalOrder,
  assertCorrectTurn,
} from './validators.js';
import { getRoom, setRoomStatus, type Room, type Player } from './rooms.js';
import {
  setTurnTimer,
  clearTurnTimer,
  getTurnDeadline,
  isBeforeDeadline,
  cleanupRoomTimers,
} from './timers.js';

// ============================================================================
// Types
// ============================================================================

export interface Match {
  roomCode: string;
  seed: number;
  gameState: GameState;
  turnNumber: number;
  turnStartedAt: number;
  turnDeadline: number;
  pendingActions: {
    player1: PlayerAction | null;
    player2: PlayerAction | null;
  };
  history: TurnActions[];
  status: 'active' | 'finished';
  winner: 'player1' | 'player2' | null;
  replayId: string;
}

// ============================================================================
// Storage
// ============================================================================

const matches = new Map<string, Match>();

// ============================================================================
// Match Creation
// ============================================================================

export interface CreateMatchResult {
  success: true;
  match: Match;
}

export function createMatch(
  room: Room,
  onTurnTimeout: (roomCode: string) => void
): CreateMatchResult {
  // Generate seed (32-bit integer)
  const seed = randomInt(0, 2 ** 32);
  
  // Initialize game state using engine
  const gameState = createInitialGameState(seed);
  
  const now = Date.now();
  
  // Set turn timer
  const turnDeadline = setTurnTimer(
    room.roomCode,
    1,
    room.turnTimerSeconds,
    () => onTurnTimeout(room.roomCode)
  );
  
  // Generate replay ID
  const replayId = `r_${room.roomCode}_${seed.toString(36)}`;
  
  const match: Match = {
    roomCode: room.roomCode,
    seed,
    gameState,
    turnNumber: 1,
    turnStartedAt: now,
    turnDeadline,
    pendingActions: {
      player1: null,
      player2: null,
    },
    history: [],
    status: 'active',
    winner: null,
    replayId,
  };
  
  matches.set(room.roomCode, match);
  setRoomStatus(room.roomCode, 'playing');
  
  log('game_started', {
    roomCode: room.roomCode,
    seed,
    timerSeconds: room.turnTimerSeconds,
  });
  
  return { success: true, match };
}

// ============================================================================
// Action Submission
// ============================================================================

export type SubmitActionResult =
  | { success: true; match: Match; bothSubmitted: boolean }
  | { success: false; error: 'MATCH_NOT_FOUND' | 'MATCH_NOT_ACTIVE' | 'INVALID_TURN' | 'TURN_EXPIRED' | 'ALREADY_SUBMITTED' | 'INVALID_ACTION' };

export function submitAction(
  roomCode: string,
  playerId: string,
  role: 'player1' | 'player2',
  turn: number,
  action: PlayerAction
): SubmitActionResult {
  const match = matches.get(roomCode);
  
  if (!match) {
    return { success: false, error: 'MATCH_NOT_FOUND' };
  }
  
  if (match.status !== 'active') {
    return { success: false, error: 'MATCH_NOT_ACTIVE' };
  }
  
  // Validate turn number
  if (turn !== match.turnNumber) {
    log('action_rejected', {
      roomCode,
      playerId,
      turn,
      reason: 'INVALID_TURN',
      expected: match.turnNumber,
    });
    return { success: false, error: 'INVALID_TURN' };
  }
  
  // Check deadline (server-authoritative)
  if (!isBeforeDeadline(roomCode)) {
    log('action_rejected', {
      roomCode,
      playerId,
      turn,
      reason: 'TURN_EXPIRED',
    });
    return { success: false, error: 'TURN_EXPIRED' };
  }
  
  // Check if already submitted
  if (match.pendingActions[role] !== null) {
    log('action_rejected', {
      roomCode,
      playerId,
      turn,
      reason: 'ALREADY_SUBMITTED',
    });
    return { success: false, error: 'ALREADY_SUBMITTED' };
  }
  
  // Validate action legality using engine
  if (!isActionLegal(match.gameState, role, action)) {
    log('action_rejected', {
      roomCode,
      playerId,
      turn,
      reason: 'INVALID_ACTION',
      action,
    });
    return { success: false, error: 'INVALID_ACTION' };
  }
  
  // Store action
  match.pendingActions[role] = action;
  
  log('action_received', {
    roomCode,
    playerId,
    turn,
    role,
    actionType: action.type,
  });
  
  // Check if both submitted
  const bothSubmitted = match.pendingActions.player1 !== null && match.pendingActions.player2 !== null;
  
  return { success: true, match, bothSubmitted };
}

// ============================================================================
// Turn Resolution
// ============================================================================

/**
 * Deterministic fallback action for timeout
 * First legal action in canonical order
 */
function getTimeoutFallbackAction(gameState: GameState, role: 'player1' | 'player2'): PlayerAction {
  const legalActions = getLegalActions(gameState, role);
  
  // Canonical order is enforced by getLegalActions return order
  // Order: take[0-2], burn, stand[0-2], blind_hit[0-2], pass
  if (legalActions.length === 0) {
    // Should never happen, but fallback to pass
    return { type: 'pass' };
  }
  
  return legalActions[0];
}

/**
 * Deterministic fallback for auction timeout
 */
function getAuctionTimeoutFallback(gameState: GameState, role: 'player1' | 'player2'): PlayerAction {
  const player = gameState.players[role === 'player1' ? 0 : 1];
  
  // Find first valid lane (not already shackled)
  let voidLane = 0;
  for (let i = 0; i < player.lanes.length; i++) {
    if (!player.lanes[i].hasBeenShackled) {
      voidLane = i;
      break;
    }
  }
  
  return {
    type: 'bid',
    bidAmount: 0,
    potentialVoidStoneLane: voidLane,
  };
}

export interface ResolveTurnResult {
  success: true;
  match: Match;
  turnActions: TurnActions;
  gameOver: boolean;
}

export function resolveTurnNow(
  roomCode: string,
  onTurnTimeout: (roomCode: string) => void
): ResolveTurnResult | null {
  const match = matches.get(roomCode);
  const room = getRoom(roomCode);
  
  if (!match || !room || match.status !== 'active') {
    return null;
  }
  
  // Assert game is still active
  assertGameActive(match.gameState, roomCode);
  
  // Get or generate actions
  let p1Action = match.pendingActions.player1;
  let p2Action = match.pendingActions.player2;
  
  const isAuctionTurn = [4, 8].includes(match.turnNumber);
  
  // Fill in missing actions with deterministic fallbacks
  if (p1Action === null) {
    p1Action = isAuctionTurn
      ? getAuctionTimeoutFallback(match.gameState, 'player1')
      : getTimeoutFallbackAction(match.gameState, 'player1');
    log('turn_timeout', {
      roomCode,
      playerId: room.player1.id,
      turn: match.turnNumber,
      fallbackAction: p1Action.type,
    });
  }
  
  if (p2Action === null) {
    p2Action = isAuctionTurn
      ? getAuctionTimeoutFallback(match.gameState, 'player2')
      : getTimeoutFallbackAction(match.gameState, 'player2');
    log('turn_timeout', {
      roomCode,
      playerId: room.player2?.id,
      turn: match.turnNumber,
      fallbackAction: p2Action.type,
    });
  }
  
  // Construct turn actions in CANONICAL ORDER [player1, player2]
  const turnActions: TurnActions = {
    playerActions: [
      { playerId: 'player1', action: p1Action },
      { playerId: 'player2', action: p2Action },
    ],
  };
  
  // Verify canonical order
  assertCanonicalOrder(turnActions, roomCode);
  
  // Resolve turn using engine
  const newState = resolveTurn(match.gameState, turnActions);
  
  // Update match state
  match.history.push(turnActions);
  match.gameState = newState;
  match.turnNumber = newState.turnNumber;
  match.pendingActions = { player1: null, player2: null };
  
  // Verify history invariant
  assertHistoryInvariant(match.history, match.turnNumber, roomCode);
  
  // Clear old timer
  clearTurnTimer(roomCode);
  
  if (newState.gameOver) {
    // Game finished
    match.status = 'finished';
    match.winner = newState.winner as 'player1' | 'player2' | null;
    match.turnDeadline = 0;
    
    setRoomStatus(roomCode, 'finished');
    cleanupRoomTimers(roomCode);
    
    log('game_ended', {
      roomCode,
      winner: match.winner,
      turnCount: match.history.length,
      replayId: match.replayId,
    });
  } else {
    // Set new turn timer
    const now = Date.now();
    match.turnStartedAt = now;
    match.turnDeadline = setTurnTimer(
      roomCode,
      match.turnNumber,
      room.turnTimerSeconds,
      () => onTurnTimeout(roomCode)
    );
  }
  
  log('turn_resolved', {
    roomCode,
    turn: match.history.length,
    p1Action: p1Action.type,
    p2Action: p2Action.type,
    newTurnNumber: match.turnNumber,
    gameOver: newState.gameOver,
  });
  
  return {
    success: true,
    match,
    turnActions,
    gameOver: newState.gameOver,
  };
}

// ============================================================================
// Match Queries
// ============================================================================

export function getMatch(roomCode: string): Match | null {
  return matches.get(roomCode) || null;
}

export function deleteMatch(roomCode: string): void {
  matches.delete(roomCode);
  cleanupRoomTimers(roomCode);
}

// ============================================================================
// Forfeit
// ============================================================================

export function forfeitMatch(
  roomCode: string,
  forfeitingRole: 'player1' | 'player2'
): Match | null {
  const match = matches.get(roomCode);
  
  if (!match || match.status !== 'active') {
    return null;
  }
  
  match.status = 'finished';
  match.winner = forfeitingRole === 'player1' ? 'player2' : 'player1';
  
  setRoomStatus(roomCode, 'finished');
  cleanupRoomTimers(roomCode);
  
  log('game_ended', {
    roomCode,
    winner: match.winner,
    reason: 'forfeit',
    forfeitedBy: forfeitingRole,
    turnCount: match.history.length,
    replayId: match.replayId,
  });
  
  return match;
}
