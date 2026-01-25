/**
 * Seque - Async PvP System
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
import { resolveTurn } from './resolveTurn';
import { isActionLegal, getLegalActions } from './validators';
import { createInitialGameState } from './state';
// ============================================================================
// Replay Async Match (CORE INTEGRATION POINT)
// ============================================================================
/**
 * Reconstructs GameState from an AsyncMatch by replaying the action log
 *
 * CRITICAL: This is the ONLY way to get GameState from an AsyncMatch.
 * No state snapshots are stored - everything is derived from replay.
 *
 * PROCESS:
 * 1. Start with createInitialGameState(seed)
 * 2. Override player IDs
 * 3. Replay actionLog in pairs using resolveTurn()
 * 4. Return final state
 *
 * @param match - Async match to replay
 * @returns Current game state derived from action log
 */
export function replayAsyncMatch(match) {
    // Start with initial state
    let state = createInitialGameState(match.seed);
    // Override player IDs to match the async match
    state = {
        ...state,
        players: [
            { ...state.players[0], id: match.player1Id },
            { ...state.players[1], id: match.player2Id }
        ]
    };
    // Replay completed actions in pairs (each turn needs both players)
    const actionLog = match.actionLog;
    for (let i = 0; i < actionLog.length; i += 2) {
        // Safety: should always have pairs, but handle edge case
        if (i + 1 >= actionLog.length) {
            // Incomplete turn - shouldn't happen if pendingAction is used correctly
            break;
        }
        const action1 = actionLog[i];
        const action2 = actionLog[i + 1];
        // Determine which action belongs to which player
        let player1Action;
        let player2Action;
        if (action1.playerId === match.player1Id) {
            player1Action = action1.action;
            player2Action = action2.action;
        }
        else {
            player1Action = action2.action;
            player2Action = action1.action;
        }
        // Construct TurnActions for resolveTurn
        const turnActions = {
            playerActions: [
                { playerId: match.player1Id, action: player1Action },
                { playerId: match.player2Id, action: player2Action }
            ]
        };
        // Resolve turn using existing engine logic
        state = resolveTurn(state, turnActions);
    }
    return state;
}
// ============================================================================
// Create Async Match
// ============================================================================
/**
 * Creates a new async match with empty action log
 *
 * @param matchId - Unique identifier for this match
 * @param player1Id - ID of first player
 * @param player2Id - ID of second player
 * @param seed - Seed for deterministic deck shuffling
 * @returns New async match ready to play
 */
export function createAsyncMatch(matchId, player1Id, player2Id, seed) {
    return {
        matchId,
        seed,
        player1Id,
        player2Id,
        actionLog: [],
        pendingAction: null,
        nextPlayerId: player1Id
    };
}
/**
 * Applies a player action to an async match
 *
 * INTEGRATION PATTERN:
 * 1. Reconstruct current state via replayAsyncMatch()
 * 2. Validate player turn
 * 3. Validate action legality via isActionLegal()
 * 4. If no pending action: store as pending, switch nextPlayerId
 * 5. If pending action exists: append both to actionLog
 *
 * NO STATE DUPLICATION: All validation uses replayed state
 * NO LOGIC DUPLICATION: All validation uses existing validators
 *
 * @param match - Current async match
 * @param playerId - ID of player submitting action
 * @param action - Action being submitted
 * @returns Result with updated match or error
 */
export function applyAsyncAction(match, playerId, action) {
    // ============================================================================
    // STEP 1: Reconstruct current state via replay
    // ============================================================================
    const currentState = replayAsyncMatch(match);
    // ============================================================================
    // VALIDATION: Game not over (check this first!)
    // ============================================================================
    if (currentState.gameOver) {
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
    // VALIDATION: Action is legal (using existing validator)
    // ============================================================================
    if (!isActionLegal(currentState, playerId, action)) {
        const legalActions = getLegalActions(currentState, playerId);
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
        const logEntry = {
            playerId,
            action
        };
        // Determine next player ID (simple alternation)
        const nextPlayerId = playerId === match.player1Id ? match.player2Id : match.player1Id;
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
    // CASE 2: Pending action exists - append both to actionLog
    // ============================================================================
    const currentLogEntry = {
        playerId,
        action
    };
    // Append both actions to log (order preserved)
    const newActionLog = [
        ...match.actionLog,
        match.pendingAction,
        currentLogEntry
    ];
    // After turn resolves, it's always player1's turn again
    const nextPlayerId = match.player1Id;
    return {
        success: true,
        match: {
            ...match,
            actionLog: newActionLog,
            pendingAction: null,
            nextPlayerId
        }
    };
}
/**
 * Gets the current status of an async match for a specific player
 *
 * Uses replayAsyncMatch to derive current state
 *
 * @param match - Current async match
 * @param playerId - ID of player checking status
 * @returns Status information
 */
export function getAsyncMatchStatus(match, playerId) {
    // Reconstruct current state via replay
    const currentState = replayAsyncMatch(match);
    const isYourTurn = match.nextPlayerId === playerId;
    const legalActions = isYourTurn && !currentState.gameOver
        ? getLegalActions(currentState, playerId)
        : [];
    return {
        isYourTurn,
        waitingFor: isYourTurn ? null : match.nextPlayerId,
        gameOver: currentState.gameOver,
        winner: currentState.winner,
        turnNumber: currentState.turnNumber,
        legalActions
    };
}
// ============================================================================
// Verify Match Integrity
// ============================================================================
/**
 * Verifies that a match is valid and can be replayed successfully
 *
 * VALIDATION:
 * - Match has valid seed
 * - Player IDs are present
 * - Action log has even number of entries (complete turns only)
 * - Replay succeeds without errors
 *
 * @param match - Match to verify
 * @returns true if match is valid
 */
export function verifyAsyncMatch(match) {
    try {
        // Basic validation
        if (!match.matchId || !match.player1Id || !match.player2Id) {
            return false;
        }
        // Action log should have even number of entries (complete turns)
        // If pendingAction exists, that's fine - it's not in the log yet
        if (match.actionLog.length % 2 !== 0) {
            return false;
        }
        // Attempt replay - if it throws, match is invalid
        const state = replayAsyncMatch(match);
        // Verify state is valid
        return (state.players.length === 2 &&
            state.players[0].id === match.player1Id &&
            state.players[1].id === match.player2Id);
    }
    catch (error) {
        // Replay failed - match is invalid
        return false;
    }
}
