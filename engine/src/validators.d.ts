/**
 * Seque - Action Validators
 * Pure legality checks - NO resolution logic, NO side effects, NO mutation
 *
 * This module answers ONLY: "Is this action allowed to be attempted?"
 * NOT: "Is this action smart?" or "What happens if they do this?"
 *
 * Validation happens BEFORE resolution. If an action is illegal, it never resolves.
 */
import type { GameState, PlayerState } from './types';
import type { PlayerAction } from './actions';
/**
 * Returns all legal actions for a player in the current game state
 *
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for action legality.
 * All other systems (UI, AI, validators, tests) MUST use this function.
 *
 * ENGINE CONTRACT:
 * - This function ALWAYS returns at least one action
 * - If no real actions are available, it returns [{ type: 'pass' }]
 * - This prevents engine soft-locks and ensures determinism
 *
 * @param state - Current game state (immutable)
 * @param playerId - ID of the player
 * @returns Array of all legal actions (never empty)
 */
export declare function getLegalActions(state: GameState, playerId: string): PlayerAction[];
/**
 * Checks if a player action is legal in the current game state
 *
 * CRITICAL: This function does NOT:
 * - Check if the action would cause a bust (that's resolution's job)
 * - Check what the opponent is doing (simultaneous actions)
 * - Check if the action is "smart" or optimal
 * - Mutate state
 * - Throw errors
 *
 * IMPLEMENTATION NOTE:
 * This function now uses getLegalActions() as the source of truth.
 * We check if the action exists in the legal actions array.
 *
 * @param state - Current game state (immutable)
 * @param playerId - ID of the player attempting the action
 * @param action - The action to validate
 * @returns true if the action is legal, false otherwise
 */
export declare function isActionLegal(state: GameState, playerId: string, action: PlayerAction): boolean;
/**
 * Validates TAKE action
 *
 * TAKE is legal if:
 * - Queue is not empty (there's a card to take)
 * - Target lane exists (valid index)
 * - Target lane is not locked
 *
 * Does NOT check:
 * - Whether taking would bust the lane (resolution handles this)
 * - What the opponent is doing
 */
export declare function isTakeLegal(state: GameState, player: PlayerState, targetLane: number): boolean;
/**
 * Validates BURN action
 *
 * BURN is legal if:
 * - Player has energy > 0 (costs 1 energy)
 * - Queue is not empty (there's a card to burn)
 *
 * Does NOT check:
 * - What the opponent is doing
 * - Whether burning is strategically smart
 */
export declare function isBurnLegal(state: GameState, player: PlayerState): boolean;
/**
 * Validates STAND action
 *
 * STAND is legal if:
 * - Target lane exists (valid index)
 * - Target lane is not already locked
 *
 * Standing early (even on empty lanes) is allowed by design.
 *
 * Does NOT check:
 * - Whether standing is strategically smart
 * - What the opponent is doing
 */
export declare function isStandLegal(player: PlayerState, targetLane: number): boolean;
