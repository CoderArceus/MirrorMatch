/**
 * MirrorMatch: Strategic 21 - Analytics Module
 * Pure functions for analyzing game outcomes, explaining results, and detecting achievements.
 * 
 * Moved from UI to Engine to centralize domain logic.
 */

import { GameState, LaneState } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Draw reasons - categorizes why a game ended in a draw
 * 
 * DAY 16 ADDITIONS:
 * New primary categories for better analytics and AI tuning
 */
export type DrawReason =
    // Primary categories (Day 16)
    | 'mutual_pass'           // Both players passed, ending game in draw
    | 'lane_split'            // Each won 1 lane, remaining contested/tied
    | 'deck_exhausted'        // Deck ran out with scores tied
    | 'stall_equilibrium'     // Both locked all lanes early, tied scores
    
    // Legacy categories (backward compatibility)
    | 'perfect_symmetry'      // Identical lane results
    | 'energy_exhaustion'     // No legal actions remain
    | 'mutual_perfection'     // Both hit 21 in equal lanes
    | 'stall_lock'           // All lanes locked with equal score
    | 'equal_lanes'          // Each won 1 lane
    | 'tiebreaker_equal';    // Tiebreaker values equal

export type SkillBadge =
    | '🎯 Precision'         // Hit 21 exactly
    | '🔥 Denial'            // Successful burn that flipped a lane
    | '🧠 Efficiency'        // Won with more energy
    | '🧊 Stability'         // No busted lanes
    | '⚖️ Mirror';           // Perfect symmetry draw

export type LaneOutcome = {
    winner: 'player1' | 'player2' | 'tie';
    reason: string;
    p1Total: number;
    p2Total: number;
};

// ============================================================================
// Lane Analysis
// ============================================================================

export function analyzeLane(p1Lane: LaneState, p2Lane: LaneState): LaneOutcome {
    const p1Total = p1Lane.total;
    const p2Total = p2Lane.total;

    // Both bust = tie
    if (p1Lane.busted && p2Lane.busted) {
        return {
            winner: 'tie',
            reason: 'Both players busted',
            p1Total,
            p2Total,
        };
    }

    // P1 busted = P2 wins
    if (p1Lane.busted) {
        return {
            winner: 'player2',
            reason: 'Player 1 busted',
            p1Total,
            p2Total,
        };
    }

    // P2 busted = P1 wins
    if (p2Lane.busted) {
        return {
            winner: 'player1',
            reason: 'Player 2 busted',
            p1Total,
            p2Total,
        };
    }

    // Check for exact 21
    if (p1Total === 21 && p2Total !== 21) {
        return {
            winner: 'player1',
            reason: 'Player 1 hit exact 21',
            p1Total,
            p2Total,
        };
    }

    if (p2Total === 21 && p1Total !== 21) {
        return {
            winner: 'player2',
            reason: 'Player 2 hit exact 21',
            p1Total,
            p2Total,
        };
    }

    if (p1Total === 21 && p2Total === 21) {
        return {
            winner: 'tie',
            reason: 'Both hit exact 21',
            p1Total,
            p2Total,
        };
    }

    // Neither busted - compare totals
    if (p1Total > p2Total) {
        return {
            winner: 'player1',
            reason: `Player 1 closer to 21 (${p1Total} > ${p2Total})`,
            p1Total,
            p2Total,
        };
    }

    if (p2Total > p1Total) {
        return {
            winner: 'player2',
            reason: `Player 2 closer to 21 (${p2Total} > ${p1Total})`,
            p1Total,
            p2Total,
        };
    }

    // Equal totals = tie
    return {
        winner: 'tie',
        reason: `Tied at ${p1Total}`,
        p1Total,
        p2Total,
    };
}

// ============================================================================
// Draw Classification
// ============================================================================

