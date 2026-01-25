/**
 * Seque Server - Guards & Invariants
 * Throws loudly if violated
 */

import type { GameState, TurnActions } from '../engine/src';
import { logError } from './logger.js';

export class InvariantViolation extends Error {
  constructor(message: string) {
    super(`INVARIANT VIOLATION: ${message}`);
    this.name = 'InvariantViolation';
  }
}

/**
 * History length MUST equal turnNumber - 1
 */
export function assertHistoryInvariant(
  history: TurnActions[],
  turnNumber: number,
  roomCode: string
): void {
  const expected = turnNumber - 1;
  if (history.length !== expected) {
    const error = new InvariantViolation(
      `History length mismatch: got ${history.length}, expected ${expected} (turn ${turnNumber})`
    );
    logError('History invariant violation', error, { roomCode, turnNumber, historyLength: history.length });
    throw error;
  }
}

/**
 * No actions allowed after gameOver
 */
export function assertGameActive(gameState: GameState, roomCode: string): void {
  if (gameState.gameOver) {
    const error = new InvariantViolation('Action attempted after game over');
    logError('Game over invariant violation', error, { roomCode });
    throw error;
  }
}

/**
 * TurnActions MUST be ordered [player1, player2]
 */
export function assertCanonicalOrder(turnActions: TurnActions, roomCode: string): void {
  const [first, second] = turnActions.playerActions;
  if (first.playerId !== 'player1' || second.playerId !== 'player2') {
    const error = new InvariantViolation(
      `TurnActions not in canonical order: [${first.playerId}, ${second.playerId}]`
    );
    logError('Canonical order invariant violation', error, { roomCode });
    throw error;
  }
}

/**
 * Turn number must match expected
 */
export function assertCorrectTurn(
  submittedTurn: number,
  currentTurn: number,
  roomCode: string
): void {
  if (submittedTurn !== currentTurn) {
    const error = new InvariantViolation(
      `Turn mismatch: submitted ${submittedTurn}, current ${currentTurn}`
    );
    logError('Turn mismatch', error, { roomCode, submittedTurn, currentTurn });
    throw error;
  }
}

/**
 * Clamp timer seconds to valid range
 */
export function clampTimerSeconds(seconds: number | undefined): number {
  const MIN = 15;
  const MAX = 60;
  const DEFAULT = 30;
  
  if (seconds === undefined) return DEFAULT;
  return Math.max(MIN, Math.min(MAX, Math.floor(seconds)));
}

/**
 * Validate display name
 */
export function validateDisplayName(name: string): string {
  const trimmed = name.trim().slice(0, 20);
  if (trimmed.length === 0) {
    return 'Anonymous';
  }
  return trimmed;
}
