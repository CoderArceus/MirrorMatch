/**
 * Seque Server - WebSocket Server
 * Handles connections, message routing, reconnection
 */

import { WebSocketServer, WebSocket } from 'ws';
import { randomBytes } from 'crypto';
import type { ClientMessage, ServerMessage, ErrorCode } from './protocol.js';
import { log, logError } from './logger.js';
import {
  createRoom,
  joinRoom,
  readyUp,
  getRoom,
  getPlayerByConnectionId,
  updatePlayerConnection,
  type Room,
  type Player,
} from './rooms.js';
import {
  createMatch,
  submitAction,
  resolveTurnNow,
  getMatch,
  forfeitMatch,
  type Match,
} from './match.js';
import {
  startDisconnectTimer,
  clearDisconnectTimer,
  hasExceededDisconnectLimit,
  pauseTurnTimer,
  resumeTurnTimer,
} from './timers.js';

// ============================================================================
// Types
// ============================================================================

interface Connection {
  id: string;
  socket: WebSocket;
  roomCode: string | null;
  playerId: string | null;
  role: 'player1' | 'player2' | null;
}

// ============================================================================
// Storage
// ============================================================================

const connections = new Map<string, Connection>();
const socketToConnection = new Map<WebSocket, Connection>();

// ============================================================================
// Helpers
// ============================================================================