export function classifyDraw(state: GameState): { type: DrawReason; explanation: string } {
    if (!state.winner && state.gameOver) {
        const p1 = state.players[0];
        const p2 = state.players[1];

        // Analyze all lanes
        const outcomes = [
            analyzeLane(p1.lanes[0], p2.lanes[0]),
            analyzeLane(p1.lanes[1], p2.lanes[1]),
            analyzeLane(p1.lanes[2], p2.lanes[2]),
        ];

        const p1Wins = outcomes.filter(o => o.winner === 'player1').length;
        const p2Wins = outcomes.filter(o => o.winner === 'player2').length;
        const ties = outcomes.filter(o => o.winner === 'tie').length;

        // Check for 21s in lanes
        const p1Has21 = outcomes.filter(o => o.winner === 'player1' && o.p1Total === 21).length;
        const p2Has21 = outcomes.filter(o => o.winner === 'player2' && o.p2Total === 21).length;

        // Case 1: Mutual Perfection - Both hit 21 in equal lanes
        if (p1Has21 > 0 && p2Has21 > 0 && p1Wins === p2Wins) {
            return {
                type: 'mutual_perfection',
                explanation: `Both players hit 21 in ${p1Has21} lane(s). Neither gained an advantage.`,
            };
        }

        // Case 2: Perfect Symmetry - All lanes tied
        if (ties === 3) {
            return {
                type: 'perfect_symmetry',
                explanation: 'All three lanes ended in ties. Perfect symmetry.',
            };
        }

        // Case 3: Each won 1 lane, 1 tie
        if (p1Wins === 1 && p2Wins === 1 && ties === 1) {
            return {
                type: 'perfect_symmetry',
                explanation: 'Both players won 1 lane and tied 1 lane, with equal winning lane values.',
            };
        }

        // Case 4: Each won 1 lane, tiebreaker equal
        if (p1Wins === 1 && p2Wins === 1 && ties === 0) {
            const p1WinningLane = outcomes.find(o => o.winner === 'player1');
            const p2WinningLane = outcomes.find(o => o.winner === 'player2');
            return {
                type: 'tiebreaker_equal',
                explanation: `Both players won 1 lane each. Tiebreaker compared winning values (${p1WinningLane?.p1Total} vs ${p2WinningLane?.p2Total}), which were equal.`,
            };
        }

        // Case 5: Energy Exhaustion - No legal actions
        const p1HasEnergy = p1.energy > 0;
        const p2HasEnergy = p2.energy > 0;
        const p1HasUnlockedLanes = p1.lanes.some(l => !l.locked);
        const p2HasUnlockedLanes = p2.lanes.some(l => !l.locked);

        if (!p1HasEnergy && !p2HasEnergy && (!p1HasUnlockedLanes || !p2HasUnlockedLanes)) {
            return {
                type: 'energy_exhaustion',
                explanation: 'Both players ran out of energy with all lanes locked. No further legal actions were possible.',
            };
        }

        // Case 6: Stall Lock - All lanes locked
        if (p1.lanes.every(l => l.locked) && p2.lanes.every(l => l.locked)) {
            return {
                type: 'stall_lock',
                explanation: 'All lanes locked with equal overall score.',
            };
        }

        // Case 7: Deck Exhausted
        if (state.deck.length === 0 && state.queue.length === 0) {
            return {
                type: 'deck_exhausted',
                explanation: 'Deck exhausted with lanes in tied state.',
            };
        }
    }

    return {
        type: 'equal_lanes',
        explanation: 'Game reached a solved terminal state with equal scores.',
    };
}

// ============================================================================
// Game End Explanation
// ============================================================================

export function getEndReason(state: GameState): string {
    // Check if all lanes are locked
    const allLanesLocked = state.players.every(p => p.lanes.every(l => l.locked));
    if (allLanesLocked) {
        return 'All lanes are locked. No legal actions remain.';
    }

    // Check if deck and queue are exhausted
    if (state.deck.length === 0 && state.queue.length === 0) {
        return 'Deck and queue are exhausted. No cards remain.';
    }

    return 'Victory condition reached.';
}

export function getWinnerExplanation(state: GameState): string {
    if (!state.winner) {
        return 'Both players achieved equal scores across all lanes.';
    }

    const winnerName = state.winner === 'player1' ? 'Player 1' : 'Player 2';
    return `${winnerName} won 2 out of 3 lanes.`;
}

