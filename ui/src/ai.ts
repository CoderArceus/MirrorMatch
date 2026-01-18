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

import { GameState, PlayerAction } from '../../engine/src/types';
import { isActionLegal, resolveTurn } from '../../engine/src';
import type { TurnActions } from '../../engine/src/actions';

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
  
  // 2. Proximity to 21 (without busting)
  for (const lane of player.lanes) {
    if (!lane.busted && !lane.locked) {
      score += (21 - lane.total) * -0.5; // Closer to 21 is better
    }
    if (lane.busted) {
      score -= 10; // Bust is bad
    }
  }
  
  for (const lane of opponent.lanes) {
    if (!lane.busted && !lane.locked) {
      score -= (21 - lane.total) * -0.4; // Opponent close to 21 is bad for us
    }
  }
  
  // 3. Energy management
  score += player.energy * 3;
  score -= opponent.energy * 2;
  
  // 4. Locked lanes (stability)
  const playerLocked = player.lanes.filter(l => l.locked && !l.busted).length;
  const opponentLocked = opponent.lanes.filter(l => l.locked && !l.busted).length;
  score += playerLocked * 2;
  score -= opponentLocked * 1.5;
  
  return score;
}

// ============================================================================
// Legal Action Generation
// ============================================================================

/**
 * Get all legal actions for a player in current state
 */
function getLegalActions(state: GameState, playerId: string): PlayerAction[] {
  const actions: PlayerAction[] = [];
  const player = state.players.find(p => p.id === playerId);
  
  if (!player) return actions;
  
  // Try Take actions for each lane
  for (let lane = 0; lane < player.lanes.length; lane++) {
    const takeAction: PlayerAction = { type: 'take', targetLane: lane };
    if (isActionLegal(state, playerId, takeAction)) {
      actions.push(takeAction);
    }
  }
  
  // Try Burn action
  const burnAction: PlayerAction = { type: 'burn' };
  if (isActionLegal(state, playerId, burnAction)) {
    actions.push(burnAction);
  }
  
  // Try Stand actions for each lane
  for (let lane = 0; lane < player.lanes.length; lane++) {
    const standAction: PlayerAction = { type: 'stand', targetLane: lane };
    if (isActionLegal(state, playerId, standAction)) {
      actions.push(standAction);
    }
  }
  
  return actions;
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
  const opponentId = state.players[aiIndex === 0 ? 1 : 0].id;
  
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
  
  if (legalActions.length === 0) {
    // Should never happen if validators work, but provide fallback
    return { type: 'stand', targetLane: 0 };
  }
  
  if (legalActions.length === 1) {
    return legalActions[0];
  }
  
  // Assume opponent will take to lane 0 (simplification for 1-ply lookahead)
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
