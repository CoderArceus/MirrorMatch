/**
 * Seque - Action Validators
 * Pure legality checks - NO resolution logic, NO side effects, NO mutation
 *
 * This module answers ONLY: "Is this action allowed to be attempted?"
 * NOT: "Is this action smart?" or "What happens if they do this?"
 *
 * Validation happens BEFORE resolution. If an action is illegal, it never resolves.
 */
// ============================================================================
// Constants
// ============================================================================
const AUCTION_TURNS = [4, 8];
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
export function getLegalActions(state, playerId) {
    // If game is over, no actions are legal (not even pass)
    if (state.gameOver) {
        return [];
    }
    const player = state.players.find(p => p.id === playerId);
    if (!player) {
        return [];
    }
    const legalActions = [];
    // Check for Dark Auction turns
    if (AUCTION_TURNS.includes(state.turnNumber)) {
        // In auction turns, ONLY BidAction is legal
        // Players can bid 0 to their current energy
        for (let bid = 0; bid <= player.energy; bid++) {
            // Day 26 Bug Fix: Must specify a valid lane for the Void Stone if they lose
            // Only lanes that have NEVER been shackled are valid targets
            for (let i = 0; i < player.lanes.length; i++) {
                if (!player.lanes[i].hasBeenShackled) {
                    legalActions.push({
                        type: 'bid',
                        bidAmount: bid,
                        potentialVoidStoneLane: i
                    });
                }
            }
        }
        return legalActions;
    }
    // Check all TAKE actions
    if (state.queue.length > 0) {
        for (let i = 0; i < player.lanes.length; i++) {
            if (!player.lanes[i].locked) {
                legalActions.push({ type: 'take', targetLane: i });
            }
        }
    }
    // Check BURN action
    // Day 26 Bug Fix: Burn is blocked by overheat (shared cooldown with BlindHit)
    // Burn requires energy > 0 AND overheat === 0
    if (state.queue.length > 0 && player.energy > 0 && player.overheat === 0) {
        legalActions.push({ type: 'burn' });
    }
    // Check all STAND actions
    for (let i = 0; i < player.lanes.length; i++) {
        // If lane is shackled, can only stand if total >= 20
        const lane = player.lanes[i];
        if (!lane.locked) {
            if (lane.shackled) {
                if (lane.total >= 20) {
                    legalActions.push({ type: 'stand', targetLane: i });
                }
            }
            else {
                legalActions.push({ type: 'stand', targetLane: i });
            }
        }
    }
    // Check BLIND HIT actions (v2.5)
    // Legal if: Lane is Shackled, Lane not locked, Deck has cards, overheat === 0
    // Day 26 Bug Fix: BlindHit is blocked by overheat (shared cooldown with Burn)
    if (state.deck.length > 0 && player.overheat === 0) {
        for (let i = 0; i < player.lanes.length; i++) {
            const lane = player.lanes[i];
            if (lane.shackled && !lane.locked) {
                legalActions.push({ type: 'blind_hit', targetLane: i });
            }
        }
    }
    // ENGINE CONTRACT: If no real actions exist, PASS is the only legal action
    if (legalActions.length === 0) {
        return [{ type: 'pass' }];
    }
    return legalActions;
}
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
export function isActionLegal(state, playerId, action) {
    const legalActions = getLegalActions(state, playerId);
    // For pass actions, check if it's the ONLY legal action
    if (action.type === 'pass') {
        return legalActions.length === 1 && legalActions[0].type === 'pass';
    }
    // For other actions, check if it exists in the legal actions list
    return legalActions.some(legalAction => {
        if (legalAction.type !== action.type) {
            return false;
        }
        // For actions with targetLane, check the lane matches
        if ('targetLane' in action && 'targetLane' in legalAction) {
            return action.targetLane === legalAction.targetLane;
        }
        // For BidAction, check bidAmount and potentialVoidStoneLane
        if (action.type === 'bid' && legalAction.type === 'bid') {
            return action.bidAmount === legalAction.bidAmount &&
                action.potentialVoidStoneLane === legalAction.potentialVoidStoneLane;
        }
        // For actions without targetLane (burn, pass), type match is sufficient
        return true;
    });
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
export function isTakeLegal(state, player, targetLane) {
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
export function isBurnLegal(state, player) {
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
export function isStandLegal(player, targetLane) {
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
