/**
 * Seque - Game State Management
 * Pure functions for creating and managing game state
 *
 * CRITICAL: LaneState.total is a CACHED value derived from LaneState.cards.
 * Always use helper functions (e.g., addCardToLane) to update both simultaneously.
 * Never manually mutate cards[] without recalculating total using calculateLaneTotal().
 */
// ============================================================================
// Deterministic RNG (Mulberry32)
// ============================================================================
/**
 * Simple, fast, deterministic pseudo-random number generator
 * Returns a function that produces numbers in [0, 1)
 */
function createSeededRandom(seed) {
    let state = seed;
    return () => {
        state = (state + 0x6D2B79F5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// ============================================================================
// Card Value Calculation
// ============================================================================
/**
 * Gets the base value of a card (without Ace optimization)
 */
export function getCardBaseValue(card) {
    if (card.rank === 'ASH') {
        return 1; // Ash cards are always worth 1
    }
    if (card.rank === 'A') {
        return 11; // Aces start at 11, will be adjusted down if needed
    }
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
        return 10;
    }
    return parseInt(card.rank, 10);
}
/**
 * Calculates the optimal total for a lane, treating Aces as 1 or 11
 * This is the source of truth for lane totals
 */
export function calculateLaneTotal(cards) {
    let total = 0;
    let aceCount = 0;
    // First pass: sum all cards, counting Aces as 11
    for (const card of cards) {
        total += getCardBaseValue(card);
        if (card.rank === 'A') {
            aceCount++;
        }
    }
    // Second pass: convert Aces from 11 to 1 (subtract 10) until under 22
    while (total > 21 && aceCount > 0) {
        total -= 10;
        aceCount--;
    }
    return total;
}
// ============================================================================
// Deck Creation
// ============================================================================
/**
 * Creates a standard 52-card deck in deterministic order
 * Each card has a unique, stable ID for replay determinism
 */
function createStandardDeck() {
    const suits = [
        { symbol: '♠', name: 'spades' },
        { symbol: '♥', name: 'hearts' },
        { symbol: '♦', name: 'diamonds' },
        { symbol: '♣', name: 'clubs' },
    ];
    const ranks = [
        '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
    ];
    const deck = [];
    let cardIndex = 0;
    for (const suit of suits) {
        for (const rank of ranks) {
            // Create unique, stable ID: "spades-A-0", "hearts-10-13", etc.
            const id = `${suit.name}-${rank}-${cardIndex}`;
            deck.push({
                id,
                suit: suit.symbol,
                rank
            });
            cardIndex++;
        }
    }
    return deck;
}
/**
 * Shuffles a deck using Fisher-Yates algorithm with seeded RNG
 */
function shuffleDeck(deck, seed) {
    const shuffled = [...deck];
    const random = createSeededRandom(seed);
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
// ============================================================================
// Initial State Creation
// ============================================================================
/**
 * Creates an empty lane state
 */
function createEmptyLane() {
    return {
        cards: [],
        total: 0,
        locked: false,
        busted: false,
        shackled: false,
        hasBeenShackled: false,
    };
}
/**
 * Creates initial player state
 *
 * DAY 19: Energy reduced from 3 → 2 to break perfect_symmetry draws
 * Forces earlier irreversible commitment via energy scarcity
 */
function createInitialPlayer(id) {
    return {
        id,
        energy: 2, // Starting energy for Burn actions (reduced from 3 for balance)
        overheat: 0,
        lanes: [createEmptyLane(), createEmptyLane(), createEmptyLane()],
    };
}
/**
 * Creates the initial game state with a seeded, shuffled deck
 *
 * @param seed - Seed value for deterministic deck shuffling
 * @returns Complete initial game state ready to play
 */
export function createInitialGameState(seed) {
    // Create and shuffle deck deterministically
    const standardDeck = createStandardDeck();
    const shuffledDeck = shuffleDeck(standardDeck, seed);
    // Take first 3 cards for the queue
    const queue = shuffledDeck.slice(0, 3);
    const remainingDeck = shuffledDeck.slice(3);
    // Create initial player states
    const player1 = createInitialPlayer('player1');
    const player2 = createInitialPlayer('player2');
    return {
        deck: remainingDeck,
        queue,
        players: [player1, player2],
        turnNumber: 1,
        gameOver: false,
        winner: null,
    };
}
