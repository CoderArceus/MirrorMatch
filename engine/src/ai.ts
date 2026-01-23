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
import type { GameState, PlayerAction, TurnActions } from './types';

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

// ============================================================================
// Hard AI - Minimax-Lite (2-Ply Lookahead with Draw Awareness)
// ============================================================================

/**
 * Hard AI: Minimax-lite with 2-ply lookahead
 * 
 * ALGORITHM:
 * 1. For each legal AI action:
 *    a. Simulate AI action
 *    b. For each opponent legal response:
 *       - Simulate opponent action
 *       - Evaluate resulting state
 *    c. Score AI action by WORST opponent outcome (minimax)
 * 2. Pick highest scoring AI action
 * 
 * DEPTH: 2 plies only (AI move + opponent response)
 * NO RECURSION beyond depth 2
 * NO ALPHA-BETA (yet)
 * 
 * DRAW AWARENESS:
 * - Draws score worse than "still fighting"
 * - AI prefers risky continuation over guaranteed draw
 * - Only accepts draw if loss is unavoidable
 */
function chooseHardAction(
  state: GameState,
  playerId: string,
  legalActions: PlayerAction[]
): PlayerAction {
  const opponentId = state.players.find(p => p.id !== playerId)?.id;
  if (!opponentId) {
    throw new Error('Invalid game state: opponent not found');
  }

  // Score each action using minimax-lite
  const scoredActions = legalActions.map(aiAction => {
    // Simulate all opponent responses to this AI action
    const opponentResponses = getLegalActions(state, opponentId);
    
    // Evaluate worst case (opponent's best response)
    let worstCaseScore = Infinity;
    
    for (const oppAction of opponentResponses) {
      // Simulate this turn
      const turnActions: TurnActions = {
        playerActions: [
          { playerId, action: aiAction },
          { playerId: opponentId, action: oppAction },
        ],
      };
      
      const nextState = resolveTurn(state, turnActions);
      
      // Evaluate resulting state from AI's perspective
      const score = evaluateState(nextState, playerId);
      
      // Minimax: opponent will pick move that's worst for us
      if (score < worstCaseScore) {
        worstCaseScore = score;
      }
    }
    
    return { action: aiAction, score: worstCaseScore };
  });

  // Sort by score (descending) and pick best
  scoredActions.sort((a, b) => b.score - a.score);
  
  return scoredActions[0].action;
}

/**
 * Evaluate a game state from the AI's perspective
 * 
 * CRITICAL SCORING RULES:
 * - Match win (≥2 lanes) is best: +1000
 * - Match loss (opponent ≥2 lanes) is worst: -1000
 * - Draw terminal state is bad: -300 (worse than continuing)
 * - Leading 1 lane is good: +200
 * - Trailing 1 lane is bad: -200
 * - Lane proximity to 21 matters
 * - Busts are heavily penalized
 * - Pass is neutral (handled by engine contract)
 * 
 * DRAW AWARENESS:
 * Draws must score worse than "still fighting" to encourage aggression.
 * This prevents the AI from playing for draws when it could win.
 * 
 * @param state - Game state to evaluate
 * @param aiPlayerId - AI player's ID
 * @returns Numeric score (higher is better for AI)
 */
