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

const SCORES = {
  // Lane Outcomes
  MATCH_WIN: 10000,
  MATCH_LOSS: -10000,
  TERMINAL_DRAW: -300, // Worse than playing on
  LANE_LEAD: 200,
  LANE_TRAIL: -200,

  // Tactical
  PERFECT_21: 150,
  BUST: -200,
  GOOD_LOCK_THRESHOLD: 17,
  MEDIOCRE_LOCK_THRESHOLD: 12,

  // Action Selection (Medium AI)
  TAKE_21: 1000,
  TAKE_GOOD: 100, // 17-20
  TAKE_SAFE: 50,  // <17
  TAKE_BUST: -500,
  STAND_GOOD: 200, // 19-21
  STAND_OK: 50,    // 15-18
  STAND_BAD: -150, // 10-14
  STAND_TERRIBLE: -500, // <10
  BURN_HIGH_VALUE: 80,
  BURN_TACTICAL: 50,
  BURN_LOW_ENERGY: -40,
  PASS_PENALTY: -10000, // Pass is absolute last resort
};

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

        const cardValue = getCardBaseValue(frontCard);
        const newTotal = targetLane.total + cardValue;

        // Perfect 21 is best
        if (newTotal === 21) {
          score += SCORES.TAKE_21;
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
          score += SCORES.TAKE_BUST;
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

        const cardValue = getCardBaseValue(frontCard);

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
        // Standing on mediocre totals is bad
        else if (targetLane.total >= 10 && targetLane.total < 15) {
          score -= 150;
        }
        // Standing on very low totals is terrible
        else if (targetLane.total < 10) {
          score -= 500; // NEVER stand on empty/low lanes
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



// ============================================================================
// Hard AI - Minimax-Lite (2-Ply Lookahead with Draw Awareness)
// ============================================================================

/**
 * Hard AI: Tuned Greedy Heuristic
 * 
 * DESIGN RATIONALE:
 * After empirical testing, minimax-lite (2-ply) performed WORSE than Medium AI.
 * 100-game simulation: Medium 37%, Hard 31%, Draw 32%
 * 
 * ROOT CAUSE:
 * - MirrorMatch is short-horizon and commitment-heavy
 * - 2-ply lookahead is too shallow to overcome greedy heuristic
 * - Penalizing strong cards (10, Ace) as "risky" was incorrect
 * - Valuing "flexibility" over concrete advantage was wrong
 * 
 * NEW APPROACH:
 * Hard AI uses a REFINED greedy heuristic that outperforms Medium by:
 * - Valuing immediate lane wins aggressively
 * - Committing to strong positions (18-21) decisively
 * - Denying opponent visible threats
 * - Avoiding draws by pursuing 2-lane victories
 * - Taking strong cards confidently (no commitment penalty)
 * 
 * NO LOOKAHEAD. Just better immediate evaluation.
 */
function chooseHardAction(
  state: GameState,
  playerId: string,
  legalActions: PlayerAction[]
): PlayerAction {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];

  // CRITICAL: Pre-filter out actions that would bust
  const safeActions = legalActions.filter(action => {
    if (action.type === 'take') {
      const targetLane = player.lanes[action.targetLane];
      const frontCard = state.queue[0];
      if (frontCard) {
        const cardValue = getCardBaseValue(frontCard);
        const newTotal = targetLane.total + cardValue;
        if (newTotal > 21) {
          return false; // Would bust
        }
      }
    }
    return true;
  });

  const actionsToEvaluate = safeActions.length > 0 ? safeActions : legalActions;

  // Score each action with TUNED GREEDY HEURISTIC
  const scoredActions = actionsToEvaluate.map(action => {
    let score = 0;

    switch (action.type) {
      case 'take': {
        const targetLane = player.lanes[action.targetLane];
        const frontCard = state.queue[0];

        if (!frontCard) {
          score = -1000;
          break;
        }

        const cardValue = getCardBaseValue(frontCard);
        const newTotal = targetLane.total + cardValue;

        // IMMEDIATE LANE WIN — highest priority
        if (newTotal === 21) {
          score += 1500; // INCREASED: Lock in perfection
        }
        // STRONG POSITION (18-20) — commit aggressively
        else if (newTotal >= 18 && newTotal <= 20) {
          score += 600 + (newTotal * 15); // INCREASED: Commit to strong lanes
        }
        // GOOD POSITION (15-17) — solid
        else if (newTotal >= 15 && newTotal <= 17) {
          score += 300 + (newTotal * 8); // INCREASED: Build solid positions
        }
        // BUILDING (10-14)
        else if (newTotal >= 10 && newTotal <= 14) {
          score += 150 + (newTotal * 4);
        }
        // LOW (<10)
        else {
          score += 70 + (newTotal * 3);
        }

        // LANE WIN PRESSURE
        const oppLane = opponent.lanes[action.targetLane];
        if (!oppLane.busted && newTotal > oppLane.total && newTotal <= 21) {
          if (oppLane.locked) {
            score += 400; // INCREASED: Winning a decided lane!
          } else {
            score += 200; // INCREASED: Leading unlocked lane
          }
        }

        // BONUS: Taking on empty lane vs opponent's established lane
        if (targetLane.total === 0 && oppLane.total > 0 && !oppLane.locked) {
          score += 100; // Start building to compete
        }

        // SECOND LANE WIN — avoid draws (CRITICAL)
        const myWonLanes = player.lanes.filter((l, i) =>
          !l.busted && l.locked && l.total > opponent.lanes[i].total && l.total <= 21
        ).length;

        if (myWonLanes === 1 && newTotal >= 19) {
          score += 500; // MASSIVE: Close out the match!
        } else if (myWonLanes === 1 && newTotal >= 17) {
          score += 300; // Strong: Push for decisive win
        }

        // DENY HIGH-VALUE CARDS (but prioritize using them yourself)
        if (cardValue >= 10) {
          const oppUnlockedLanes = opponent.lanes.filter(l => !l.locked);
          const oppCanUse = oppUnlockedLanes.some(l => l.total + cardValue <= 21);
          if (oppCanUse && oppUnlockedLanes.length <= 2) {
            score += 120; // INCREASED: Taking denies them AND builds us
          }
        } else if (cardValue >= 7) {
          score += 60; // Medium-value cards are also good
        }

        break;
      }

      case 'burn': {
        const frontCard = state.queue[0];
        if (!frontCard) {
          score = -1000;
          break;
        }

        const cardValue = getCardBaseValue(frontCard);

        // Burn high-value cards (but not as good as taking them)
        if (cardValue >= 10) {
          score += 100; // REDUCED: Taking is better than burning
        } else if (cardValue >= 7) {
          score += 50;
        } else {
          score += 15;
        }

        // Burn if opponent has advantage
        const myUnlockedLanes = player.lanes.filter(l => !l.locked).length;
        const oppUnlockedLanes = opponent.lanes.filter(l => !l.locked).length;

        if (oppUnlockedLanes > myUnlockedLanes) {
          score += 80;
        }

        // Energy conservation
        if (player.energy <= 1) {
          score -= 60;
        }

        break;
      }

      case 'stand': {
        const targetLane = player.lanes[action.targetLane];

        // Value based on total
        if (targetLane.total === 21) {
          score += 800; // INCREASED: Lock perfection
        } else if (targetLane.total >= 19) {
          score += 500; // INCREASED: Strong lock
        } else if (targetLane.total >= 17) {
          score += 250; // INCREASED: Good lock
        } else if (targetLane.total >= 15) {
          score += 80;
        } else {
          score -= 300; // INCREASED PENALTY: Don't lock weak lanes
        }

        // Winning this lane?
        const oppLane = opponent.lanes[action.targetLane];
        if (!oppLane.busted && targetLane.total > oppLane.total) {
          if (oppLane.locked) {
            score += 400; // Locked win
          } else {
            score += 100;
          }
        }

        // SECOND LANE WIN (CRITICAL ANTI-DRAW)
        const myWonLanes = player.lanes.filter((l, i) =>
          l.locked && !l.busted && l.total > opponent.lanes[i].total
        ).length;

        const wouldWinThisLane = targetLane.total > oppLane.total && !oppLane.busted;

        if (myWonLanes === 1 && wouldWinThisLane && targetLane.total >= 18) {
          score += 700; // MASSIVE: End the game NOW!
        } else if (myWonLanes === 1 && wouldWinThisLane && targetLane.total >= 16) {
          score += 400; // Strong: Close to decisive win
        }

        break;
      }

      case 'pass': {
        // DAY 16: Penalize pass heavily (indicates indecision/stall)
        score -= 1000;
        break;
      }
    }

    // DAY 16: Anti-draw incentive - penalize low decisiveness
    // This creates pressure to commit rather than stall
    const decisiveness = getDecisivenessScore(state, playerId);
    if (decisiveness < 30) {
      // State is indecisive - penalize passive actions
      if (action.type === 'stand' && player.lanes[action.targetLane].total < 17) {
        score -= 100; // Don't lock weak lanes when indecisive
      }
    }

    return { action, score };
  });

  scoredActions.sort((a, b) => b.score - a.score);
  return scoredActions[0].action;
}


