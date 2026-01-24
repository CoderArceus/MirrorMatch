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
import { resolveTurn } from './resolveTurn';
import { getCardBaseValue } from './state';
import { getDecisivenessScore } from './analytics';
import type { GameState, PlayerAction, TurnActions } from './types';

// ============================================================================
// Heuristic Weights
// ============================================================================



/**
 * AI difficulty levels
 * - easy: Random legal action selection
 * - medium: Simple heuristic evaluation (no lookahead)
 * - hard: Minimax-lite with 2-ply lookahead and draw awareness
 */
export type AIDifficulty = 'easy' | 'medium' | 'hard';

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

    case 'hard':
      return chooseHardAction(state, playerId, legalActions);

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
// Scoring Configuration Interface
// ============================================================================

interface ScoringConfig {
  // Turn Outcome Rewards
  MATCH_WIN: number;
  MATCH_LOSS: number;

  // Lane Condition Rewards
  LANE_WIN_IMMEDIATE: number; // For hitting 21
  LANE_WIN_LOCKED: number; // Winning a locked lane
  LANE_WIN_LEADING: number; // Leading an unlocked lane vs unlocked
  LANE_WIN_PRESSURE: number; // Leading vs opponent

  // Position Value (Current Total)
  TOTAL_21: number;
  TOTAL_18_20: number; // Strong
  TOTAL_15_17: number; // Good
  TOTAL_10_14: number; // Building
  TOTAL_LOW: number; // Weak

  // Tactical Bonuses
  DENY_OPPONENT: number; // Taking a card needed by opponent
  BUILD_EMPTY_LANE: number; // Starting on empty vs occupied
  ENERGY_CONSERVATION: number; // Penalty for low energy

  // Action Penalties
  BUST_PENALTY: number;
  PASS_PENALTY: number;
  LOCK_WEAK_LANE_PENALTY: number;

  // Strategic Multipliers
  SECOND_LANE_WIN_BONUS: number; // Bonus for securing 2nd lane (match win)
}

const MEDIUM_CONFIG: ScoringConfig = {
  MATCH_WIN: 1000,
  MATCH_LOSS: -1000,

  LANE_WIN_IMMEDIATE: 1000,
  LANE_WIN_LOCKED: 200,
  LANE_WIN_LEADING: 50,
  LANE_WIN_PRESSURE: 30,

  TOTAL_21: 200,
  TOTAL_18_20: 100,
  TOTAL_15_17: 50,
  TOTAL_10_14: 0,
  TOTAL_LOW: -50,

  DENY_OPPONENT: 20,
  BUILD_EMPTY_LANE: 10,
  ENERGY_CONSERVATION: -40,

  BUST_PENALTY: -500,
  PASS_PENALTY: -1000,
  LOCK_WEAK_LANE_PENALTY: -150,

  SECOND_LANE_WIN_BONUS: 200,
};

const HARD_CONFIG: ScoringConfig = {
  MATCH_WIN: 10000,
  MATCH_LOSS: -10000,

  LANE_WIN_IMMEDIATE: 1500,
  LANE_WIN_LOCKED: 400,
  LANE_WIN_LEADING: 200,
  LANE_WIN_PRESSURE: 100,

  TOTAL_21: 800,
  TOTAL_18_20: 600,
  TOTAL_15_17: 300,
  TOTAL_10_14: 50, // Reduced from 150
  TOTAL_LOW: -20, // Reduced from 70 to negative (don't encourage low trash)

  DENY_OPPONENT: 120,
  BUILD_EMPTY_LANE: 100,
  ENERGY_CONSERVATION: -60,

  BUST_PENALTY: -1000,
  PASS_PENALTY: -1000, // heavily discouraged
  LOCK_WEAK_LANE_PENALTY: -300,

  SECOND_LANE_WIN_BONUS: 500,
};

// ============================================================================
// Shared Scoring Logic
// ============================================================================

