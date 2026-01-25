/**
 * Seque - Turn Resolution
 * Pure, deterministic turn-by-turn state transition
 *
 * CRITICAL: This function assumes actions are already validated.
 * It does NOT re-validate them. Validation happens in validators.ts.
 *
 * Resolution follows a strict order to prevent bugs and ensure determinism.
 */
import type { GameState } from './types';
import type { TurnActions } from './actions';
/**
 * Resolves a single turn, transitioning from one game state to the next
 *
 * CONSTRAINTS:
 * - Pure function (no side effects)
 * - Does NOT mutate input state
 * - Returns brand-new GameState
 * - Increments turnNumber
 * - Assumes actions are already validated
 *
 * RESOLUTION ORDER (DO NOT CHANGE):
 * 1. Early exit if game over
 * 2. Extract player actions
 * 3. Resolve interaction matrix
 * 4. Apply card effects
 * 5. Apply STAND actions
 * 6. Resolve busts and locks
 * 7. Refill queue
 * 8. Check game end
 * 9. Return new state
 *
 * @param state - Current game state (immutable)
 * @param actions - Validated actions from all players
 * @returns New game state after turn resolution
 */
export declare function resolveTurn(state: GameState, actions: TurnActions): GameState;
