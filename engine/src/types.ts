/**
 * MirrorMatch: Strategic 21 - Type Definitions
 * Type-only interfaces for deterministic game state and replay support
 */

// ============================================================================
// Card Types
// ============================================================================

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
  readonly id: string; // Unique, stable identifier (e.g., "hearts-A-0", "spades-10-1")
  readonly suit: '♠' | '♥' | '♦' | '♣' | 'none'; // Unicode suits for clarity, 'none' for special cards
  readonly rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'ASH';
}

// ============================================================================
// Lane State
// ============================================================================

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
  readonly cards: ReadonlyArray<Card>; // Immutable snapshot of cards in this lane
  readonly total: number; // Cached sum of card values (Aces optimally counted as 1 or 11)
  readonly locked: boolean; // true if lane hit 21, busted, or was Stood
  readonly busted: boolean; // true if total > 21
  readonly shackled: boolean; // true if lane lost Dark Auction (v2.5)
  readonly hasBeenShackled: boolean; // true if lane has EVER been shackled (prevents re-shackling)
}

// ============================================================================
// Player State
// ============================================================================

/**
 * Represents the complete state of a single player
 * 
 * ENERGY: Stored explicitly here, never derived or inferred.
 * Energy bugs are game-breaking, so it lives only on PlayerState.
 */
export interface PlayerState {
  readonly id: string; // Unique player identifier
  readonly energy: number; // Energy available for Burn actions (starts at 3, never derived)
  readonly overheat: number; // Turns remaining until Burn is legal again (v2.5)
  readonly lanes: ReadonlyArray<LaneState>; // Array of lanes (default 3 for standard mode)
}

// ============================================================================
// Game State
// ============================================================================

/**
 * Represents the complete state of the game at any point in time
 * 
 * IMMUTABILITY: All arrays are ReadonlyArray - never mutate in place, always replace.
 * TURN TRACKING: turnNumber provides replay indexing and debugging support.
 * QUEUE: Immutable snapshot - essential for replay determinism.
 */
export interface GameState {
  readonly deck: ReadonlyArray<Card>; // Remaining cards in deck (immutable snapshot)
  readonly queue: ReadonlyArray<Card>; // Visible card queue (immutable, up to 3 cards)
  readonly players: ReadonlyArray<PlayerState>; // Array of players (default 2 for standard mode)
  readonly turnNumber: number; // Current turn counter (starts at 1, critical for replays)
  readonly gameOver: boolean; // true when game has ended
  readonly winner: string | null; // Player ID of winner, or null if draw/ongoing
}

export * from './actions';
