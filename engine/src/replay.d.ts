/**
 * Seque - Replay Runner
 * Pure replay system for deterministic game reproduction
 *
 * CRITICAL: This module assumes replay data is valid (produced by server).
 * It does NOT validate actions - validation happens during live gameplay.
 *
 * Replays prove determinism: same seed + same actions = same outcome.
 */
import type { GameState } from './types';
import type { TurnActions } from './actions';
/**
 * Represents a complete game replay
 * Contains initial state and all turn actions in order
 */
export interface Replay {
    readonly initialState: GameState;
    readonly turns: ReadonlyArray<TurnActions>;
}
/**
 * Runs a replay from start to finish, applying turns sequentially
 *
 * CONSTRAINTS:
 * - Pure function (no side effects)
 * - Does NOT mutate replay data
 * - Produces identical final state on every run (deterministic)
 * - Does NOT validate actions (assumes valid replay data)
 *
 * Use cases:
 * - Match verification
 * - Debugging specific game states
 * - Analytics and statistics
 * - Audit logs
 *
 * @param replay - Complete replay data with initial state and all turns
 * @returns Final game state after all turns are applied
 */
export declare function runReplay(replay: Replay): GameState;
/**
 * Runs a replay and collects the state after each turn
 * Useful for step-by-step analysis and debugging
 *
 * @param replay - Complete replay data
 * @returns Array of game states, one per turn (including initial state)
 */
export declare function runReplayWithHistory(replay: Replay): ReadonlyArray<GameState>;
/**
 * Verifies that two replays produce identical results
 * Useful for testing determinism and detecting desyncs
 *
 * @param replay1 - First replay
 * @param replay2 - Second replay
 * @returns true if both replays produce the same final state
 */
export declare function compareReplays(replay1: Replay, replay2: Replay): boolean;