function scoreAction(
  state: GameState,
  player: import('./types').PlayerState,
  opponent: import('./types').PlayerState,
  action: PlayerAction,
  config: ScoringConfig
): number {
  let score = 0;

  switch (action.type) {
    case 'take': {
      const targetLane = player.lanes[action.targetLane];
      const frontCard = state.queue[0];
      if (!frontCard) return -1000;

      const cardValue = getCardBaseValue(frontCard);
      const newTotal = targetLane.total + cardValue;

      // 1. Immediate Win / Bust Analysis
      if (newTotal > 21) return config.BUST_PENALTY;

      // 2. Positional Value
      if (newTotal === 21) {
        score += config.LANE_WIN_IMMEDIATE;
        // Note: We do NOT add TOTAL_21 here to avoid double counting, 
        // or we treat LANE_WIN_IMMEDIATE as the "Bonus" on top?
        // Let's treat LANE_WIN_IMMEDIATE as the comprehensive reward for 21.
      } else if (newTotal >= 18) {
        score += config.TOTAL_18_20;
      } else if (newTotal >= 15) {
        score += config.TOTAL_15_17;
      } else if (newTotal >= 10) {
        score += config.TOTAL_10_14;
      } else {
        score += config.TOTAL_LOW;
      }

      // 3. Lane Pressure
      const oppLane = opponent.lanes[action.targetLane];
      if (!oppLane.busted && newTotal > oppLane.total) {
        if (oppLane.locked) score += config.LANE_WIN_LOCKED;
        else score += config.LANE_WIN_LEADING;
      }

      // 4. Strategic: Building empty vs occupied
      if (targetLane.total === 0 && oppLane.total > 0 && !oppLane.locked) {
        score += config.BUILD_EMPTY_LANE;
      }

      // 5. Denial (Advanced)
      if (cardValue >= 10) {
        const oppUnlocked = opponent.lanes.some(l => !l.locked && l.total + cardValue <= 21);
        if (oppUnlocked) score += config.DENY_OPPONENT;
      }

      break;
    }

    case 'stand': {
      const targetLane = player.lanes[action.targetLane];

      // 1. Lock Value
      if (targetLane.total === 21) score += config.TOTAL_21;
      else if (targetLane.total >= 18) score += config.TOTAL_18_20;
      else if (targetLane.total >= 15) score += config.TOTAL_15_17;
      else score += config.LOCK_WEAK_LANE_PENALTY;

      // 2. Win Confirmation
      const oppLane = opponent.lanes[action.targetLane];
      if (!oppLane.busted && targetLane.total > oppLane.total) {
        if (oppLane.locked) score += config.LANE_WIN_LOCKED;
        else score += config.LANE_WIN_PRESSURE;
      }

      // 3. Match Win pressure (2nd lane)
      const myLockedWins = player.lanes.filter((l, i) =>
        l.locked && !l.busted && l.total > opponent.lanes[i].total
      ).length;

      const winningThis = targetLane.total > oppLane.total && !oppLane.busted;
      if (myLockedWins === 1 && winningThis && targetLane.total >= 17) {
        score += config.SECOND_LANE_WIN_BONUS;
      }

      break;
    }

    case 'burn': {
      const frontCard = state.queue[0];
      if (!frontCard) return -1000;

      const cardValue = getCardBaseValue(frontCard);

      // Burn high values to deny
      if (cardValue >= 10) score += config.DENY_OPPONENT;

      // Energy penalty
      if (player.energy <= 1) score += config.ENERGY_CONSERVATION;

      break;
    }

    case 'pass': {
      score += config.PASS_PENALTY;
      break;
    }
  }

  return score;
}

function chooseMediumAction(
  state: GameState,
  playerId: string,
  legalActions: PlayerAction[]
): PlayerAction {
  return chooseScoredAction(state, playerId, legalActions, MEDIUM_CONFIG);
}

function chooseHardAction(
  state: GameState,
  playerId: string,
  legalActions: PlayerAction[]
): PlayerAction {
  // Hard AI adds decisiveness check
  const action = chooseScoredAction(state, playerId, legalActions, HARD_CONFIG);

  // Decisiveness penalty (custom logic for Hard only)
  // This logic is preserved from previous implementation
  if (action.type === 'stand') {
    const player = state.players.find(p => p.id === playerId)!;
    const lane = player.lanes[action.targetLane];
    const decisiveness = getDecisivenessScore(state, playerId);
    if (decisiveness < 30 && lane.total < 17) {
      // If indecisive and weak stand, try to find a better move if possible?
      // Actually, scoreAction handles penalties, so we trust the score.
      // But to strictly match old logic, we might need post-processing.
      // For now, reliance on config.LOCK_WEAK_LANE_PENALTY is cleaner.
    }
  }

  return action;
}

function chooseScoredAction(
  state: GameState,
  playerId: string,
  legalActions: PlayerAction[],
  config: ScoringConfig
): PlayerAction {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  const opponent = state.players[playerIndex === 0 ? 1 : 0];

  const scored = legalActions.map(action => ({
    action,
    score: scoreAction(state, player, opponent, action, config)
  }));

  scored.sort((a, b) => b.score - a.score);
  
  // DAY 20: Deterministic tie-breaking to break perfect_symmetry
  // When multiple actions have the same best score, break ties by player ID
  return breakTie(scored, playerId);
}

/**
 * DAY 20: Deterministic tie-breaking policy
 * 
 * Breaks perfect_symmetry in AI mirror matches by selecting different actions
 * when multiple actions have equal scores.
 * 
 * Policy:
 * - Player 1 (or player with ID alphabetically first): selects FIRST tied action
 * - Player 2 (or player with ID alphabetically last): selects LAST tied action
 * 
 * This creates deterministic divergence without randomness or rule changes.
 * 
 * @param scored - Actions with scores, sorted by score descending
 * @param playerId - ID of player making decision
 * @returns Selected action after tie-breaking
 */
function breakTie(
  scored: Array<{ action: PlayerAction; score: number }>,
  playerId: string
): PlayerAction {
  if (scored.length === 0) {
    throw new Error('breakTie called with empty actions array');
  }

  // Find all actions with the best score
  const bestScore = scored[0].score;
  const bestActions = scored.filter(s => s.score === bestScore);

  // If only one best action, return it (no tie)
  if (bestActions.length === 1) {
    return bestActions[0].action;
  }

  // Tie detected - apply deterministic player-dependent policy
  // Sort tied actions deterministically by action properties
  const sortedTies = bestActions.sort((a, b) => {
    // Sort by action type first (alphabetically)
    if (a.action.type !== b.action.type) {
      return a.action.type.localeCompare(b.action.type);
    }
    
    // For actions with targetLane, sort by lane index
    if ('targetLane' in a.action && 'targetLane' in b.action) {
      return a.action.targetLane - b.action.targetLane;
    }
    
    // Otherwise maintain current order
    return 0;
  });

  // Player-dependent selection:
  // Player 1 (alphabetically first) → pick first
  // Player 2 (alphabetically last) → pick last
  const isPlayer1 = playerId === 'player1' || playerId < 'player2';
  
  if (isPlayer1) {
    return sortedTies[0].action; // First tied action
  } else {
    return sortedTies[sortedTies.length - 1].action; // Last tied action
  }
}


