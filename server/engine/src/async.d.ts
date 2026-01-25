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
import type { GameState, PlayerAction } from './types';
/**
 * Represents a single action taken by a player in the async match
 *
 * IMMUTABILITY: Action log is append-only. Never modify past entries.
 */
export interface ActionLogEntry {
    readonly playerId: string;
    readonly action: PlayerAction;
}
/**
 * Complete representation of an async PvP match
 *
 * CRITICAL INVARIANTS:
 * - NO GameState stored directly (violates replay-first architecture)
 * - State MUST be derived via replayAsyncMatch(match)
 * - actionLog is append-only (never modified, only appended)
 * - nextPlayerId is authoritative (prevents both players acting simultaneously)
 * - No partial turns allowed (both players must act before turn resolves)
 *
 * TURN MODEL:
 * - Match starts with nextPlayerId = player1
 * - Player 1 submits action → stored in pendingAction, nextPlayerId becomes player2
 * - Player 2 submits action → both actions appended to log, pendingAction cleared
 * - This creates a strict alternating submission pattern
 *
 * REPLAY GUARANTEE:
 * - Given same seed + player IDs + actionLog → identical GameState
 * - This enables deterministic verification, debugging, and time-travel
 */
export interface AsyncMatch {
    readonly matchId: string;
    readonly seed: number;
    readonly player1Id: string;
    readonly player2Id: string;
    readonly actionLog: ReadonlyArray<ActionLogEntry>;
    readonly pendingAction: ActionLogEntry | null;
    readonly nextPlayerId: string;
}
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
export declare function replayAsyncMatch(match: AsyncMatch): GameState;
/**
 * Creates a new async match with empty action log
 *
 * @param matchId - Unique identifier for this match
 * @param player1Id - ID of first player
 * @param player2Id - ID of second player
 * @param seed - Seed for deterministic deck shuffling
 * @returns New async match ready to play
 */
export declare function createAsyncMatch(matchId: string, player1Id: string, player2Id: string, seed: number): AsyncMatch;
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
export declare function applyAsyncAction(match: AsyncMatch, playerId: string, action: PlayerAction): ApplyAsyncActionResult;
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
 * Uses replayAsyncMatch to derive current state
 *
 * @param match - Current async match
 * @param playerId - ID of player checking status
 * @returns Status information
 */
export declare function getAsyncMatchStatus(match: AsyncMatch, playerId: string): AsyncMatchStatus;
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
export declare function verifyAsyncMatch(match: AsyncMatch): boolean;