export function explainGameEnd(state: GameState): string[] {
    const explanations: string[] = [];

    if (!state.gameOver) return explanations;

    const p1 = state.players[0];
    const p2 = state.players[1];

    // Win explanation
    if (state.winner) {
        const outcomes = [
            analyzeLane(p1.lanes[0], p2.lanes[0]),
            analyzeLane(p1.lanes[1], p2.lanes[1]),
            analyzeLane(p1.lanes[2], p2.lanes[2]),
        ];

        const winnerName = state.winner === 'player1' ? 'Player 1' : (state.winner === 'player2' ? 'AI' : 'Player 2');
        const winningLanes = outcomes.filter(o => o.winner === state.winner).length;

        explanations.push(`${winnerName} won ${winningLanes} out of 3 lanes.`);

        // Highlight key moments
        const perfectLanes = outcomes.filter(o =>
            (o.winner === state.winner && (o.p1Total === 21 || o.p2Total === 21))
        ).length;

        if (perfectLanes > 0) {
            explanations.push(`${perfectLanes} winning lane(s) hit exactly 21.`);
        }

        const bustLanes = outcomes.filter(o =>
            (o.winner !== state.winner && o.reason.includes('busted'))
        ).length;

        if (bustLanes > 0) {
            explanations.push(`Opponent busted in ${bustLanes} lane(s).`);
        }
    } else {
        // Draw explanation
        const drawInfo = classifyDraw(state);
        explanations.push(drawInfo.explanation);
    }

    // Game length
    const turns = state.turnNumber - 1;
    explanations.push(`Game lasted ${turns} turn${turns === 1 ? '' : 's'}.`);

    return explanations;
}

// ============================================================================
// Skill Badge Detection
// ============================================================================

export function detectSkillBadge(state: GameState, playerId: string): SkillBadge | null {
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return null;

    const player = state.players[playerIndex];
    const opponent = state.players[playerIndex === 0 ? 1 : 0];

    // 🎯 Precision - Hit 21 exactly
    const has21 = player.lanes.some(l => l.total === 21 && !l.busted);
    if (has21) return '🎯 Precision';

    // 🧊 Stability - No busted lanes (and won)
    const noBusts = !player.lanes.some(l => l.busted);
    if (noBusts && state.winner === playerId) return '🧊 Stability';

    // 🧠 Efficiency - Won with more energy remaining
    if (state.winner === playerId && player.energy > opponent.energy) {
        return '🧠 Efficiency';
    }

    // ⚖️ Mirror - Perfect symmetry draw
    if (!state.winner) {
        const drawInfo = classifyDraw(state);
        if (drawInfo.type === 'perfect_symmetry') {
            return '⚖️ Mirror';
        }
    }

    // 🔥 Denial - Would need turn-by-turn analysis

    return null;
}

// ============================================================================
// DAY 16: Draw Analysis & Decisiveness Metrics
// ============================================================================

/**
 * Analyze why a draw occurred (Day 16 primary function)
 * 
 * PURPOSE:
 * - Feed AI evaluation (penalize certain draw types)
 * - Explain draws to players
 * - Identify balance issues
 * - Guide tuning decisions
 * 
 * DETERMINISTIC: Same state always returns same reason
 * 
 * @param state - Terminal game state (must be a draw)
 * @returns Primary reason for the draw
 */
export function analyzeDraw(state: GameState): DrawReason {
    if (!state.gameOver || state.winner !== null) {
        throw new Error('analyzeDraw called on non-draw game state');
    }

    const p1 = state.players[0];
    const p2 = state.players[1];

    const allLanesLocked = p1.lanes.every(l => l.locked) && p2.lanes.every(l => l.locked);
    const deckAndQueueEmpty = state.deck.length === 0 && state.queue.length === 0;
    
    // Priority 1: Check for lane split (1-1-1 scenario)
    // This is the most common draw pattern
    const outcomes = [
        analyzeLane(p1.lanes[0], p2.lanes[0]),
        analyzeLane(p1.lanes[1], p2.lanes[1]),
        analyzeLane(p1.lanes[2], p2.lanes[2]),
    ];

    const p1Wins = outcomes.filter(o => o.winner === 'player1').length;
    const p2Wins = outcomes.filter(o => o.winner === 'player2').length;

    if (p1Wins === 1 && p2Wins === 1) {
        // Classic 1-1 split with tie in third lane
        return 'lane_split';
    }

    // Priority 2: Check for mutual pass
    // Happens when both players passed (all lanes locked but cards remain)
    if (allLanesLocked && !deckAndQueueEmpty) {
        // Both locked all lanes but cards remain - indicates mutual pass
        return 'mutual_pass';
    }

    // Priority 3: Stall equilibrium (both locked early)
    if (allLanesLocked) {
        return 'stall_equilibrium';
    }

    // Priority 4: Check for deck exhaustion
    // Only use this if other patterns don't apply
    if (deckAndQueueEmpty) {
        return 'deck_exhausted';
    }

    // Fall back to legacy classification for complex cases
    return 'equal_lanes';
}

