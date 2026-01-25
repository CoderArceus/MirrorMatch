/**
 * useMultiplayer - React hook for multiplayer state management
 * Connects UI to WebSocket client and manages all multiplayer state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { wsClient, DEFAULT_WS_URL } from './wsClient';
import type { 
  MultiplayerState, 
  ServerMessage, 
  ConnectionState,
  LobbyPhase,
  ErrorCode 
} from './types';
import { initialMultiplayerState } from './types';
import type { PlayerAction } from '../../../engine/src';

// ============================================================================
// Safety Validation Types
// ============================================================================

type ValidationAction = 'accept' | 'ignore' | 'reconnect' | 'reload';

interface ValidationResult {
  valid: boolean;
  reason?: string;
  action: ValidationAction;
}

// ============================================================================
// Hook Return Type
// ============================================================================

// Submitting status for UI display
export type SubmittingStatus = 
  | 'idle'           // Not submitting
  | 'submitting'     // Just clicked, awaiting ACK
  | 'slow'           // No ACK after 3s
  | 'retrying';      // No ACK after 10s, reconnecting

export interface UseMultiplayerReturn {
  state: MultiplayerState;
  
  // Connection
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Lobby Actions
  createRoom: (displayName: string, timerSeconds?: number) => void;
  joinRoom: (roomCode: string, displayName: string) => void;
  ready: () => void;
  cancelRoom: () => void;
  
  // Game Actions
  submitAction: (action: PlayerAction) => void;
  
  // UI Helpers
  setPhase: (phase: LobbyPhase) => void;
  clearError: () => void;
  reset: () => void;
  
  // Computed
  canAct: boolean;
  isMyTurn: boolean;
  timeRemaining: number | null;
  submittingStatus: SubmittingStatus;
  safetyWarning: string | null;
  clearSafetyWarning: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

// Thresholds for submitting status
const SLOW_THRESHOLD_MS = 3000;
const RETRY_THRESHOLD_MS = 10000;

// ============================================================================
// Safety Validation - Detects protocol violations
// ============================================================================

function validateServerMessage(
  message: ServerMessage, 
  currentState: MultiplayerState
): ValidationResult {
  const { gameState } = currentState;
  
  switch (message.type) {
    case 'TURN_RESOLVED': {
      // Check: Turn number must match expected
      if (gameState && message.turn !== gameState.turnNumber) {
        console.error('[Safety] TURN_RESOLVED turn mismatch:', {
          expected: gameState.turnNumber,
          received: message.turn
        });
        // If we're behind, accept and sync. If ahead, something is very wrong.
        if (message.turn < gameState.turnNumber) {
          return { valid: false, reason: 'Received old turn resolution', action: 'ignore' };
        }
        return { valid: false, reason: 'Turn number mismatch', action: 'reconnect' };
      }
      return { valid: true, action: 'accept' };
    }
    
    case 'GAME_START': {
      // Check: Should not receive GAME_START while in an active game
      if (gameState && !gameState.gameOver) {
        console.warn('[Safety] GAME_START received while in active game');
        // Accept it - server is authoritative, but log warning
        return { valid: true, reason: 'Game restarted by server', action: 'accept' };
      }
      return { valid: true, action: 'accept' };
    }
    
    case 'STATE_SYNC': {
      // Check: STATE_SYNC turn should not be lower than local (unless we have no state)
      if (gameState && message.turn < gameState.turnNumber) {
        console.error('[Safety] STATE_SYNC with lower turn:', {
          local: gameState.turnNumber,
          received: message.turn
        });
        return { valid: false, reason: 'Received stale state sync', action: 'reload' };
      }
      return { valid: true, action: 'accept' };
    }
    
    case 'ACTION_ACK': {
      // Check: ACTION_ACK turn should match current turn
      if (gameState && message.turn !== gameState.turnNumber) {
        console.warn('[Safety] ACTION_ACK for different turn:', {
          expected: gameState.turnNumber,
          received: message.turn
        });
        // Ignore stale ACKs
        if (message.turn < gameState.turnNumber) {
          return { valid: false, reason: 'Stale ACTION_ACK', action: 'ignore' };
        }
      }
      return { valid: true, action: 'accept' };
    }
    
    default:
      return { valid: true, action: 'accept' };
  }
}

export function useMultiplayer(): UseMultiplayerReturn {
  const [state, setState] = useState<MultiplayerState>(initialMultiplayerState);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [submittingStatus, setSubmittingStatus] = useState<SubmittingStatus>('idle');
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);
  
  // Track submitting timeout
  const submittingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Ref to current state for validation (avoids stale closure)
  const stateRef = useRef(state);
  stateRef.current = state;
  
  // ══════════════════════════════════════════════════════════════════════════
  // Timer Management
  // ══════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (!state.turnDeadline || state.gameState?.gameOver) {
      setTimeRemaining(null);
      return;
    }
    
    const updateTimer = () => {
      const remaining = Math.max(0, state.turnDeadline! - Date.now());
      // Add 500ms visual buffer - show 0 slightly before server deadline
      setTimeRemaining(Math.max(0, remaining - 500));
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 100);
    
    return () => clearInterval(interval);
  }, [state.turnDeadline, state.gameState?.gameOver]);
  
  // ══════════════════════════════════════════════════════════════════════════
  // Submitting Status Management
  // ══════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    // Clear timer if not submitting
    if (!state.submittingAction || !state.submittingStartTime) {
      if (submittingTimerRef.current) {
        clearInterval(submittingTimerRef.current);
        submittingTimerRef.current = null;
      }
      setSubmittingStatus('idle');
      return;
    }
    
    // Start monitoring submitting status
    const checkStatus = () => {
      const elapsed = Date.now() - state.submittingStartTime!;
      
      if (elapsed >= RETRY_THRESHOLD_MS) {
        setSubmittingStatus('retrying');
        // Trigger reconnect
        if (wsClient.isConnected()) {
          console.warn('[Multiplayer] ACTION_ACK timeout - triggering reconnect');
          wsClient.disconnect();
        }
      } else if (elapsed >= SLOW_THRESHOLD_MS) {
        setSubmittingStatus('slow');
      } else {
        setSubmittingStatus('submitting');
      }
    };
    
    checkStatus();
    submittingTimerRef.current = setInterval(checkStatus, 500);
    
    return () => {
      if (submittingTimerRef.current) {
        clearInterval(submittingTimerRef.current);
        submittingTimerRef.current = null;
      }
    };
  }, [state.submittingAction, state.submittingStartTime]);
  
  // ══════════════════════════════════════════════════════════════════════════
  // Message Handler
  // ══════════════════════════════════════════════════════════════════════════
  
  const handleMessage = useCallback((message: ServerMessage) => {
    // ════════════════════════════════════════════════════════════════════════
    // SAFETY VALIDATION: Check message before processing
    // ════════════════════════════════════════════════════════════════════════
    const validation = validateServerMessage(message, stateRef.current);
    
    if (!validation.valid) {
      console.warn('[Safety] Message validation failed:', validation.reason);
      
      switch (validation.action) {
        case 'ignore':
          console.log('[Safety] Ignoring message');
          return; // Don't process this message
          
        case 'reconnect':
          console.log('[Safety] Triggering reconnect');
          setSafetyWarning('State sync issue detected — reconnecting...');
          wsClient.disconnect(); // Will trigger auto-reconnect
          return;
          
        case 'reload':
          console.log('[Safety] Requesting page reload');
          setSafetyWarning('Game state conflict detected. Please refresh the page.');
          return;
          
        // 'accept' falls through to normal processing
      }
    }
    
    // Show non-blocking warning if present
    if (validation.reason && validation.action === 'accept') {
      setSafetyWarning(validation.reason);
      setTimeout(() => setSafetyWarning(null), 5000);
    }
    
    setState(prev => {
      switch (message.type) {
        case 'ROOM_CREATED':
          wsClient.setReconnectInfo(message.roomCode, message.playerId);
          return {
            ...prev,
            phase: 'waiting',
            roomCode: message.roomCode,
            playerId: message.playerId,
            myRole: 'player1',
            error: null,
          };
          
        case 'ROOM_JOINED':
          wsClient.setReconnectInfo(prev.roomCode!, message.playerId);
          return {
            ...prev,
            phase: 'lobby',
            playerId: message.playerId,
            myRole: 'player2',
            opponent: message.opponent,
            timerSeconds: message.timerSeconds,
            error: null,
          };
          
        case 'PLAYER_JOINED':
          return {
            ...prev,
            phase: 'lobby',
            opponent: message.opponent,
          };
          
        case 'PLAYER_READY':
          const isMe = message.playerId === prev.playerId;
          if (isMe) {
            return { ...prev, myReady: true };
          } else {
            return { ...prev, opponentReady: true };
          }
          
        case 'GAME_START':
          return {
            ...prev,
            phase: 'starting', // Will transition to game view
            myRole: message.yourRole,
            gameState: message.initialState,
            turnDeadline: message.turnDeadline,
            submittingAction: false,
            submittingStartTime: null,
            actionSubmitted: false,
            opponentSubmittedThisTurn: false,
            lastResolvedTurn: null,
          };
          
        case 'ACTION_ACK':
          return {
            ...prev,
            submittingAction: false,
            submittingStartTime: null,
            actionSubmitted: true,
          };
          
        case 'OPPONENT_READY':
          return {
            ...prev,
            opponentSubmittedThisTurn: true,
          };
          
        case 'TURN_RESOLVED':
          return {
            ...prev,
            gameState: message.newState,
            turnDeadline: message.nextTurnDeadline,
            submittingAction: false,
            submittingStartTime: null,
            actionSubmitted: false,
            opponentSubmittedThisTurn: false,
            lastResolvedTurn: message.actions,
          };
          
        case 'GAME_OVER':
          wsClient.clearReconnectInfo();
          return {
            ...prev,
            gameState: message.finalState,
            winner: message.winner,
            replayId: message.replayId,
            turnDeadline: null,
          };
          
        case 'STATE_SYNC':
          // Reconnect state sync
          const myPending = prev.myRole === 'player1' 
            ? message.pending.player1 
            : message.pending.player2;
          const opponentPending = prev.myRole === 'player1' 
            ? message.pending.player2 
            : message.pending.player1;
          return {
            ...prev,
            gameState: message.gameState,
            turnDeadline: message.turnDeadline,
            actionSubmitted: myPending,
            opponentSubmittedThisTurn: opponentPending,
          };
          
        case 'ERROR':
          return handleError(prev, message.code, message.message);
          
        default:
          return prev;
      }
    });
  }, []);
  
  // ══════════════════════════════════════════════════════════════════════════
  // Error Handler
  // ══════════════════════════════════════════════════════════════════════════
  
  const handleError = (
    prev: MultiplayerState, 
    code: ErrorCode, 
    message: string
  ): MultiplayerState => {
    console.error('[Multiplayer] Error:', code, message);
    
    // Handle specific errors
    switch (code) {
      case 'ROOM_NOT_FOUND':
      case 'ROOM_EXPIRED':
      case 'ROOM_FULL':
        // Return to menu phase
        return {
          ...prev,
          phase: 'menu',
          roomCode: null,
          error: { code, message },
        };
        
      case 'TURN_EXPIRED':
        // Show error but don't change state - server will handle
        return {
          ...prev,
          submittingAction: false,
          submittingStartTime: null,
          error: { code, message: 'Time expired! Server selected default action.' },
        };
        
      case 'ALREADY_SUBMITTED':
        // Action was already submitted - mark as submitted
        return {
          ...prev,
          submittingAction: false,
          submittingStartTime: null,
          actionSubmitted: true,
        };
      
      case 'INVALID_ACTION':
        // Clear submitting state so player can try again
        return {
          ...prev,
          submittingAction: false,
          submittingStartTime: null,
          error: { code, message },
        };
        
      default:
        return {
          ...prev,
          submittingAction: false,
          submittingStartTime: null,
          error: { code, message },
        };
    }
  };
  
  // ══════════════════════════════════════════════════════════════════════════
  // Connection Handler
  // ══════════════════════════════════════════════════════════════════════════
  
  const handleConnectionChange = useCallback((connectionState: ConnectionState) => {
    setState(prev => ({
      ...prev,
      connectionState,
    }));
  }, []);
  
  // ══════════════════════════════════════════════════════════════════════════
  // Setup Listeners
  // ══════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    // Always subscribe to messages and connection changes
    const unsubMessage = wsClient.onMessage(handleMessage);
    const unsubConnection = wsClient.onConnectionChange(handleConnectionChange);
    
    // Sync initial connection state
    setState(prev => ({
      ...prev,
      connectionState: wsClient.getState(),
    }));
    
    return () => {
      unsubMessage();
      unsubConnection();
    };
  }, [handleMessage, handleConnectionChange]);
  
  // ══════════════════════════════════════════════════════════════════════════
  // Actions
  // ══════════════════════════════════════════════════════════════════════════
  
  const connect = useCallback(async () => {
    await wsClient.connect(DEFAULT_WS_URL);
  }, []);
  
  const disconnect = useCallback(() => {
    wsClient.send({ type: 'LEAVE' });
    wsClient.disconnect();
    setState(initialMultiplayerState);
  }, []);
  
  const createRoom = useCallback((displayName: string, timerSeconds: number = 30) => {
    setState(prev => ({ ...prev, myDisplayName: displayName, timerSeconds }));
    wsClient.send({
      type: 'CREATE_ROOM',
      displayName,
      timerSeconds,
    });
  }, []);
  
  const joinRoom = useCallback((roomCode: string, displayName: string) => {
    setState(prev => ({ 
      ...prev, 
      myDisplayName: displayName, 
      roomCode: roomCode.toUpperCase() 
    }));
    wsClient.send({
      type: 'JOIN_ROOM',
      roomCode: roomCode.toUpperCase(),
      displayName,
    });
  }, []);
  
  const ready = useCallback(() => {
    wsClient.send({ type: 'READY' });
  }, []);
  
  const cancelRoom = useCallback(() => {
    wsClient.send({ type: 'LEAVE' });
    wsClient.clearReconnectInfo();
    setState(prev => ({
      ...initialMultiplayerState,
      connectionState: prev.connectionState,
      phase: 'menu',
    }));
  }, []);
  
  const submitAction = useCallback((action: PlayerAction) => {
    if (!state.gameState || state.actionSubmitted || state.submittingAction) {
      console.warn('[Multiplayer] Cannot submit action - not allowed');
      return;
    }
    
    wsClient.send({
      type: 'ACTION',
      turn: state.gameState.turnNumber,
      action,
    });
    
    // Mark as submitting (not submitted until ACK)
    setState(prev => ({ 
      ...prev, 
      submittingAction: true,
      submittingStartTime: Date.now(),
    }));
  }, [state.gameState, state.actionSubmitted, state.submittingAction]);
  
  const setPhase = useCallback((phase: LobbyPhase) => {
    setState(prev => ({ ...prev, phase }));
  }, []);
  
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);
  
  const clearSafetyWarning = useCallback(() => {
    setSafetyWarning(null);
  }, []);
  
  const reset = useCallback(() => {
    wsClient.clearReconnectInfo();
    setState(prev => ({
      ...initialMultiplayerState,
      connectionState: prev.connectionState,
    }));
  }, []);
  
  // ══════════════════════════════════════════════════════════════════════════
  // Computed Values
  // ══════════════════════════════════════════════════════════════════════════
  
  const canAct = 
    state.connectionState === 'connected' &&
    state.gameState !== null &&
    !state.gameState.gameOver &&
    !state.actionSubmitted &&
    !state.submittingAction;
  
  const isMyTurn = canAct; // In simultaneous turns, it's always "your turn" until you submit
  
  return {
    state,
    connect,
    disconnect,
    createRoom,
    joinRoom,
    ready,
    cancelRoom,
    submitAction,
    setPhase,
    clearError,
    reset,
    canAct,
    isMyTurn,
    timeRemaining,
    submittingStatus,
    safetyWarning,
    clearSafetyWarning,
  };
}
