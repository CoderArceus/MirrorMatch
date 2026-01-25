/**
 * Seque - Analytics Module
 * Pure functions for analyzing game outcomes, explaining results, and detecting achievements.
 */
import type { GameState, LaneState } from './types';
/**
 * Draw reasons - categorizes why a game ended in a draw
 *
 * DAY 16 ADDITIONS:
 * New primary categories for better analytics and AI tuning
 */
export type DrawReason = 'mutual_pass' | 'lane_split' | 'deck_exhausted' | 'stall_equilibrium' | 'perfect_symmetry' | 'energy_exhaustion' | 'mutual_perfection' | 'stall_lock' | 'equal_lanes' | 'tiebreaker_equal';
export type SkillBadge = '🎯 Precision' | '🔥 Denial' | '🧠 Efficiency' | '🧊 Stability' | '⚖️ Mirror';
export type LaneOutcome = {
    winner: 'player1' | 'player2' | 'tie';
    reason: string;
    p1Total: number;
    p2Total: number;
};
/**
 * DAY 18 TASK 2: Decisiveness metrics for balance tuning
 *
 * Quantifies game pressure and decisiveness at game end.
 * All metrics are deterministic and derived from engine state.
 */
export interface DecisivenessMetrics {
    /**
     * Number of lanes that are still contestable (not locked by both players)
     * Range: 0-3
     * Lower = more decisive
     */
    contestableLanes: number;
    /**
     * Player's remaining energy at game end
     * Range: 0-3
     * Lower = more decisive (forced commitment)
     */
    energyRemaining: number;
    /**
     * Number of PassActions taken by this player
     * Counted from action history (not inferred)
     * Higher = less pressure/fewer options
     */
    forcedPasses: number;
    /**
     * Number of lanes where player was within ≤3 points of 21
     * without being busted, before game end
     * Range: 0-3
     * Higher = more pressure/closer to winning
     */
    winThreats: number;
}
/**
 * DAY 18 TASK 2.2: Complete draw diagnostics for balance tuning
 *
 * Aggregates draw reason + decisiveness metrics for both players.
 * Single object that fully explains why a draw occurred.
 */
export interface DrawDiagnostics {
    /**
     * Primary reason why the draw occurred
     * From analyzeDrawReason()
     */
    reason: DrawReason;
    /**
     * Player 1's decisiveness metrics at game end
     */
    p1: DecisivenessMetrics;
    /**
     * Player 2's decisiveness metrics at game end
     */
    p2: DecisivenessMetrics;
}
/**
 * DAY 18 TASK 2.3: Draw statistics aggregation for balance analysis
 *
 * Summarizes draw behavior across many completed games.
 * Enables questions like:
 * - Which draw reasons are most common?
 * - Are draws high-pressure or low-pressure?
 * - Do draws happen with energy remaining?
 */
export interface DrawStatistics {
    /**
     * Total number of draws analyzed
     */
    totalDraws: number;
    /**
     * Count of draws by reason type
     * All DrawReason enum values present (default 0)
     */
    byReason: Record<DrawReason, number>;
    /**
     * Average contestable lanes across all draws (both players)
     * Range: 0-3
     */
    avgContestableLanes: number;
    /**
     * Average energy remaining across all draws (both players)
     * Range: 0-3
     */
    avgEnergyRemaining: number;
    /**
     * Average forced passes across all draws (both players)
     */
    avgForcedPasses: number;
    /**
     * Average win threats across all draws (both players)
     * Range: 0-3
     */
    avgWinThreats: number;
}
export declare function analyzeLane(p1Lane: LaneState, p2Lane: LaneState): LaneOutcome;
/**
 * Primary function to determine why a draw occurred.
 * Covers both AI analytics needs and UI explanation needs.
 *
 * DAY 18: Primary draw analysis function for balance tuning
 */
export declare function analyzeDraw(state: GameState): DrawReason;
/**
 * DAY 18: Alias for analyzeDraw - preferred name for balance tuning context
 *
 * Determines the primary reason why a game ended in a draw.
 * Used for metrics tracking and balance analysis.
 *
 * @param state - Terminal game state (must be a draw)
 * @returns DrawReason categorizing why the draw occurred
 */
export declare function analyzeDrawReason(state: GameState): DrawReason;
/**
 * Legacy wrapper for UI explanations.
 * Now acts as a formatter for analyzeDraw.
 */
export declare function classifyDraw(state: GameState): {
    type: DrawReason;
    explanation: string;
};
export declare function getEndReason(state: GameState): string;
export declare function getWinnerExplanation(state: GameState): string;
export declare function explainGameEnd(state: GameState): string[];
export declare function detectSkillBadge(state: GameState, playerId: string): SkillBadge | null;
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
export declare function getDecisivenessScore(state: GameState, playerId: string): number;
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
export declare function getMissedWinOpportunities(state: GameState, playerId: string): number;
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
export declare function wasForcedDraw(state: GameState, playerId: string): boolean;
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
export declare function getDecisivenessMetrics(state: GameState, playerId: string, actionLog?: ReadonlyArray<{
    playerId: string;
    action: {
        type: string;
    };
}>): DecisivenessMetrics;
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
export declare function analyzeDrawDiagnostics(state: GameState, player1Id: string, player2Id: string, actionLog?: ReadonlyArray<{
    playerId: string;
    action: {
        type: string;
    };
}>): DrawDiagnostics;
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
export declare function aggregateDrawStatistics(diagnostics: ReadonlyArray<DrawDiagnostics>): DrawStatistics;
