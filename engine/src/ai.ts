/**
 * MirrorMatch AI - Engine-Driven Action Selection
 * 
 * CRITICAL RULES:
 * - AI MUST use getLegalActions() as source of truth
 * - AI NEVER guesses legality
 * - AI NEVER bypasses engine rules
 * - Pass is handled automatically by engine contract
 * 
 * This is NOT a "smart" AI yet - it's a CORRECT AI.
 * Correctness comes first, then optimization.
 */

import { getLegalActions } from './validators';
import type { GameState, PlayerAction } from './types';

/**
 * AI difficulty levels
 * - easy: Random legal action selection
 * - medium: Simple heuristic evaluation (no lookahead)
 */
export type AIDifficulty = 'easy' | 'medium';

/**
 * Choose an action for the AI player
 * 
 * ENGINE CONTRACT:
 * - This function ALWAYS returns a legal action
 * - It uses getLegalActions() as the ONLY source of truth
 * - If forced to pass, it returns pass (engine guarantees this)
 * - No special cases, no UI inspection, no hidden state
 * 
 * @param state - Current game state
 * @param playerId - AI player's ID
 * @param difficulty - AI difficulty level
 * @returns A legal PlayerAction (guaranteed by engine)
 */
export function chooseAction(
  state: GameState,
  playerId: string,
  difficulty: AIDifficulty
): PlayerAction {
  // ENGINE CONTRACT: Always use getLegalActions as source of truth
  const legalActions = getLegalActions(state, playerId);

  // Engine guarantees at least one action exists (or game is over)
  // If only Pass exists, engine will return [{ type: 'pass' }]
  if (legalActions.length === 0) {
    throw new Error('ENGINE BUG: getLegalActions returned empty array for non-terminal state');
  }

  // If only one action available, return it (could be forced pass)
  if (legalActions.length === 1) {
    return legalActions[0];
  }

  // Difficulty-based selection
  switch (difficulty) {
    case 'easy':
      return chooseEasyAction(legalActions);
    
    case 'medium':
      return chooseMediumAction(state, playerId, legalActions);
    
    default:
      // Fallback to easy for unknown difficulty
      return chooseEasyAction(legalActions);
  }
}

// ============================================================================
// Easy AI - Random Selection (Baseline for Correctness)
// ============================================================================

/**
 * Easy AI: Select a random legal action
 * 
 * Purpose:
 * - Stress test the engine
 * - Validate turn flow
 * - Ensure no hidden assumptions
 * - Baseline for correctness
 * 
 * This AI is intentionally dumb - it's for testing, not playing well.
 */
function chooseEasyAction(legalActions: PlayerAction[]): PlayerAction {
  const randomIndex = Math.floor(Math.random() * legalActions.length);
  return legalActions[randomIndex];
}

// ============================================================================
// Medium AI - Simple Heuristic (No Lookahead)
// ============================================================================

/**
 * Medium AI: Score each legal action with a simple heuristic
 * 
 * RULES:
 * - NO minimax
 * - NO lookahead/recursion
 * - Deterministic scoring only
 * - Evaluate current state + immediate action consequences
 * 
 * Heuristic priorities:
 * 1. Win a lane immediately (hitting 21)
 * 2. Avoid busting
 * 3. Build toward 21
 * 4. Deny opponent visible wins
 * 5. Conserve energy when possible
 * 6. Pass is penalized (but legal if forced)
 */
function chooseMediumAction(
  state: GameState,
  playerId: string,
  legalActions: PlayerAction[]
): PlayerAction {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error('Invalid player ID');
  }

  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];

  // Score each action
  const scoredActions = legalActions.map(action => {
    let score = 0;

    // Evaluate action type
    switch (action.type) {
      case 'take': {
        const targetLane = player.lanes[action.targetLane];
        const frontCard = state.queue[0];
        
        if (!frontCard) {
          score = -1000; // Should never happen, but penalize
          break;
        }

        const cardValue = getCardValue(frontCard);
        const newTotal = targetLane.total + cardValue;

        // Perfect 21 is best
        if (newTotal === 21) {
          score += 1000;
        }
        // Close to 21 is good
        else if (newTotal >= 17 && newTotal <= 20) {
          score += 100 + (21 - newTotal) * 10;
        }
        // Building safely is okay
        else if (newTotal < 17) {
          score += 50 + newTotal * 2;
        }
        // Busting is very bad
        else if (newTotal > 21) {
          score -= 500;
        }

        // Bonus for improving lane that's behind opponent
        const opponentLane = opponent.lanes[action.targetLane];
        if (!opponentLane.busted && targetLane.total < opponentLane.total && newTotal <= 21) {
          score += 30;
        }

        break;
      }

      case 'burn': {
        const frontCard = state.queue[0];
        if (!frontCard) {
          score = -1000;
          break;
        }

        const cardValue = getCardValue(frontCard);

        // Burn high cards that could help opponent
        if (cardValue >= 10) {
          score += 80;
        }
        // Burn if opponent has many unlocked lanes and we don't
        const myUnlockedLanes = player.lanes.filter(l => !l.locked).length;
        const oppUnlockedLanes = opponent.lanes.filter(l => !l.locked).length;
        if (oppUnlockedLanes > myUnlockedLanes) {
          score += 50;
        }

        // Penalize burning if low on energy
        if (player.energy <= 1) {
          score -= 40;
        }

        break;
      }

      case 'stand': {
        const targetLane = player.lanes[action.targetLane];
        
        // Standing on good totals is great
        if (targetLane.total >= 19 && targetLane.total <= 21) {
          score += 200;
        }
        // Standing on okay totals is acceptable
        else if (targetLane.total >= 15 && targetLane.total <= 18) {
          score += 50;
        }
        // Standing on low totals is bad
        else if (targetLane.total < 15) {
          score -= 100;
        }

        // Bonus if we're beating opponent in this lane
        const opponentLane = opponent.lanes[action.targetLane];
        if (!opponentLane.busted && targetLane.total > opponentLane.total) {
          score += 80;
        }

        break;
      }

      case 'pass': {
        // Pass is heavily penalized (but still legal if forced)
        // If it's the only action, it will be the best by default
        score -= 1000;
        break;
      }
    }

    return { action, score };
  });

  // Sort by score (descending)
  scoredActions.sort((a, b) => b.score - a.score);

  // Return best action
  return scoredActions[0].action;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the value of a card (simplified - doesn't handle Ace optimization)
 * This is for quick heuristic evaluation only
 */
function getCardValue(card: { rank: string }): number {
  if (card.rank === 'ASH') return 1;
  if (card.rank === 'A') return 11;
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
  return parseInt(card.rank, 10);
}
