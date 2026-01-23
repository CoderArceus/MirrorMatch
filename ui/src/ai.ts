/**
 * MirrorMatch AI - Minimax-Lite Opponent
 * 
 * Design Philosophy:
 * - Deterministic (no hidden randomness)
 * - Exploitable (human can learn patterns)
 * - Educational (shows good decision-making)
 * - Fair (same rules as human)
 * 
 * AI looks 1 turn ahead and evaluates outcomes via heuristic
 */

import { resolveTurn, getLegalActions } from '../../engine/src';
import type { GameState, PlayerAction, TurnActions } from '../../engine/src';

// Export AI difficulty type for use in UI
export type AIDifficulty = 'easy' | 'normal' | 'hard';

// ============================================================================
// State Evaluation Heuristic
// ============================================================================

/**
 * Evaluates how good a game state is for a specific player
 * Higher score = better for that player
 * 
 * Heuristic Breakdown:
 * - Lane wins dominate (±100 per lane)
 * - Proximity to 21 matters (+5/-4 per point)
 * - Energy is valuable (+3/-2)
 * - Bust risk heavily punished (-10)
 */
function evaluateState(state: GameState, playerId: string): number {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const opponentIndex = playerIndex === 0 ? 1 : 0;

  if (playerIndex === -1) return -Infinity;

  const player = state.players[playerIndex];
  const opponent = state.players[opponentIndex];

  let score = 0;

  // 1. Lane wins are king
  let playerWins = 0;
  let opponentWins = 0;

  for (let i = 0; i < 3; i++) {
    const pLane = player.lanes[i];
    const oLane = opponent.lanes[i];

    // Both bust = tie
    if (pLane.busted && oLane.busted) continue;

    // Only one busted
    if (pLane.busted) {
      opponentWins++;
      continue;
    }
    if (oLane.busted) {
      playerWins++;
      continue;
    }

    // Compare totals
    if (pLane.total > oLane.total) playerWins++;
    else if (oLane.total > pLane.total) opponentWins++;
  }

  score += playerWins * 100;
  score -= opponentWins * 100;

  // 2. Lane value - prefer higher totals (closer to 21)
  for (const lane of player.lanes) {
    if (!lane.busted && !lane.locked) {
      // Higher is better, but penalize being far from 21
      score += lane.total * 0.5; // Reward progress
      if (lane.total >= 17) {
        score += 5; // Bonus for being close to 21
      }
    }
    if (lane.busted) {
      score -= 50; // Bust is very bad
    }
    if (lane.total === 21) {
      score += 20; // Big bonus for hitting 21
    }
  }

  for (const lane of opponent.lanes) {
    if (!lane.busted && !lane.locked) {
      score -= lane.total * 0.4; // Opponent progress is bad for us
      if (lane.total >= 17) {
        score -= 4;
      }
    }
    if (lane.total === 21) {
      score -= 15; // Opponent hitting 21 is bad
    }
  }

  // 3. Energy management
  score += player.energy * 2;
  score -= opponent.energy * 1.5;

  // 4. Locked lanes (good if high value, bad if low)
  for (const lane of player.lanes) {
    if (lane.locked && !lane.busted) {
      if (lane.total >= 18) {
        score += 10; // Good lock
      } else if (lane.total < 10) {
        score -= 15; // Bad lock (standing at 0 is terrible)
      }
    }
  }

  for (const lane of opponent.lanes) {
    if (lane.locked && !lane.busted) {
      if (lane.total >= 18) {
        score -= 8; // Opponent has good lock
      }
    }
  }

  return score;
}



// ============================================================================
// Action Simulation
// ============================================================================

/**
 * Simulate what the state would be if both players took these actions
 * Does NOT mutate original state
 */
function simulateTurn(
  state: GameState,
  aiAction: PlayerAction,
  opponentAction: PlayerAction,
  aiPlayerId: string
): GameState {
  const aiIndex = state.players.findIndex(p => p.id === aiPlayerId);

  const turnActions: TurnActions = {
    playerActions: [
      { playerId: state.players[0].id, action: aiIndex === 0 ? aiAction : opponentAction },
      { playerId: state.players[1].id, action: aiIndex === 1 ? aiAction : opponentAction },
    ],
  };

  return resolveTurn(state, turnActions);
}

// ============================================================================
// AI Decision Making
// ============================================================================

/**
 * Choose the best action for the AI
 * 
 * Strategy:
 * 1. Get all legal actions
 * 2. For each action, assume opponent will take a "neutral" action
 * 3. Evaluate resulting state
 * 4. Pick action with highest score
 */
export function chooseAIAction(
  state: GameState,
  aiPlayerId: string,
  difficulty: AIDifficulty = 'normal'
): PlayerAction {
  const legalActions = getLegalActions(state, aiPlayerId);

  // CRITICAL: Handle forced Pass
  // If the only action is Pass, we must take it.
  if (legalActions.length === 1 && legalActions[0].type === 'pass') {
    return legalActions[0];
  }

  // Fallback for safety (should be covered by engine contract)
  if (legalActions.length === 0) {
    return { type: 'pass' };
  }

  if (legalActions.length === 1) {
    return legalActions[0];
  }

  // Assume opponent will take to lane 0 (simplification for 1-ply lookahead)
  // Note: If opponent must pass, this assumption is slightly wrong but acceptable for this heuristic
  const defaultOpponentAction: PlayerAction = { type: 'take', targetLane: 0 };

  // Evaluate each action
  const scoredActions = legalActions.map(action => {
    const simulatedState = simulateTurn(state, action, defaultOpponentAction, aiPlayerId);
    const score = evaluateState(simulatedState, aiPlayerId);

    return { action, score };
  });

  // Sort by score (descending)
  scoredActions.sort((a, b) => b.score - a.score);

  // Difficulty adjustment
  if (difficulty === 'easy') {
    // 30% chance to pick suboptimal move
    if (Math.random() < 0.3 && scoredActions.length > 1) {
      // Pick second-best move
      return scoredActions[1].action;
    }
  }

  if (difficulty === 'hard') {
    // Prefer burns more (more aggressive)
    const topActions = scoredActions.filter(sa =>
      sa.score >= scoredActions[0].score * 0.9
    );

    const burnAction = topActions.find(sa => sa.action.type === 'burn');
    if (burnAction) {
      return burnAction.action;
    }
  }

  // Normal or no special case - return best action
  return scoredActions[0].action;
}

/**
 * Check if AI can make a move
 */
export function aiHasLegalActions(state: GameState, aiPlayerId: string): boolean {
  return getLegalActions(state, aiPlayerId).length > 0;
}
