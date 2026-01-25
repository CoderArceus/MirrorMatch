/**
 * Seque Server - Server-Authoritative Timers
 * Handles turn deadlines, timeouts, disconnect grace periods
 */

import { log } from './logger.js';

// ============================================================================
// Types
// ============================================================================

export interface TurnTimer {
  roomCode: string;
  turnNumber: number;
  deadline: number;
  timeoutId: NodeJS.Timeout;
}

export interface DisconnectTimer {
  roomCode: string;
  playerId: string;
  disconnectedAt: number;
  graceDeadline: number;
  timeoutId: NodeJS.Timeout;
}

// ============================================================================
// Constants
// ============================================================================

const DISCONNECT_GRACE_MS = 15 * 1000; // 15 seconds exactly
const MAX_CUMULATIVE_DISCONNECT_MS = 60 * 1000; // 60 seconds total

// ============================================================================
// Storage
// ============================================================================

const turnTimers = new Map<string, TurnTimer>();
const disconnectTimers = new Map<string, DisconnectTimer>(); // key: `${roomCode}:${playerId}`
const cumulativeDisconnect = new Map<string, number>(); // key: `${roomCode}:${playerId}`

// ============================================================================
// Turn Timer Operations
// ============================================================================

export function setTurnTimer(
  roomCode: string,
  turnNumber: number,
  timerSeconds: number,
  onTimeout: () => void
): number {
  // Clear existing timer for this room
  clearTurnTimer(roomCode);
  
  const deadline = Date.now() + (timerSeconds * 1000);
  
  const timeoutId = setTimeout(() => {
    turnTimers.delete(roomCode);
    log('turn_timeout', { roomCode, turnNumber });
    onTimeout();
  }, timerSeconds * 1000);
  
  turnTimers.set(roomCode, {
    roomCode,
    turnNumber,
    deadline,
    timeoutId,
  });
  
  return deadline;
}

export function clearTurnTimer(roomCode: string): void {
  const timer = turnTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer.timeoutId);
    turnTimers.delete(roomCode);
  }
}

export function getTurnDeadline(roomCode: string): number | null {
  const timer = turnTimers.get(roomCode);
  return timer?.deadline ?? null;
}

export function isBeforeDeadline(roomCode: string): boolean {
  const deadline = getTurnDeadline(roomCode);
  if (deadline === null) return false;
  return Date.now() < deadline;
}

export function pauseTurnTimer(roomCode: string): number | null {
  const timer = turnTimers.get(roomCode);
  if (!timer) return null;
  
  const remaining = timer.deadline - Date.now();
  clearTimeout(timer.timeoutId);
  
  return remaining > 0 ? remaining : 0;
}

export function resumeTurnTimer(
  roomCode: string,
  remainingMs: number,
  onTimeout: () => void
): number {
  clearTurnTimer(roomCode);
  
  const timer = turnTimers.get(roomCode);
  const turnNumber = timer?.turnNumber ?? 0;
  
  const deadline = Date.now() + remainingMs;
  
  const timeoutId = setTimeout(() => {
    turnTimers.delete(roomCode);
    log('turn_timeout', { roomCode, turnNumber });
    onTimeout();
  }, remainingMs);
  
  turnTimers.set(roomCode, {
    roomCode,
    turnNumber,
    deadline,
    timeoutId,
  });
  
  return deadline;
}

// ============================================================================
// Disconnect Timer Operations
// ============================================================================

export function startDisconnectTimer(
  roomCode: string,
  playerId: string,
  onGraceExpired: () => void
): void {
  const key = `${roomCode}:${playerId}`;
  
  // Clear existing if any
  clearDisconnectTimer(roomCode, playerId);
  
  const now = Date.now();
  const graceDeadline = now + DISCONNECT_GRACE_MS;
  
  const timeoutId = setTimeout(() => {
    disconnectTimers.delete(key);
    log('disconnect', { roomCode, playerId, reason: 'grace_expired' });
    onGraceExpired();
  }, DISCONNECT_GRACE_MS);
  
  disconnectTimers.set(key, {
    roomCode,
    playerId,
    disconnectedAt: now,
    graceDeadline,
    timeoutId,
  });
  
  log('disconnect', { roomCode, playerId, graceDeadline });
}

export function clearDisconnectTimer(roomCode: string, playerId: string): number {
  const key = `${roomCode}:${playerId}`;
  const timer = disconnectTimers.get(key);
  
  if (!timer) return 0;
  
  clearTimeout(timer.timeoutId);
  disconnectTimers.delete(key);
  
  // Calculate time spent disconnected
  const disconnectDuration = Date.now() - timer.disconnectedAt;
  
  // Track cumulative disconnect time
  const cumKey = key;
  const current = cumulativeDisconnect.get(cumKey) ?? 0;
  cumulativeDisconnect.set(cumKey, current + disconnectDuration);
  
  return disconnectDuration;
}

export function getCumulativeDisconnectTime(roomCode: string, playerId: string): number {
  const key = `${roomCode}:${playerId}`;
  return cumulativeDisconnect.get(key) ?? 0;
}

export function hasExceededDisconnectLimit(roomCode: string, playerId: string): boolean {
  return getCumulativeDisconnectTime(roomCode, playerId) >= MAX_CUMULATIVE_DISCONNECT_MS;
}

export function resetCumulativeDisconnect(roomCode: string): void {
  // Clear for both players
  cumulativeDisconnect.delete(`${roomCode}:player1`);
  cumulativeDisconnect.delete(`${roomCode}:player2`);
}

// ============================================================================
// Cleanup
// ============================================================================

export function cleanupRoomTimers(roomCode: string): void {
  clearTurnTimer(roomCode);
  
  // Clear disconnect timers for both potential players
  for (const [key, timer] of disconnectTimers.entries()) {
    if (timer.roomCode === roomCode) {
      clearTimeout(timer.timeoutId);
      disconnectTimers.delete(key);
    }
  }
  
  resetCumulativeDisconnect(roomCode);
}