function generateConnectionId(): string {
  return 'c_' + randomBytes(8).toString('hex');
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function sendError(socket: WebSocket, code: ErrorCode, message: string): void {
  send(socket, { type: 'ERROR', code, message });
}

function sendToRoom(roomCode: string, message: ServerMessage, excludeConnectionId?: string): void {
  const room = getRoom(roomCode);
  if (!room) return;
  
  const sendToPlayer = (player: Player | null) => {
    if (!player?.connectionId || player.connectionId === excludeConnectionId) return;
    const conn = connections.get(player.connectionId);
    if (conn) {
      send(conn.socket, message);
    }
  };
  
  sendToPlayer(room.player1);
  sendToPlayer(room.player2);
}

function sendToPlayer(roomCode: string, role: 'player1' | 'player2', message: ServerMessage): void {
  const room = getRoom(roomCode);
  if (!room) return;
  
  const player = role === 'player1' ? room.player1 : room.player2;
  if (!player?.connectionId) return;
  
  const conn = connections.get(player.connectionId);
  if (conn) {
    send(conn.socket, message);
  }
}

// ============================================================================
// Turn Timeout Handler
// ============================================================================

function handleTurnTimeout(roomCode: string): void {
  const result = resolveTurnNow(roomCode, handleTurnTimeout);
  
  if (result) {
    const room = getRoom(roomCode);
    
    // Broadcast turn resolution
    sendToRoom(roomCode, {
      type: 'TURN_RESOLVED',
      turn: result.match.history.length,
      actions: result.turnActions,
      newState: result.match.gameState,
      nextTurnDeadline: result.gameOver ? null : result.match.turnDeadline,
    });
    
    if (result.gameOver) {
      sendToRoom(roomCode, {
        type: 'GAME_OVER',
        winner: result.match.winner,
        finalState: result.match.gameState,
        replayId: result.match.replayId,
      });
    }
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

function handleCreateRoom(conn: Connection, displayName: string, timerSeconds?: number): void {
  const result = createRoom(displayName, timerSeconds, conn.id);
  
  if (!result.success) {
    sendError(conn.socket, 'INTERNAL_ERROR', result.error);
    return;
  }
  
  conn.roomCode = result.room.roomCode;
  conn.playerId = result.playerId;
  conn.role = 'player1';
  
  send(conn.socket, {
    type: 'ROOM_CREATED',
    roomCode: result.room.roomCode,
    playerId: result.playerId,
  });
}

function handleJoinRoom(conn: Connection, roomCode: string, displayName: string): void {
  const result = joinRoom(roomCode, displayName, conn.id);
  
  if (!result.success) {
    sendError(conn.socket, result.error, `Cannot join room: ${result.error}`);
    return;
  }
  
  conn.roomCode = result.room.roomCode;
  conn.playerId = result.playerId;
  conn.role = 'player2';
  
  // Notify joiner
  send(conn.socket, {
    type: 'ROOM_JOINED',
    playerId: result.playerId,
    opponent: result.opponent,
    timerSeconds: result.room.turnTimerSeconds,
  });
  
  // Notify room creator
  sendToPlayer(result.room.roomCode, 'player1', {
    type: 'PLAYER_JOINED',
    opponent: { displayName: result.room.player2!.displayName },
  });
}

function handleReady(conn: Connection): void {
  if (!conn.roomCode || !conn.playerId) {
    sendError(conn.socket, 'NOT_IN_ROOM', 'Not in a room');
    return;
  }
  
  const result = readyUp(conn.roomCode, conn.playerId);
  
  if (!result.success) {
    sendError(conn.socket, result.error, `Cannot ready up: ${result.error}`);
    return;
  }
  
  // Notify both players of ready state
  sendToRoom(conn.roomCode, {
    type: 'PLAYER_READY',
    playerId: conn.playerId,
  });
  
  // If both ready, start match
  if (result.bothReady) {
    const matchResult = createMatch(result.room, handleTurnTimeout);
    
    // Send game start to both players with their role
    const room = result.room;
    
    sendToPlayer(conn.roomCode, 'player1', {
      type: 'GAME_START',
      seed: matchResult.match.seed,
      yourRole: 'player1',
      turnDeadline: matchResult.match.turnDeadline,
      initialState: matchResult.match.gameState,
    });
    
    sendToPlayer(conn.roomCode, 'player2', {
      type: 'GAME_START',
      seed: matchResult.match.seed,
      yourRole: 'player2',
      turnDeadline: matchResult.match.turnDeadline,
      initialState: matchResult.match.gameState,
    });
  }
}

function handleAction(conn: Connection, turn: number, action: any): void {
  if (!conn.roomCode || !conn.playerId || !conn.role) {
    sendError(conn.socket, 'NOT_IN_ROOM', 'Not in a room');
    return;
  }
  
  const result = submitAction(conn.roomCode, conn.playerId, conn.role, turn, action);
  
  if (!result.success) {
    sendError(conn.socket, result.error, `Action rejected: ${result.error}`);
    return;
  }
  
  // Acknowledge action
  send(conn.socket, {
    type: 'ACTION_ACK',
    turn,
  });
  
  // Notify opponent (without revealing action)
  const opponentRole = conn.role === 'player1' ? 'player2' : 'player1';
  sendToPlayer(conn.roomCode, opponentRole, {
    type: 'OPPONENT_READY',
    turn,
  });
  
  // If both submitted, resolve turn
  if (result.bothSubmitted) {
    const resolveResult = resolveTurnNow(conn.roomCode, handleTurnTimeout);
    
    if (resolveResult) {
      // Broadcast turn resolution
      sendToRoom(conn.roomCode, {
        type: 'TURN_RESOLVED',
        turn: resolveResult.match.history.length,
        actions: resolveResult.turnActions,
        newState: resolveResult.match.gameState,
        nextTurnDeadline: resolveResult.gameOver ? null : resolveResult.match.turnDeadline,
      });
      
      if (resolveResult.gameOver) {
        sendToRoom(conn.roomCode, {
          type: 'GAME_OVER',
          winner: resolveResult.match.winner,
          finalState: resolveResult.match.gameState,
          replayId: resolveResult.match.replayId,
        });
      }
    }
  }
}

function handleLeave(conn: Connection): void {
  if (!conn.roomCode || !conn.role) {
    return;
  }
  
  const match = getMatch(conn.roomCode);
  
  if (match && match.status === 'active') {
    // Forfeit active match
    const result = forfeitMatch(conn.roomCode, conn.role);
    
    if (result) {
      sendToRoom(conn.roomCode, {
        type: 'GAME_OVER',
        winner: result.winner,
        finalState: result.gameState,
        replayId: result.replayId,
      });
    }
  }
  
  // Clean up connection state
  conn.roomCode = null;
  conn.playerId = null;
  conn.role = null;
}

function handleReconnect(conn: Connection, roomCode: string, playerId: string): void {
  const room = getRoom(roomCode);
  
  if (!room) {
    sendError(conn.socket, 'ROOM_NOT_FOUND', 'Room not found');
    return;
  }
  
  // Find player
  let player: Player | null = null;
  let role: 'player1' | 'player2' | null = null;
  
  if (room.player1.id === playerId) {
    player = room.player1;
    role = 'player1';
  } else if (room.player2?.id === playerId) {
    player = room.player2;
    role = 'player2';
  }
  
  if (!player || !role) {
    sendError(conn.socket, 'UNAUTHORIZED', 'Player not in room');
    return;
  }
  
  // Clear disconnect timer
  clearDisconnectTimer(roomCode, playerId);
  
  // Check cumulative disconnect limit
  if (hasExceededDisconnectLimit(roomCode, playerId)) {
    const match = getMatch(roomCode);
    if (match && match.status === 'active') {
      const result = forfeitMatch(roomCode, role);
      if (result) {
        sendToRoom(roomCode, {
          type: 'GAME_OVER',
          winner: result.winner,
          finalState: result.gameState,
          replayId: result.replayId,
        });
      }
    }
    sendError(conn.socket, 'UNAUTHORIZED', 'Exceeded disconnect time limit');
    return;
  }
  
  // Update connection
  updatePlayerConnection(roomCode, playerId, conn.id, true);
  conn.roomCode = roomCode;
  conn.playerId = playerId;
  conn.role = role;
  
  log('reconnect', { roomCode, playerId, role });
  
  // Send state sync
  const match = getMatch(roomCode);
  
  if (match) {
    send(conn.socket, {
      type: 'STATE_SYNC',
      gameState: match.gameState,
      turn: match.turnNumber,
      pending: {
        player1: match.pendingActions.player1 !== null,
        player2: match.pendingActions.player2 !== null,
      },
      turnDeadline: match.turnDeadline,
    });
  }
}

// ============================================================================
// Connection Handlers
// ============================================================================

function handleConnection(socket: WebSocket): void {
  const connectionId = generateConnectionId();
  
  const conn: Connection = {
    id: connectionId,
    socket,
    roomCode: null,
    playerId: null,
    role: null,
  };
  
  connections.set(connectionId, conn);
  socketToConnection.set(socket, conn);
  
  log('reconnect', { connectionId, event: 'connected' });
  
  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      
      switch (message.type) {
        case 'CREATE_ROOM':
          handleCreateRoom(conn, message.displayName, message.timerSeconds);
          break;
        case 'JOIN_ROOM':
          handleJoinRoom(conn, message.roomCode, message.displayName);
          break;
        case 'READY':
          handleReady(conn);
          break;
        case 'ACTION':
          handleAction(conn, message.turn, message.action);
          break;
        case 'LEAVE':
          handleLeave(conn);
          break;
        case 'RECONNECT':
          handleReconnect(conn, message.roomCode, message.playerId);
          break;
        default:
          sendError(socket, 'INTERNAL_ERROR', 'Unknown message type');
      }
    } catch (error) {
      logError('Message handling error', error, { connectionId });
      sendError(socket, 'INTERNAL_ERROR', 'Invalid message format');
    }
  });
  
  socket.on('close', () => {
    handleDisconnect(conn);
  });
  
  socket.on('error', (error) => {
    logError('Socket error', error, { connectionId: conn.id });
  });
}

function handleDisconnect(conn: Connection): void {
  log('disconnect', { connectionId: conn.id, roomCode: conn.roomCode, playerId: conn.playerId });
  
  if (conn.roomCode && conn.playerId && conn.role) {
    // Mark player as disconnected
    updatePlayerConnection(conn.roomCode, conn.playerId, null, false);
    
    const match = getMatch(conn.roomCode);
    
    if (match && match.status === 'active') {
      // Start disconnect grace timer
      startDisconnectTimer(conn.roomCode, conn.playerId, () => {
        // Grace period expired - forfeit
        const result = forfeitMatch(conn.roomCode!, conn.role!);
        if (result) {
          sendToRoom(conn.roomCode!, {
            type: 'GAME_OVER',
            winner: result.winner,
            finalState: result.gameState,
            replayId: result.replayId,
          });
        }
      });
    }
  }
  
  connections.delete(conn.id);
  socketToConnection.delete(conn.socket);
}

// ============================================================================
// Server Creation
// ============================================================================

export function createServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });
  
  wss.on('connection', handleConnection);
  
  wss.on('error', (error) => {
    logError('WebSocket server error', error);
  });
  
  log('room_created', { event: 'server_started', port });
  
  return wss;
}
