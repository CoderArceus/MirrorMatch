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

export type DrawReason =
    | 'perfect_symmetry'      // Identical lane results
    | 'energy_exhaustion'     // No legal actions remain
    | 'mutual_perfection'     // Both hit 21 in equal lanes
    | 'stall_lock'           // All lanes locked with equal score
    | 'equal_lanes'          // Each won 1 lane
    | 'tiebreaker_equal'     // Tiebreaker values equal
    | 'deck_exhausted';      // Deck ran out

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
