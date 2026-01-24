/**
 * MirrorMatch: Strategic 21 - Replay Runner
 * Pure replay system for deterministic game reproduction
 * 
 * CRITICAL: This module assumes replay data is valid (produced by server).
 * It does NOT validate actions - validation happens during live gameplay.
 * 
 * Replays prove determinism: same seed + same actions = same outcome.
 */

import type { GameState } from './types';
import type { TurnActions } from './actions';
import { resolveTurn } from './resolveTurn';

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
export function runReplay(replay: Replay): GameState {
  let currentState = replay.initialState;

  // Apply each turn sequentially
  for (const turnActions of replay.turns) {
    currentState = resolveTurn(currentState, turnActions);

    // Stop if game ends early (optimization)
    if (currentState.gameOver) {
      break;
    }
  }

  return currentState;
}

/**
 * Runs a replay and collects the state after each turn
 * Useful for step-by-step analysis and debugging
 * 
 * @param replay - Complete replay data
 * @returns Array of game states, one per turn (including initial state)
 */
export function runReplayWithHistory(replay: Replay): ReadonlyArray<GameState> {
  const history: GameState[] = [replay.initialState];
  let currentState = replay.initialState;

  for (const turnActions of replay.turns) {
    currentState = resolveTurn(currentState, turnActions);
    history.push(currentState);

    if (currentState.gameOver) {
      break;
    }
  }

  return history;
}

/**
 * Verifies that two replays produce identical results
 * Useful for testing determinism and detecting desyncs
 * 
 * @param replay1 - First replay
 * @param replay2 - Second replay
 * @returns true if both replays produce the same final state
 */
export function compareReplays(replay1: Replay, replay2: Replay): boolean {
  const result1 = runReplay(replay1);
  const result2 = runReplay(replay2);

  // Deep comparison of final states
  return JSON.stringify(result1) === JSON.stringify(result2);
}
