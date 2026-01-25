/**
 * Seque Server - Room Lifecycle
 * Handles room creation, joining, ready states
 */

import { randomBytes } from 'crypto';
import { log } from './logger.js';
import { clampTimerSeconds, validateDisplayName } from './validators.js';

// ============================================================================
// Types
// ============================================================================

export interface Player {
  id: string;
  displayName: string;
  connected: boolean;
  ready: boolean;
  connectionId: string | null;
}

export interface Room {
  roomCode: string;
  createdAt: number;
  expiresAt: number;
  status: 'waiting' | 'ready' | 'playing' | 'finished';
  turnTimerSeconds: number;
  player1: Player;
  player2: Player | null;
}

// ============================================================================
// In-Memory Storage
// ============================================================================

const rooms = new Map<string, Room>();

// Room expiry: 5 minutes for unused rooms
const ROOM_EXPIRY_MS = 5 * 60 * 1000;

// ============================================================================
// Room Code Generation
// ============================================================================

/**
 * Generate 8-character alphanumeric room code
 * Retry on collision
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for clarity
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function generateUniqueRoomCode(): string {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const code = generateRoomCode();
    if (!rooms.has(code)) {
      return code;
    }
    attempts++;
  }
  
  // Fallback: add timestamp suffix
  return generateRoomCode() + Date.now().toString(36).slice(-2).toUpperCase();
}

/**
 * Generate unique player ID
 */
function generatePlayerId(): string {
  return 'p_' + randomBytes(8).toString('hex');
}

// ============================================================================
// Room Operations
// ============================================================================

export interface CreateRoomResult {
  success: true;
  room: Room;
  playerId: string;
}

export interface CreateRoomError {
  success: false;
  error: string;
}

export function createRoom(
  displayName: string,
  timerSeconds: number | undefined,
  connectionId: string
): CreateRoomResult | CreateRoomError {
  const roomCode = generateUniqueRoomCode();
  const playerId = generatePlayerId();
  const now = Date.now();
  
  const room: Room = {
    roomCode,
    createdAt: now,
    expiresAt: now + ROOM_EXPIRY_MS,
    status: 'waiting',
    turnTimerSeconds: clampTimerSeconds(timerSeconds),
    player1: {
      id: playerId,
      displayName: validateDisplayName(displayName),
      connected: true,
      ready: false,
      connectionId,
    },
    player2: null,
  };
  
  rooms.set(roomCode, room);
  
  log('room_created', {
    roomCode,
    playerId,
    timerSeconds: room.turnTimerSeconds,
  });
  
  return { success: true, room, playerId };
}

export interface JoinRoomResult {
  success: true;
  room: Room;
  playerId: string;
  opponent: { displayName: string };
}

export interface JoinRoomError {
  success: false;
  error: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'ROOM_EXPIRED';
}

export function joinRoom(
  roomCode: string,
  displayName: string,
  connectionId: string
): JoinRoomResult | JoinRoomError {
  const room = rooms.get(roomCode.toUpperCase());
  
  if (!room) {
    return { success: false, error: 'ROOM_NOT_FOUND' };
  }
  
  if (room.status !== 'waiting') {
    return { success: false, error: 'ROOM_FULL' };
  }
  
  if (Date.now() > room.expiresAt) {
    rooms.delete(roomCode);
    log('room_expired', { roomCode });
    return { success: false, error: 'ROOM_EXPIRED' };
  }
  
  if (room.player2 !== null) {
    return { success: false, error: 'ROOM_FULL' };
  }
  
  const playerId = generatePlayerId();
  
  room.player2 = {
    id: playerId,
    displayName: validateDisplayName(displayName),
    connected: true,
    ready: false,
    connectionId,
  };
  
  // Room no longer expires once joined
  room.expiresAt = Infinity;
  
  log('room_joined', {
    roomCode,
    playerId,
    displayName: room.player2.displayName,
  });
  
  return {
    success: true,
    room,
    playerId,
    opponent: { displayName: room.player1.displayName },
  };
}

export interface ReadyResult {
  success: true;
  room: Room;
  bothReady: boolean;
}

export interface ReadyError {
  success: false;
  error: 'ROOM_NOT_FOUND' | 'UNAUTHORIZED' | 'ALREADY_PLAYING';
}

export function readyUp(
  roomCode: string,
  playerId: string
): ReadyResult | ReadyError {
  const room = rooms.get(roomCode);
  
  if (!room) {
    return { success: false, error: 'ROOM_NOT_FOUND' };
  }
  
  if (room.status === 'playing' || room.status === 'finished') {
    return { success: false, error: 'ALREADY_PLAYING' };
  }
  
  // Find player
  let player: Player | null = null;
  if (room.player1.id === playerId) {
    player = room.player1;
  } else if (room.player2?.id === playerId) {
    player = room.player2;
  }
  
  if (!player) {
    return { success: false, error: 'UNAUTHORIZED' };
  }
  
  player.ready = true;
  
  log('player_ready', { roomCode, playerId });
  
  // Check if both ready
  const bothReady = room.player1.ready && room.player2?.ready === true;
  
  if (bothReady) {
    room.status = 'ready';
  }
  
  return { success: true, room, bothReady };
}

// ============================================================================
// Room Queries
// ============================================================================

export function getRoom(roomCode: string): Room | null {
  return rooms.get(roomCode) || null;
}

export function getRoomByConnectionId(connectionId: string): Room | null {
  for (const room of rooms.values()) {
    if (room.player1.connectionId === connectionId) return room;
    if (room.player2?.connectionId === connectionId) return room;
  }
  return null;
}

export function getPlayerByConnectionId(connectionId: string): { room: Room; player: Player; role: 'player1' | 'player2' } | null {
  for (const room of rooms.values()) {
    if (room.player1.connectionId === connectionId) {
      return { room, player: room.player1, role: 'player1' };
    }
    if (room.player2?.connectionId === connectionId) {
      return { room, player: room.player2, role: 'player2' };
    }
  }
  return null;
}

export function updatePlayerConnection(
  roomCode: string,
  playerId: string,
  connectionId: string | null,
  connected: boolean
): boolean {
  const room = rooms.get(roomCode);
  if (!room) return false;
  
  if (room.player1.id === playerId) {
    room.player1.connectionId = connectionId;
    room.player1.connected = connected;
    return true;
  }
  
  if (room.player2?.id === playerId) {
    room.player2.connectionId = connectionId;
    room.player2.connected = connected;
    return true;
  }
  
  return false;
}

export function setRoomStatus(roomCode: string, status: Room['status']): void {
  const room = rooms.get(roomCode);
  if (room) {
    room.status = status;
  }
}

export function deleteRoom(roomCode: string): void {
  rooms.delete(roomCode);
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up expired rooms periodically
 */
export function cleanupExpiredRooms(): number {
  const now = Date.now();
  let count = 0;
  
  for (const [code, room] of rooms.entries()) {
    if (room.status === 'waiting' && now > room.expiresAt) {
      rooms.delete(code);
      log('room_expired', { roomCode: code });
      count++;
    }
  }
  
  return count;
}

// Run cleanup every minute
setInterval(cleanupExpiredRooms, 60 * 1000);
