/**
 * MirrorMatch: Strategic 21 - Action Validators
 * Pure legality checks - NO resolution logic, NO side effects, NO mutation
 * 
 * This module answers ONLY: "Is this action allowed to be attempted?"
 * NOT: "Is this action smart?" or "What happens if they do this?"
 * 
 * Validation happens BEFORE resolution. If an action is illegal, it never resolves.
 */

import { GameState, PlayerState } from './types';
import { PlayerAction } from './actions';

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
 * @param state - Current game state (immutable)
 * @param playerId - ID of the player attempting the action
 * @param action - The action to validate
 * @returns true if the action is legal, false otherwise
 */
export function isActionLegal(
  state: GameState,
  playerId: string,
  action: PlayerAction
): boolean {
  // Universal checks: game must not be over, player must exist
  if (state.gameOver) {
    return false;
  }

  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    return false;
  }

  // Action-specific validation
  switch (action.type) {
    case 'take':
      return isTakeLegal(state, player, action.targetLane);

    case 'burn':
      return isBurnLegal(state, player);

    case 'stand':
      return isStandLegal(player, action.targetLane);

    default:
      // Unknown action type
      return false;
  }
}

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
function isTakeLegal(
  state: GameState,
  player: PlayerState,
  targetLane: number
): boolean {
  // Queue must have at least one card
  if (state.queue.length === 0) {
    return false;
  }

  // Target lane must exist
  if (targetLane < 0 || targetLane >= player.lanes.length) {
    return false;
  }

  // Target lane must not be locked
  const lane = player.lanes[targetLane];
  if (lane.locked) {
    return false;
  }

  return true;
}

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
function isBurnLegal(
  state: GameState,
  player: PlayerState
): boolean {
  // Must have energy to burn
  if (player.energy <= 0) {
    return false;
  }

  // Queue must have at least one card
  if (state.queue.length === 0) {
    return false;
  }

  return true;
}

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
function isStandLegal(
  player: PlayerState,
  targetLane: number
): boolean {
  // Target lane must exist
  if (targetLane < 0 || targetLane >= player.lanes.length) {
    return false;
  }

  // Target lane must not already be locked
  const lane = player.lanes[targetLane];
  if (lane.locked) {
    return false;
  }

  return true;
}
