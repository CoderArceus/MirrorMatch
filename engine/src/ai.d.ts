/**
 * Seque AI - Engine-Driven Action Selection
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
import type { GameState, PlayerAction } from './types';
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
export declare function chooseAction(state: GameState, playerId: string, difficulty: AIDifficulty): PlayerAction;
