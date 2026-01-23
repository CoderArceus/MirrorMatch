/**
 * MirrorMatch: Strategic 21 - Async PvP System
 * Server-lite async multiplayer without shared URLs or websockets
 * 
 * DESIGN PRINCIPLES:
 * - Engine remains authoritative
 * - Turns can be taken independently
 * - Game never deadlocks (PassAction ensures progress)
 * - State is always derivable from action log
 * - No real-time connections required
 * 
 * This enables turn-based async PvP where:
 * - Players don't share URLs manually
 * - Each player can take their turn whenever ready
 * - The game progresses deterministically
 */

import { GameState, PlayerAction } from './types';
import { TurnActions } from './actions';
import { resolveTurn } from './resolveTurn';
import { isActionLegal, getLegalActions } from './validators';
import { createInitialGameState } from './state';

// ============================================================================
// Action Log Entry
// ============================================================================

/**
 * Represents a single action taken by a player in the async match
 * 
 * IMMUTABILITY: Action log is append-only. Never modify past entries.
 */
export interface ActionLogEntry {
  readonly playerId: string;
  readonly action: PlayerAction;
  readonly turn: number; // Turn number when this action was submitted
}

// ============================================================================
// Async Match Envelope
// ============================================================================

/**
 * Complete representation of an async PvP match
 * 
 * CRITICAL INVARIANTS:
 * - state is always derivable from seed + actionLog
 * - nextPlayerId is authoritative (prevents both players acting simultaneously)
 * - actionLog is append-only (never modified, only appended)
 * - No partial turns allowed (both players must act before turn resolves)
 * 
 * TURN MODEL:
 * - Match starts with nextPlayerId = player1
 * - Player 1 submits action → nextPlayerId becomes player2
 * - Player 2 submits action → turn resolves, nextPlayerId becomes player1
 * - This creates a strict alternating submission pattern
 */
export interface AsyncMatch {
  readonly matchId: string;
  readonly seed: number; // Seed used to create initial state (for verification)
  readonly state: GameState;
  readonly actionLog: ReadonlyArray<ActionLogEntry>;
  readonly nextPlayerId: string; // Who must submit the next action
  readonly pendingAction: ActionLogEntry | null; // Action submitted by first player, waiting for second
}

// ============================================================================
// Create Async Match
// ============================================================================

/**
 * Creates a new async match with initial state
 * 
 * @param matchId - Unique identifier for this match
 * @param player1Id - ID of first player
 * @param player2Id - ID of second player
 * @param seed - Seed for deterministic deck shuffling
 * @returns New async match ready to play
 */
export function createAsyncMatch(
  matchId: string,
  player1Id: string,
  player2Id: string,
  seed: number
): AsyncMatch {
  const initialState = createInitialGameState(seed);
  
  // Override player IDs with the actual player IDs
  const stateWithPlayerIds: GameState = {
    ...initialState,
    players: [
      { ...initialState.players[0], id: player1Id },
      { ...initialState.players[1], id: player2Id }
    ]
  };

  return {
    matchId,
    seed,
    state: stateWithPlayerIds,
    actionLog: [],
    nextPlayerId: player1Id,
    pendingAction: null
  };
}

// ============================================================================
// Apply Async Action
// ============================================================================

/**
 * Result of applying an async action
 */
export interface ApplyAsyncActionResult {
  readonly success: boolean;
  readonly match: AsyncMatch;
  readonly error?: string;
}

/**
 * Applies a player action to an async match
 * 
 * LOGIC:
 * 1. Validate that it's the correct player's turn
 * 2. Validate that the action is legal
 * 3. If no pending action: store as pending, switch nextPlayerId
 * 4. If pending action exists: resolve turn with both actions
 * 
 * @param match - Current async match state
 * @param playerId - ID of player submitting action
 * @param action - Action being submitted
 * @returns Result with updated match or error
 */
