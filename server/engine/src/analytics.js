/**
 * Seque - Analytics Module
 * Pure functions for analyzing game outcomes, explaining results, and detecting achievements.
 */
// ============================================================================
// Lane Analysis
// ============================================================================
export function analyzeLane(p1Lane, p2Lane) {
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
// ============================================================================
// Draw Analysis (Unified)
// ============================================================================
/**
 * Primary function to determine why a draw occurred.
 * Covers both AI analytics needs and UI explanation needs.
 *
 * DAY 18: Primary draw analysis function for balance tuning
 */
export function analyzeDraw(state) {
    if (!state.gameOver || state.winner !== null) {
        throw new Error('analyzeDraw called on non-draw game state');
    }
    const p1 = state.players[0];
    const p2 = state.players[1];
    const outcomes = [
        analyzeLane(p1.lanes[0], p2.lanes[0]),
        analyzeLane(p1.lanes[1], p2.lanes[1]),
        analyzeLane(p1.lanes[2], p2.lanes[2]),
    ];
    const p1Wins = outcomes.filter(o => o.winner === 'player1').length;
    const p2Wins = outcomes.filter(o => o.winner === 'player2').length;
    const ties = outcomes.filter(o => o.winner === 'tie').length;
    // Check for 21s (Perfection)
    const p1Has21 = outcomes.filter(o => o.winner === 'player1' && o.p1Total === 21).length;
    const p2Has21 = outcomes.filter(o => o.winner === 'player2' && o.p2Total === 21).length;
    // 1. Rare/Cool Outcomes (Priority for UI)
    // Mutual Perfection: Both hit 21 in winning lanes
    if (p1Has21 > 0 && p2Has21 > 0 && p1Wins === p2Wins) {
        return 'mutual_perfection';
    }
    // Perfect Symmetry: All lanes tied
    if (ties === 3) {
        return 'perfect_symmetry';
    }
    // 2. Structural Draw Types
    // Lane Split (1-1-1): Most common "fought" draw
    // Also covers "1 win, 2 ties" (Partial Win Draw) logic added previously
    if ((p1Wins === 1 && p2Wins === 1) || (p1Wins === 1 && ties === 2) || (p2Wins === 1 && ties === 2)) {
        if (p1Wins === 1 && p2Wins === 1 && ties === 0) {
            // Tiebreaker equal case
            return 'tiebreaker_equal';
        }
        return 'lane_split';
    }
    // 3. Stalling / Exhaustion Types
    const allLanesLocked = p1.lanes.every(l => l.locked) && p2.lanes.every(l => l.locked);
    const deckAndQueueEmpty = state.deck.length === 0 && state.queue.length === 0;
    // Mutual Pass: Locked but cards remained (Choice to stop)
    if (allLanesLocked && !deckAndQueueEmpty) {
        return 'mutual_pass';
    }
    // Stall Equilibrium: Locked early with equal scores
    if (allLanesLocked) {
        return 'stall_equilibrium';
    }
    // Deck Exhausted
    if (deckAndQueueEmpty) {
        return 'deck_exhausted';
    }
    // Energy Exhaustion (No moves left)
    const p1HasEnergy = p1.energy > 0;
    const p2HasEnergy = p2.energy > 0;
    const p1Unlocked = p1.lanes.some(l => !l.locked);
    const p2Unlocked = p2.lanes.some(l => !l.locked);
    if (!p1HasEnergy && !p2HasEnergy && (!p1Unlocked || !p2Unlocked)) {
        return 'energy_exhaustion';
    }
    return 'equal_lanes';
}
/**
 * DAY 18: Alias for analyzeDraw - preferred name for balance tuning context
 *
 * Determines the primary reason why a game ended in a draw.
 * Used for metrics tracking and balance analysis.
 *
 * @param state - Terminal game state (must be a draw)
 * @returns DrawReason categorizing why the draw occurred
 */
export function analyzeDrawReason(state) {
    return analyzeDraw(state);
}
/**
 * Legacy wrapper for UI explanations.
 * Now acts as a formatter for analyzeDraw.
 */
export function classifyDraw(state) {
    const reason = analyzeDraw(state);
    let explanation = 'Game ended in a draw.';
    switch (reason) {
        case 'mutual_perfection':
            explanation = 'Both players hit 21 in winning lanes. Neither gained an advantage.';
            break;
        case 'perfect_symmetry':
            explanation = 'All three lanes ended in ties. Perfect symmetry.';
            break;
        case 'lane_split':
            // Logic to verify if it was 1-1-1 or 1-0-2
            const p1 = state.players[0];
            const p2 = state.players[1];
            const outcomes = [
                analyzeLane(p1.lanes[0], p2.lanes[0]),
                analyzeLane(p1.lanes[1], p2.lanes[1]),
                analyzeLane(p1.lanes[2], p2.lanes[2]),
            ];
            const p1Wins = outcomes.filter(o => o.winner === 'player1').length;
            const p2Wins = outcomes.filter(o => o.winner === 'player2').length;
            if (p1Wins === 0 || p2Wins === 0) {
                const winner = p1Wins > 0 ? 'Player 1' : 'Player 2';
                explanation = `${winner} won 1 lane, but the other 2 lanes were tied. A match win requires 2 lane victories.`;
            }
            else {
                explanation = 'Both players won 1 lane and tied 1 lane.';
            }
            break;
        case 'tiebreaker_equal':
            explanation = 'Both players won 1 lane each. Tiebreaker compared winning values, which were equal.';
            break;
        case 'mutual_pass':
            explanation = 'Both players passed with cards remaining.';
            break;
        case 'stall_equilibrium':
            explanation = 'All lanes locked with equal overall score.';
            break;
        case 'deck_exhausted':
            explanation = 'Deck exhausted with lanes in tied state.';
            break;
        case 'energy_exhaustion':
            explanation = 'Both players ran out of energy with all lanes locked.';
            break;
        case 'equal_lanes':
            explanation = 'Game reached a solved terminal state with equal scores.';
            break;
    }
    return { type: reason, explanation };
}
// ============================================================================
// Game End Explanation
// ============================================================================
export function getEndReason(state) {
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
export function getWinnerExplanation(state) {
    if (!state.winner) {
        return 'Both players achieved equal scores across all lanes.';
    }
    const winnerName = state.winner === 'player1' ? 'Player 1' : 'Player 2';
    return `${winnerName} won 2 out of 3 lanes.`;
}
export function explainGameEnd(state) {
    const explanations = [];
    if (!state.gameOver)
        return explanations;
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
        const perfectLanes = outcomes.filter(o => (o.winner === state.winner && (o.p1Total === 21 || o.p2Total === 21))).length;
        if (perfectLanes > 0) {
            explanations.push(`${perfectLanes} winning lane(s) hit exactly 21.`);
        }
        const bustLanes = outcomes.filter(o => (o.winner !== state.winner && o.reason.includes('busted'))).length;
        if (bustLanes > 0) {
            explanations.push(`Opponent busted in ${bustLanes} lane(s).`);
        }
    }
    else {
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
export function detectSkillBadge(state, playerId) {
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1)
        return null;
    const player = state.players[playerIndex];
    const opponent = state.players[playerIndex === 0 ? 1 : 0];
    // 🎯 Precision - Hit 21 exactly
    const has21 = player.lanes.some(l => l.total === 21 && !l.busted);
    if (has21)
        return '🎯 Precision';
    // 🧊 Stability - No busted lanes (and won)
    const noBusts = !player.lanes.some(l => l.busted);
    if (noBusts && state.winner === playerId)
        return '🧊 Stability';
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
export function getDecisivenessScore(state, playerId) {
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1)
        return 0;
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
    }
    else if (bestLane >= 17) {
        score += 20; // Close
    }
    else if (bestLane >= 15) {
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
export function getMissedWinOpportunities(state, playerId) {
    if (!state.gameOver || state.winner !== null) {
        return 0; // Not applicable if game was won
    }
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1)
        return 0;
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
export function wasForcedDraw(state, playerId) {
    if (!state.gameOver || state.winner !== null) {
        return false;
    }
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1)
        return true;
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
// ============================================================================
// DAY 18 TASK 2: Decisiveness Metrics
// ============================================================================
/**
 * Get decisiveness metrics for a player at game end
 *
 * DAY 18: Quantifies game pressure and decisiveness for balance tuning.
 * All metrics are deterministic and objective.
 *
 * NOTE: forcedPasses requires actionLog which is not part of GameState.
 * For full metrics with pass counting, use async match or replay system.
 * This function provides state-based metrics only.
 *
 * @param state - Terminal game state
 * @param playerId - Player to analyze
 * @param actionLog - Optional action log for counting passes (from AsyncMatch or Replay)
 * @returns Decisiveness metrics
 */
export function getDecisivenessMetrics(state, playerId, actionLog) {
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
        return {
            contestableLanes: 0,
            energyRemaining: 0,
            forcedPasses: 0,
            winThreats: 0
        };
    }
    const player = state.players[playerIndex];
    const opponent = state.players[playerIndex === 0 ? 1 : 0];
    // ========================================================================
    // Metric 1: Contestable Lanes
    // ========================================================================
    // Count lanes where at least one player hasn't locked
    const contestableLanes = player.lanes.filter((lane, i) => {
        const oppLane = opponent.lanes[i];
        return !lane.locked || !oppLane.locked;
    }).length;
    // ========================================================================
    // Metric 2: Energy Remaining
    // ========================================================================
    const energyRemaining = player.energy;
    // ========================================================================
    // Metric 3: Forced Passes
    // ========================================================================
    // Count pass actions from action log if provided
    let forcedPasses = 0;
    if (actionLog) {
        forcedPasses = actionLog.filter(entry => entry.playerId === playerId && entry.action.type === 'pass').length;
    }
    // If no action log provided, we cannot count passes (set to 0)
    // Caller should provide actionLog for accurate counting
    // ========================================================================
    // Metric 4: Win Threats
    // ========================================================================
    // Count lanes within ≤3 points of 21, not busted
    const winThreats = player.lanes.filter(lane => {
        if (lane.busted)
            return false;
        const distance = 21 - lane.total;
        return distance >= 0 && distance <= 3;
    }).length;
    return {
        contestableLanes,
        energyRemaining,
        forcedPasses,
        winThreats
    };
}
// ============================================================================
// DAY 18 TASK 2.2: Draw Diagnostics Aggregation
// ============================================================================
/**
 * Analyze complete draw diagnostics for a game
 *
 * DAY 18 TASK 2.2: Aggregates draw reason + decisiveness metrics for both players.
 * Single diagnostic object that fully explains why a draw occurred.
 *
 * INTEGRATION:
 * - Uses analyzeDrawReason() for draw classification
 * - Uses getDecisivenessMetrics() for both players
 * - Passes actionLog through for forcedPasses counting
 *
 * @param state - Terminal game state (must be a draw)
 * @param player1Id - ID of player 1
 * @param player2Id - ID of player 2
 * @param actionLog - Optional action log for counting passes
 * @returns Complete draw diagnostics
 */
export function analyzeDrawDiagnostics(state, player1Id, player2Id, actionLog) {
    // Get draw reason using existing function
    const reason = analyzeDrawReason(state);
    // Get decisiveness metrics for both players
    const p1 = getDecisivenessMetrics(state, player1Id, actionLog);
    const p2 = getDecisivenessMetrics(state, player2Id, actionLog);
    return {
        reason,
        p1,
        p2
    };
}
// ============================================================================
// DAY 18 TASK 2.3: Draw Statistics Aggregation
// ============================================================================
/**
 * Aggregate draw statistics across multiple games
 *
 * DAY 18 TASK 2.3: Summarizes draw behavior for balance analysis.
 * Answers questions like:
 * - Which draw reasons are most common?
 * - Are draws high-pressure or low-pressure?
 * - Do draws happen with energy remaining?
 *
 * DESIGN:
 * - Pure function (no side effects)
 * - Deterministic (same input → same output)
 * - Order-independent (array order doesn't matter)
 * - Simple arithmetic means for all averages
 * - Averages combine both players per draw, then average globally
 *
 * @param diagnostics - Array of draw diagnostics from completed games
 * @returns Aggregated statistics
 */
export function aggregateDrawStatistics(diagnostics) {
    // ========================================================================
    // Handle empty input
    // ========================================================================
    if (diagnostics.length === 0) {
        return {
            totalDraws: 0,
            byReason: {
                mutual_pass: 0,
                lane_split: 0,
                deck_exhausted: 0,
                stall_equilibrium: 0,
                perfect_symmetry: 0,
                energy_exhaustion: 0,
                mutual_perfection: 0,
                stall_lock: 0,
                equal_lanes: 0,
                tiebreaker_equal: 0
            },
            avgContestableLanes: 0,
            avgEnergyRemaining: 0,
            avgForcedPasses: 0,
            avgWinThreats: 0
        };
    }
    // ========================================================================
    // Count draws by reason
    // ========================================================================
    const byReason = {
        mutual_pass: 0,
        lane_split: 0,
        deck_exhausted: 0,
        stall_equilibrium: 0,
        perfect_symmetry: 0,
        energy_exhaustion: 0,
        mutual_perfection: 0,
        stall_lock: 0,
        equal_lanes: 0,
        tiebreaker_equal: 0
    };
    for (const diag of diagnostics) {
        byReason[diag.reason] = (byReason[diag.reason] || 0) + 1;
    }
    // ========================================================================
    // Calculate averages
    // ========================================================================
    // For each draw: average p1 and p2, then average across all draws
    let totalContestableLanes = 0;
    let totalEnergyRemaining = 0;
    let totalForcedPasses = 0;
    let totalWinThreats = 0;
    for (const diag of diagnostics) {
        // Average p1 and p2 for this draw
        totalContestableLanes += (diag.p1.contestableLanes + diag.p2.contestableLanes) / 2;
        totalEnergyRemaining += (diag.p1.energyRemaining + diag.p2.energyRemaining) / 2;
        totalForcedPasses += (diag.p1.forcedPasses + diag.p2.forcedPasses) / 2;
        totalWinThreats += (diag.p1.winThreats + diag.p2.winThreats) / 2;
    }
    const totalDraws = diagnostics.length;
    return {
        totalDraws,
        byReason,
        avgContestableLanes: totalContestableLanes / totalDraws,
        avgEnergyRemaining: totalEnergyRemaining / totalDraws,
        avgForcedPasses: totalForcedPasses / totalDraws,
        avgWinThreats: totalWinThreats / totalDraws
    };
}