function evaluateState(state: GameState, aiPlayerId: string): number {
  const aiIndex = state.players.findIndex(p => p.id === aiPlayerId);
  if (aiIndex === -1) return -Infinity;
  
  const ai = state.players[aiIndex];
  const opponent = state.players[aiIndex === 0 ? 1 : 0];
  
  let score = 0;
  
  // ============================================================================
  // TERMINAL STATE EVALUATION
  // ============================================================================
  
  if (state.gameOver) {
    if (state.winner === aiPlayerId) {
      return 10000; // Guaranteed win
    } else if (state.winner === null) {
      return -300; // Draw is bad - we want to keep fighting
    } else {
      return -10000; // Loss
    }
  }
  
  // ============================================================================
  // LANE WINS EVALUATION (2-out-of-3 win condition)
  // ============================================================================
  
  let aiLaneWins = 0;
  let oppLaneWins = 0;
  let contested = 0;
  
  for (let i = 0; i < 3; i++) {
    const aiLane = ai.lanes[i];
    const oppLane = opponent.lanes[i];
    
    // Determine lane winner (only for locked lanes or busts)
    if (aiLane.locked && oppLane.locked) {
      if (aiLane.busted && oppLane.busted) {
        // Both bust = draw lane
        contested++;
      } else if (aiLane.busted) {
        oppLaneWins++;
      } else if (oppLane.busted) {
        aiLaneWins++;
      } else if (aiLane.total > oppLane.total) {
        aiLaneWins++;
      } else if (oppLane.total > aiLane.total) {
        oppLaneWins++;
      } else {
        contested++;
      }
    } else {
      // Lane still in play
      contested++;
    }
  }
  
  // Match win/loss evaluation
  if (aiLaneWins >= 2) {
    score += 1000; // AI has match point
  }
  if (oppLaneWins >= 2) {
    score -= 1000; // Opponent has match point
  }
  
  // Single lane lead
  if (aiLaneWins === 1 && oppLaneWins === 0) {
    score += 200; // AI up 1-0
  } else if (oppLaneWins === 1 && aiLaneWins === 0) {
    score -= 200; // AI down 0-1
  }
  
  // ============================================================================
  // LANE QUALITY EVALUATION (for contested lanes)
  // ============================================================================
  
  for (let i = 0; i < 3; i++) {
    const aiLane = ai.lanes[i];
    const oppLane = opponent.lanes[i];
    
    // Skip if lane is decided
    if (aiLane.locked && oppLane.locked) continue;
    
    // AI lane evaluation
    if (!aiLane.busted && !aiLane.locked) {
      // Building toward 21
      if (aiLane.total === 21) {
        score += 150;
      } else if (aiLane.total >= 17 && aiLane.total <= 20) {
        score += 80 + (21 - aiLane.total) * 5;
      } else if (aiLane.total >= 12 && aiLane.total <= 16) {
        score += 40 + aiLane.total * 2;
      } else if (aiLane.total < 12) {
        score += aiLane.total * 3;
      }
    } else if (aiLane.locked && !aiLane.busted) {
      // Locked lanes - score based on total value
      if (aiLane.total >= 17) {
        score += 100 + aiLane.total; // Good lock
      } else if (aiLane.total >= 12) {
        score += aiLane.total; // Mediocre lock
      } else {
        // Terrible lock - locked at low value is a wasted lane
        score -= 100 - aiLane.total; // Worse the lower the total
      }
    } else if (aiLane.busted) {
      // Busted lane
      score -= 200;
    }
    
    // Opponent lane evaluation (inverted)
    if (!oppLane.busted && !oppLane.locked) {
      if (oppLane.total === 21) {
        score -= 150;
      } else if (oppLane.total >= 17 && oppLane.total <= 20) {
        score -= 80 + (21 - oppLane.total) * 5;
      } else if (oppLane.total >= 12 && oppLane.total <= 16) {
        score -= 40 + oppLane.total * 2;
      } else if (oppLane.total < 12) {
        score -= oppLane.total * 3;
      }
    } else if (oppLane.locked && !oppLane.busted) {
      // Opponent locked lanes
      if (oppLane.total >= 17) {
        score -= 100 + oppLane.total; // Bad for us
      } else if (oppLane.total >= 12) {
        score -= oppLane.total; // Mediocre
      } else {
        // Opponent locked low - good for us!
        score += 100 - oppLane.total;
      }
    } else if (oppLane.busted) {
      score += 200;
    }
    
    // Comparative advantage
    if (!aiLane.busted && !oppLane.busted) {
      if (aiLane.total > oppLane.total && aiLane.total <= 21) {
        score += 30;
      } else if (oppLane.total > aiLane.total && oppLane.total <= 21) {
        score -= 30;
      }
    }
  }
  
  // ============================================================================
  // RESOURCE EVALUATION
  // ============================================================================
  
  // Energy advantage
  score += ai.energy * 15;
  score -= opponent.energy * 15;
  
  // Flexibility (unlocked lanes)
  const aiUnlockedLanes = ai.lanes.filter(l => !l.locked).length;
  const oppUnlockedLanes = opponent.lanes.filter(l => !l.locked).length;
  score += aiUnlockedLanes * 20;
  score -= oppUnlockedLanes * 20;
  
  // ============================================================================
  // GAME PROGRESSION
  // ============================================================================
  
  // Slight bonus for having cards in queue (more options)
  if (state.queue.length > 0) {
    score += 5;
  }
  
  return score;
}