export function applyAsyncAction(
  match: AsyncMatch,
  playerId: string,
  action: PlayerAction
): ApplyAsyncActionResult {
  // ============================================================================
  // VALIDATION: Game not over (check this first!)
  // ============================================================================
  if (match.state.gameOver) {
    return {
      success: false,
      match,
      error: 'Game is already over.'
    };
  }

  // ============================================================================
  // VALIDATION: Correct player's turn
  // ============================================================================
  if (playerId !== match.nextPlayerId) {
    return {
      success: false,
      match,
      error: `Not your turn. Waiting for ${match.nextPlayerId} to act.`
    };
  }

  // ============================================================================
  // VALIDATION: Action is legal
  // ============================================================================
  if (!isActionLegal(match.state, playerId, action)) {
    const legalActions = getLegalActions(match.state, playerId);
    return {
      success: false,
      match,
      error: `Action is not legal. Legal actions: ${legalActions.map(a => a.type).join(', ')}`
    };
  }

  // ============================================================================
  // CASE 1: No pending action - store as pending
  // ============================================================================
  if (match.pendingAction === null) {
    const logEntry: ActionLogEntry = {
      playerId,
      action,
      turn: match.state.turnNumber
    };

    // Determine next player ID
    const currentPlayerIndex = match.state.players.findIndex(p => p.id === playerId);
    const nextPlayerIndex = (currentPlayerIndex + 1) % match.state.players.length;
    const nextPlayerId = match.state.players[nextPlayerIndex].id;

    return {
      success: true,
      match: {
        ...match,
        pendingAction: logEntry,
        nextPlayerId
      }
    };
  }

  // ============================================================================
  // CASE 2: Pending action exists - resolve turn
  // ============================================================================
  const player1Id = match.state.players[0].id;
  const player2Id = match.state.players[1].id;

  // Create current log entry
  const currentLogEntry: ActionLogEntry = {
    playerId,
    action,
    turn: match.state.turnNumber
  };

  // Determine which action belongs to which player
  let player1Action: PlayerAction;
  let player2Action: PlayerAction;

  if (match.pendingAction.playerId === player1Id) {
    player1Action = match.pendingAction.action;
    player2Action = currentLogEntry.action;
  } else {
    player1Action = currentLogEntry.action;
    player2Action = match.pendingAction.action;
  }

  // Create TurnActions
  const turnActions: TurnActions = {
    playerActions: [
      { playerId: player1Id, action: player1Action },
      { playerId: player2Id, action: player2Action }
    ]
  };

  // Resolve turn
  const newState = resolveTurn(match.state, turnActions);

  // Append both actions to log
  const newActionLog = [
    ...match.actionLog,
    match.pendingAction,
    currentLogEntry
  ];

  // Determine next player (always player 1 after a turn resolves)
  const nextPlayerId = newState.gameOver ? match.nextPlayerId : player1Id;

  return {
    success: true,
    match: {
      ...match,
      state: newState,
      actionLog: newActionLog,
      pendingAction: null,
      nextPlayerId
    }
  };
}

// ============================================================================
// Get Match Status
// ============================================================================

/**
 * Status information about an async match
 */
export interface AsyncMatchStatus {
  readonly isYourTurn: boolean;
  readonly waitingFor: string | null;
  readonly gameOver: boolean;
  readonly winner: string | null;
  readonly turnNumber: number;
  readonly legalActions: ReadonlyArray<PlayerAction>;
}

/**
 * Gets the current status of an async match for a specific player
 * 
 * @param match - Current async match
 * @param playerId - ID of player checking status
 * @returns Status information
 */
export function getAsyncMatchStatus(
  match: AsyncMatch,
  playerId: string
): AsyncMatchStatus {
  const isYourTurn = match.nextPlayerId === playerId;
  const legalActions = isYourTurn && !match.state.gameOver
    ? getLegalActions(match.state, playerId)
    : [];

  return {
    isYourTurn,
    waitingFor: isYourTurn ? null : match.nextPlayerId,
    gameOver: match.state.gameOver,
    winner: match.state.winner,
    turnNumber: match.state.turnNumber,
    legalActions
  };
}

// ============================================================================
// Verify Match Integrity
// ============================================================================

/**
 * Verifies that a match's state matches its action log
 * Used for debugging and ensuring consistency
 * 
 * @param match - Match to verify
 * @returns true if match is valid, false otherwise
 */
export function verifyAsyncMatch(match: AsyncMatch): boolean {
  // Recreate state from seed
  let reconstructedState = createInitialGameState(match.seed);
  
  // Override player IDs
  reconstructedState = {
    ...reconstructedState,
    players: [
      { ...reconstructedState.players[0], id: match.state.players[0].id },
      { ...reconstructedState.players[1], id: match.state.players[1].id }
    ]
  };

  // Replay all completed turns from action log
  const completedActions = match.pendingAction
    ? match.actionLog
    : match.actionLog;

  // Process actions in pairs (each turn needs both player actions)
  for (let i = 0; i < completedActions.length; i += 2) {
    if (i + 1 >= completedActions.length) {
      // Incomplete turn - shouldn't happen if pendingAction is tracked correctly
      break;
    }

    const action1 = completedActions[i];
    const action2 = completedActions[i + 1];

    const player1Id = reconstructedState.players[0].id;
    const player2Id = reconstructedState.players[1].id;

    // Determine which action belongs to which player
    let player1Action: PlayerAction;
    let player2Action: PlayerAction;

    if (action1.playerId === player1Id) {
      player1Action = action1.action;
      player2Action = action2.action;
    } else {
      player1Action = action2.action;
      player2Action = action1.action;
    }

    const turnActions: TurnActions = {
      playerActions: [
        { playerId: player1Id, action: player1Action },
        { playerId: player2Id, action: player2Action }
      ]
    };

    reconstructedState = resolveTurn(reconstructedState, turnActions);
  }

  // Compare key fields (we can't do deep equality easily, so check critical fields)
  return (
    reconstructedState.turnNumber === match.state.turnNumber &&
    reconstructedState.gameOver === match.state.gameOver &&
    reconstructedState.winner === match.state.winner &&
    reconstructedState.deck.length === match.state.deck.length &&
    reconstructedState.queue.length === match.state.queue.length
  );
}
