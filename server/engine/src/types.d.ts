/**
 * Seque - Type Definitions
 * Type-only interfaces for deterministic game state and replay support
 */
/**
 * Represents a playing card with unique identity
 *
 * CRITICAL: Cards are identified by ID, not by value/rank/suit.
 * Two 10♠ cards are different cards with different IDs.
 * This ensures:
 * - Deterministic replays
 * - Debuggability (which exact card was played)
 * - Future analytics and expansions
 */
export interface Card {
    readonly id: string;
    readonly suit: '♠' | '♥' | '♦' | '♣' | 'none';
    readonly rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'ASH';
}
/**
 * Represents the state of a single lane for a player
 *
 * EXPLICIT STATE: All lane conditions are explicit, never implicit.
 * - cards: immutable snapshot of cards played to this lane
 * - total: cached/derived value (source of truth is cards array via calculateLaneTotal)
 * - locked: true if lane hit 21, busted, or was Stood (prevents further actions)
 * - busted: true if total > 21 (lane loses automatically)
 *
 * This avoids ambiguity like "why did this lane lock?" or special-case bugs.
 */
export interface LaneState {
    readonly cards: ReadonlyArray<Card>;
    readonly total: number;
    readonly locked: boolean;
    readonly busted: boolean;
    readonly shackled: boolean;
    readonly hasBeenShackled: boolean;
}
/**
 * Represents the complete state of a single player
 *
 * ENERGY: Stored explicitly here, never derived or inferred.
 * Energy bugs are game-breaking, so it lives only on PlayerState.
 */
export interface PlayerState {
    readonly id: string;
    readonly energy: number;
    readonly overheat: number;
    readonly lanes: ReadonlyArray<LaneState>;
}
/**
 * Represents the complete state of the game at any point in time
 *
 * IMMUTABILITY: All arrays are ReadonlyArray - never mutate in place, always replace.
 * TURN TRACKING: turnNumber provides replay indexing and debugging support.
 * QUEUE: Immutable snapshot - essential for replay determinism.
 */
export interface GameState {
    readonly deck: ReadonlyArray<Card>;
    readonly queue: ReadonlyArray<Card>;
    readonly players: ReadonlyArray<PlayerState>;
    readonly turnNumber: number;
    readonly gameOver: boolean;
    readonly winner: string | null;
}
export * from './actions';
