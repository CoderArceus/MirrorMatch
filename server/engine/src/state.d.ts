/**
 * Seque - Game State Management
 * Pure functions for creating and managing game state
 *
 * CRITICAL: LaneState.total is a CACHED value derived from LaneState.cards.
 * Always use helper functions (e.g., addCardToLane) to update both simultaneously.
 * Never manually mutate cards[] without recalculating total using calculateLaneTotal().
 */
import type { Card, GameState } from './types';
/**
 * Gets the base value of a card (without Ace optimization)
 */
export declare function getCardBaseValue(card: Card): number;
/**
 * Calculates the optimal total for a lane, treating Aces as 1 or 11
 * This is the source of truth for lane totals
 */
export declare function calculateLaneTotal(cards: ReadonlyArray<Card>): number;
/**
 * Creates the initial game state with a seeded, shuffled deck
 *
 * @param seed - Seed value for deterministic deck shuffling
 * @returns Complete initial game state ready to play
 */
export declare function createInitialGameState(seed: number): GameState;