/**
 * Get decisiveness score - measures how close a state is to resolution
 * 
 * PURPOSE:
 * - Feed AI evaluation (avoid indecisive positions)
 * - Track game pressure over time
 * - Identify stall patterns
 * 
 * SCORE COMPONENTS:
 * - Contestable lanes (fewer = more decisive)
 * - Distance to 21 in best lane (closer = more decisive)
 * - Energy remaining (less = more decisive)
 * - Locked lanes (more = more decisive)
 * 
 * RANGE: 0 (deadlocked) to 100 (highly decisive)
 * 
 * @param state - Current game state
 * @param playerId - Player to evaluate
 * @returns Decisiveness score (0-100)
 */
export function getDecisivenessScore(state: GameState, playerId: string): number {
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return 0;

    const player = state.players[playerIndex];
    const opponent = state.players[playerIndex === 0 ? 1 : 0];

    let score = 0;

    // Factor 1: Contestable lanes (30 pts)
    // Fewer contestable lanes = more decisive
    const contestableLanes = player.lanes.filter((lane, i) => {
        const oppLane = opponent.lanes[i];
        return !lane.locked || !oppLane.locked;
    }).length;
    
    score += (3 - contestableLanes) * 10; // 0, 10, 20, or 30 pts

    // Factor 2: Best lane proximity to 21 (30 pts)
    // Closer to 21 = more decisive
    const bestLane = Math.max(...player.lanes.filter(l => !l.busted).map(l => l.total));
    if (bestLane >= 19) {
        score += 30; // Very close
    } else if (bestLane >= 17) {
        score += 20; // Close
    } else if (bestLane >= 15) {
        score += 10; // Moderate
    }

    // Factor 3: Lane wins achieved (25 pts)
    // More lane wins = more decisive
    const laneWins = player.lanes.filter((lane, i) => {
        const oppLane = opponent.lanes[i];
        if (lane.busted || oppLane.busted) {
            return !lane.busted && oppLane.busted;
        }
        return lane.locked && oppLane.locked && lane.total > oppLane.total;
    }).length;
    
    score += laneWins * 12.5; // 0, 12.5, 25, or 37.5 pts

    // Factor 4: Energy depletion (15 pts)
    // Less energy = more decisive (forced commitment)
    const energyPct = 1 - (player.energy / 3);
    score += energyPct * 15;

    return Math.min(100, Math.round(score));
}

/**
 * Detect missed win opportunities
 * 
 * Identifies if a player could have won but didn't commit
 * Used for post-game analysis and AI training
 * 
 * @param state - Terminal game state
 * @param playerId - Player to analyze
 * @returns Number of missed winning opportunities
 */
export function getMissedWinOpportunities(state: GameState, playerId: string): number {
    if (!state.gameOver || state.winner !== null) {
        return 0; // Not applicable if game was won
    }

    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return 0;

    const player = state.players[playerIndex];
    const opponent = state.players[playerIndex === 0 ? 1 : 0];

    let missed = 0;

    // Check each lane for missed opportunities
    for (let i = 0; i < player.lanes.length; i++) {
        const pLane = player.lanes[i];
        const oLane = opponent.lanes[i];

        // Missed opportunity: lane at 17-20 not locked while opponent locked lower
        if (!pLane.locked && pLane.total >= 17 && pLane.total <= 20) {
            if (oLane.locked && oLane.total < pLane.total) {
                missed++;
            }
        }

        // Missed opportunity: lane at 19-20 not locked at all
        if (!pLane.locked && pLane.total >= 19 && pLane.total <= 20) {
            missed++;
        }
    }

    return Math.min(missed, 3); // Cap at 3 (one per lane)
}

/**
 * Check if draw was forced (no better alternative)
 * 
 * A draw is "forced" if player had no legal actions that could have won
 * Used to distinguish between strategic draws and unavoidable ones
 * 
 * @param state - Terminal game state (draw)
 * @param playerId - Player to analyze
 * @returns true if draw was unavoidable
 */
export function wasForcedDraw(state: GameState, playerId: string): boolean {
    if (!state.gameOver || state.winner !== null) {
        return false;
    }

    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return true;

    const player = state.players[playerIndex];

    // If all lanes locked, draw was forced
    if (player.lanes.every(l => l.locked)) {
        return true;
    }

    // If no energy and no unlocked lanes with potential
    const hasEnergy = player.energy > 0;
    const hasViableLanes = player.lanes.some(l => !l.locked && l.total < 21 && !l.busted);

    if (!hasEnergy && !hasViableLanes) {
        return true;
    }

    // Check deck/queue state
    if (state.deck.length === 0 && state.queue.length === 0) {
        return true;
    }

    return false;
}
