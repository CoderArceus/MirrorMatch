/**
 * Tests for turn resolution
 * Comprehensive coverage of all interaction cases
 */

import { describe, it, expect } from 'vitest';
import { resolveTurn } from '../src/resolveTurn';
import { GameState, PlayerState, LaneState, Card } from '../src/types';
import { TurnActions } from '../src/actions';

// ============================================================================
// Test Helpers - Explicit State Construction
// ============================================================================

function createTestCard(id: string, rank: Card['rank'], suit: Card['suit']): Card {
  return { id, rank, suit };
}

function createTestLane(
  cards: Card[] = [],
  total: number = 0,
  locked: boolean = false,
  busted: boolean = false
): LaneState {
  return { cards, total, locked, busted };
}

function createTestPlayer(
  id: string,
  energy: number,
  lanes: LaneState[]
): PlayerState {
  return { id, energy, lanes };
}

function createTestGameState(
  players: PlayerState[],
  queue: Card[],
  deck: Card[] = [],
  turnNumber: number = 1,
  gameOver: boolean = false,
  winner: string | null = null
): GameState {
  return {
    deck,
    queue,
    players,
    turnNumber,
    gameOver,
    winner,
  };
}

function createTurnActions(
  player1Id: string,
  player1Action: TurnActions['playerActions'][0]['action'],
  player2Id: string,
  player2Action: TurnActions['playerActions'][0]['action']
): TurnActions {
  return {
    playerActions: [
      { playerId: player1Id, action: player1Action },
      { playerId: player2Id, action: player2Action },
    ],
  };
}

// ============================================================================
// Tests: Core Interaction Matrix
// ============================================================================

describe('Core interaction matrix', () => {
  describe('Take vs Take', () => {
    it('should give both players the same card', () => {
      const card = createTestCard('test-5', '5', '♠');
      const player1 = createTestPlayer('player1', 3, [
        createTestLane(),
        createTestLane(),
        createTestLane(),
      ]);
      const player2 = createTestPlayer('player2', 3, [
        createTestLane(),
        createTestLane(),
        createTestLane(),
      ]);
      const state = createTestGameState([player1, player2], [card]);

      const actions = createTurnActions(
        'player1',
        { type: 'take', targetLane: 0 },
        'player2',
        { type: 'take', targetLane: 1 }
      );

      const newState = resolveTurn(state, actions);

      // Both players should receive the card
      expect(newState.players[0].lanes[0].cards).toHaveLength(1);
      expect(newState.players[0].lanes[0].cards[0].id).toBe('test-5');
      expect(newState.players[1].lanes[1].cards).toHaveLength(1);
      expect(newState.players[1].lanes[1].cards[0].id).toBe('test-5');

      // Card should be consumed from queue
      expect(newState.queue).toHaveLength(0);

      // Turn number should increment
      expect(newState.turnNumber).toBe(2);

      // Energy should not change
      expect(newState.players[0].energy).toBe(3);
      expect(newState.players[1].energy).toBe(3);
    });

    it('should place cards in different lanes correctly', () => {
      const card = createTestCard('test-10', '10', '♥');
      const player1 = createTestPlayer('player1', 3, [
        createTestLane(),
        createTestLane(),
        createTestLane(),
      ]);
      const player2 = createTestPlayer('player2', 3, [
        createTestLane(),
        createTestLane(),
        createTestLane(),
      ]);
      const state = createTestGameState([player1, player2], [card]);

      const actions = createTurnActions(
        'player1',
        { type: 'take', targetLane: 2 },
        'player2',
        { type: 'take', targetLane: 0 }
      );

      const newState = resolveTurn(state, actions);

      // P1 lane 2 should have card
      expect(newState.players[0].lanes[2].cards).toHaveLength(1);
      expect(newState.players[0].lanes[2].total).toBe(10);

      // P2 lane 0 should have card
      expect(newState.players[1].lanes[0].cards).toHaveLength(1);
      expect(newState.players[1].lanes[0].total).toBe(10);

      // Other lanes should be empty
      expect(newState.players[0].lanes[0].cards).toHaveLength(0);
      expect(newState.players[0].lanes[1].cards).toHaveLength(0);
      expect(newState.players[1].lanes[1].cards).toHaveLength(0);
      expect(newState.players[1].lanes[2].cards).toHaveLength(0);
    });
  });

  describe('Burn vs Burn', () => {
    it('should destroy card and cost both players energy', () => {
      const card = createTestCard('test-k', 'K', '♦');
      const player1 = createTestPlayer('player1', 3, [
        createTestLane(),
        createTestLane(),
        createTestLane(),
      ]);
      const player2 = createTestPlayer('player2', 3, [
        createTestLane(),
        createTestLane(),
        createTestLane(),
      ]);
      const state = createTestGameState([player1, player2], [card]);

      const actions = createTurnActions(
        'player1',
        { type: 'burn' },
        'player2',
        { type: 'burn' }
      );

      const newState = resolveTurn(state, actions);

      // Card should be consumed
      expect(newState.queue).toHaveLength(0);

      // Both players lose 1 energy
      expect(newState.players[0].energy).toBe(2);
      expect(newState.players[1].energy).toBe(2);

      // No cards added to lanes
      expect(newState.players[0].lanes[0].cards).toHaveLength(0);
      expect(newState.players[0].lanes[1].cards).toHaveLength(0);
      expect(newState.players[0].lanes[2].cards).toHaveLength(0);
      expect(newState.players[1].lanes[0].cards).toHaveLength(0);
      expect(newState.players[1].lanes[1].cards).toHaveLength(0);
      expect(newState.players[1].lanes[2].cards).toHaveLength(0);

      // Turn increments
      expect(newState.turnNumber).toBe(2);
    });
  });

  describe('Take vs Burn (Ash card)', () => {
    it('should give Taker an Ash card when Burned', () => {
      const card = createTestCard('test-a', 'A', '♣');
      const player1 = createTestPlayer('player1', 3, [
        createTestLane(),
        createTestLane(),
        createTestLane(),
      ]);
      const player2 = createTestPlayer('player2', 3, [
        createTestLane(),
        createTestLane(),
        createTestLane(),
      ]);
      const state = createTestGameState([player1, player2], [card]);

      const actions = createTurnActions(
        'player1',
        { type: 'take', targetLane: 0 },
        'player2',
        { type: 'burn' }
      );

      const newState = resolveTurn(state, actions);

      // P1 should receive Ash card (value 1)
      expect(newState.players[0].lanes[0].cards).toHaveLength(1);
      expect(newState.players[0].lanes[0].cards[0].rank).toBe('ASH');
      expect(newState.players[0].lanes[0].cards[0].suit).toBe('none');
      expect(newState.players[0].lanes[0].total).toBe(1);

      // P2 should have no cards
      expect(newState.players[1].lanes[0].cards).toHaveLength(0);
      expect(newState.players[1].lanes[1].cards).toHaveLength(0);
      expect(newState.players[1].lanes[2].cards).toHaveLength(0);

      // P1 energy unchanged, P2 loses 1
      expect(newState.players[0].energy).toBe(3);
      expect(newState.players[1].energy).toBe(2);

      // Card consumed from queue
      expect(newState.queue).toHaveLength(0);
    });

    it('should give Taker an Ash card when order is reversed', () => {
      const card = createTestCard('test-7', '7', '♥');
      const player1 = createTestPlayer('player1', 3, [
        createTestLane(),
        createTestLane(),
        createTestLane(),
      ]);
      const player2 = createTestPlayer('player2', 3, [
        createTestLane(),
        createTestLane(),
        createTestLane(),
      ]);
      const state = createTestGameState([player1, player2], [card]);

      const actions = createTurnActions(
        'player1',
        { type: 'burn' },
        'player2',
        { type: 'take', targetLane: 2 }
      );

      const newState = resolveTurn(state, actions);

      // P2 should receive Ash card
      expect(newState.players[1].lanes[2].cards).toHaveLength(1);
      expect(newState.players[1].lanes[2].cards[0].rank).toBe('ASH');
      expect(newState.players[1].lanes[2].total).toBe(1);

      // P1 should have no cards
      expect(newState.players[0].lanes[0].cards).toHaveLength(0);
      expect(newState.players[0].lanes[1].cards).toHaveLength(0);
      expect(newState.players[0].lanes[2].cards).toHaveLength(0);

      // P1 loses energy, P2 unchanged
      expect(newState.players[0].energy).toBe(2);
      expect(newState.players[1].energy).toBe(3);
    });

    it('should create unique Ash card IDs for traceability', () => {
      const card = createTestCard('test-q', 'Q', '♠');
      const player1 = createTestPlayer('player1', 3, [
        createTestLane(),
        createTestLane(),
        createTestLane(),
      ]);
      const player2 = createTestPlayer('player2', 3, [
        createTestLane(),
        createTestLane(),
        createTestLane(),
      ]);
      const state = createTestGameState([player1, player2], [card], [], 5);

      const actions = createTurnActions(
        'player1',
        { type: 'take', targetLane: 1 },
        'player2',
        { type: 'burn' }
      );

      const newState = resolveTurn(state, actions);

      // Ash card should have unique ID with turn number
      const ashCard = newState.players[0].lanes[1].cards[0];
      expect(ashCard.id).toContain('ash-turn5');
      expect(ashCard.id).toContain('player1');
    });
  });
});

// ============================================================================
// Tests: Stand Action
// ============================================================================

describe('Stand action', () => {
  it('should lock the specified lane', () => {
    const card = createTestCard('test-9', '9', '♦');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState([player1, player2], [card]);

    const actions = createTurnActions(
      'player1',
      { type: 'stand', targetLane: 1 },
      'player2',
      { type: 'take', targetLane: 0 }
    );

    const newState = resolveTurn(state, actions);

    // P1 lane 1 should be locked
    expect(newState.players[0].lanes[1].locked).toBe(true);

    // Other P1 lanes should not be locked
    expect(newState.players[0].lanes[0].locked).toBe(false);
    expect(newState.players[0].lanes[2].locked).toBe(false);

    // P2 should have received card
    expect(newState.players[1].lanes[0].cards).toHaveLength(1);
    expect(newState.players[1].lanes[0].total).toBe(9);
  });

  it('should work when both players Stand', () => {
    const card = createTestCard('test-3', '3', '♠');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState([player1, player2], [card]);

    const actions = createTurnActions(
      'player1',
      { type: 'stand', targetLane: 0 },
      'player2',
      { type: 'stand', targetLane: 2 }
    );

    const newState = resolveTurn(state, actions);

    // Both specified lanes locked
    expect(newState.players[0].lanes[0].locked).toBe(true);
    expect(newState.players[1].lanes[2].locked).toBe(true);

    // Card not consumed (no one took it)
    expect(newState.queue).toHaveLength(1);
    expect(newState.queue[0].id).toBe('test-3');

    // No energy lost
    expect(newState.players[0].energy).toBe(3);
    expect(newState.players[1].energy).toBe(3);
  });

  it('should allow standing on empty lane', () => {
    const card = createTestCard('test-k', 'K', '♥');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane([], 0, false, false), // Empty lane
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState([player1, player2], [card]);

    const actions = createTurnActions(
      'player1',
      { type: 'stand', targetLane: 0 },
      'player2',
      { type: 'burn' }
    );

    const newState = resolveTurn(state, actions);

    // Empty lane should be locked
    expect(newState.players[0].lanes[0].locked).toBe(true);
    expect(newState.players[0].lanes[0].cards).toHaveLength(0);
    expect(newState.players[0].lanes[0].total).toBe(0);
  });
});

// ============================================================================
// Tests: Bust and Lock Behavior
// ============================================================================

describe('Bust and lock behavior', () => {
  it('should bust lane when total exceeds 21', () => {
    const card = createTestCard('test-k', 'K', '♠'); // Value 10
    const existingCard = createTestCard('existing-q', 'Q', '♥'); // Value 10
    const player1 = createTestPlayer('player1', 3, [
      createTestLane([existingCard, createTestCard('existing-5', '5', '♦')], 15), // 15 + 10 = 25 (bust)
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState([player1, player2], [card]);

    const actions = createTurnActions(
      'player1',
      { type: 'take', targetLane: 0 },
      'player2',
      { type: 'stand', targetLane: 0 }
    );

    const newState = resolveTurn(state, actions);

    // P1 lane 0 should be busted and locked
    expect(newState.players[0].lanes[0].busted).toBe(true);
    expect(newState.players[0].lanes[0].locked).toBe(true);
    expect(newState.players[0].lanes[0].total).toBe(25);
  });

  it('should lock lane when total equals exactly 21', () => {
    const card = createTestCard('test-a', 'A', '♣'); // Value 11
    const player1 = createTestPlayer('player1', 3, [
      createTestLane([createTestCard('existing-10', '10', '♠')], 10), // 10 + 11 = 21
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState([player1, player2], [card]);

    const actions = createTurnActions(
      'player1',
      { type: 'take', targetLane: 0 },
      'player2',
      { type: 'take', targetLane: 0 } // Both take so P1 gets the actual card
    );

    const newState = resolveTurn(state, actions);

    // P1 lane 0 should be locked but NOT busted (10 + 11 = 21)
    expect(newState.players[0].lanes[0].locked).toBe(true);
    expect(newState.players[0].lanes[0].busted).toBe(false);
    expect(newState.players[0].lanes[0].total).toBe(21);
  });

  it('should use Ace optimization to avoid bust', () => {
    const card = createTestCard('test-10', '10', '♦'); // Value 10
    const ace = createTestCard('existing-a', 'A', '♠'); // Ace
    const player1 = createTestPlayer('player1', 3, [
      createTestLane([ace, createTestCard('existing-9', '9', '♥')], 20), // A + 9 + 10 = 20 (Ace as 1)
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState([player1, player2], [card]);

    const actions = createTurnActions(
      'player1',
      { type: 'take', targetLane: 0 },
      'player2',
      { type: 'stand', targetLane: 1 }
    );

    const newState = resolveTurn(state, actions);

    // Should not bust (Ace counted as 1)
    expect(newState.players[0].lanes[0].busted).toBe(false);
    expect(newState.players[0].lanes[0].locked).toBe(false);
    expect(newState.players[0].lanes[0].total).toBe(20);
  });
});

// ============================================================================
// Tests: Queue Refill
// ============================================================================

describe('Queue refill', () => {
  it('should refill queue from deck after card consumed', () => {
    const queueCard = createTestCard('queue-5', '5', '♠');
    const deckCard1 = createTestCard('deck-7', '7', '♥');
    const deckCard2 = createTestCard('deck-9', '9', '♦');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState(
      [player1, player2],
      [queueCard],
      [deckCard1, deckCard2]
    );

    const actions = createTurnActions(
      'player1',
      { type: 'take', targetLane: 0 },
      'player2',
      { type: 'stand', targetLane: 0 }
    );

    const newState = resolveTurn(state, actions);

    // Queue should be refilled to 2 (1 card consumed, refilled with 2 from deck)
    expect(newState.queue).toHaveLength(2);
    expect(newState.queue[0].id).toBe('deck-7');
    expect(newState.queue[1].id).toBe('deck-9');

    // Deck should be empty
    expect(newState.deck).toHaveLength(0);
  });

  it('should maintain queue size of 3 when possible', () => {
    const card1 = createTestCard('q1', '5', '♠');
    const card2 = createTestCard('q2', '6', '♥');
    const card3 = createTestCard('q3', '7', '♦');
    const deckCards = [
      createTestCard('d1', '8', '♣'),
      createTestCard('d2', '9', '♠'),
    ];
    const player1 = createTestPlayer('player1', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState(
      [player1, player2],
      [card1, card2, card3],
      deckCards
    );

    const actions = createTurnActions(
      'player1',
      { type: 'burn' },
      'player2',
      { type: 'burn' }
    );

    const newState = resolveTurn(state, actions);

    // Queue should be refilled to 3
    expect(newState.queue).toHaveLength(3);
    expect(newState.queue[0].id).toBe('q2');
    expect(newState.queue[1].id).toBe('q3');
    expect(newState.queue[2].id).toBe('d1');

    // Deck should have one card left
    expect(newState.deck).toHaveLength(1);
  });

  it('should not refill beyond available deck cards', () => {
    const queueCard = createTestCard('q1', '5', '♠');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState(
      [player1, player2],
      [queueCard],
      [] // Empty deck
    );

    const actions = createTurnActions(
      'player1',
      { type: 'burn' },
      'player2',
      { type: 'burn' }
    );

    const newState = resolveTurn(state, actions);

    // Queue should be empty
    expect(newState.queue).toHaveLength(0);
    expect(newState.deck).toHaveLength(0);
  });
});

// ============================================================================
// Tests: Game End Conditions
// ============================================================================

describe('Game end conditions', () => {
  it('should end game when all lanes are locked', () => {
    const card = createTestCard('test-5', '5', '♠');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane([], 0, true, false), // Locked
      createTestLane([], 0, true, false), // Locked
      createTestLane([], 15, false, false), // Not locked
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane([], 0, true, false), // Locked
      createTestLane([], 0, true, false), // Locked
      createTestLane([], 18, false, false), // Not locked
    ]);
    const state = createTestGameState([player1, player2], [card]);

    const actions = createTurnActions(
      'player1',
      { type: 'stand', targetLane: 2 },
      'player2',
      { type: 'stand', targetLane: 2 }
    );

    const newState = resolveTurn(state, actions);

    // Game should be over
    expect(newState.gameOver).toBe(true);

    // All lanes should be locked
    expect(newState.players[0].lanes.every(l => l.locked)).toBe(true);
    expect(newState.players[1].lanes.every(l => l.locked)).toBe(true);
  });

  it('should end game when deck and queue are exhausted', () => {
    const card = createTestCard('last-card', '7', '♦');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState(
      [player1, player2],
      [card],
      [] // Empty deck
    );

    const actions = createTurnActions(
      'player1',
      { type: 'burn' },
      'player2',
      { type: 'burn' }
    );

    const newState = resolveTurn(state, actions);

    // Game should be over
    expect(newState.gameOver).toBe(true);
    expect(newState.queue).toHaveLength(0);
    expect(newState.deck).toHaveLength(0);
  });

  it('should determine winner when player1 wins 2 out of 3 lanes', () => {
    const card = createTestCard('test-5', '5', '♠');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane([createTestCard('p1-k', 'K', '♠')], 10, true, false), // Locked
      createTestLane([createTestCard('p1-q', 'Q', '♥')], 10, true, false), // Locked
      createTestLane([], 0, true, false), // Locked empty
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane([createTestCard('p2-5', '5', '♦')], 5, true, false), // Locked
      createTestLane([createTestCard('p2-7', '7', '♣')], 7, true, false), // Locked
      createTestLane([], 0, true, false), // Locked empty
    ]);
    const state = createTestGameState([player1, player2], [card]);

    // Both players stand on already-locked lanes (no-op action to trigger game end check)
    const actions = createTurnActions(
      'player1',
      { type: 'stand', targetLane: 0 },
      'player2',
      { type: 'stand', targetLane: 0 }
    );

    const newState = resolveTurn(state, actions);

    // All lanes already locked
    const allLocked = newState.players.every(p => p.lanes.every(l => l.locked));
    expect(allLocked).toBe(true);

    // Game over
    expect(newState.gameOver).toBe(true);

    // Player1 wins (10 > 5, 10 > 7, tie on lane 2)
    expect(newState.winner).toBe('player1');
  });

  it('should determine winner when player2 wins 2 out of 3 lanes', () => {
    const card = createTestCard('test-3', '3', '♥');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane([createTestCard('p1-k', 'K', '♠')], 10, true, false), // Locked
      createTestLane([], 0, true, true), // Busted and locked
      createTestLane([createTestCard('p1-5', '5', '♣')], 5, true, false), // Locked
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane([createTestCard('p2-9', '9', '♦')], 9, true, false), // Locked
      createTestLane([createTestCard('p2-10', '10', '♥')], 10, true, false), // Locked
      createTestLane([createTestCard('p2-7', '7', '♠')], 7, true, false), // Locked
    ]);
    const state = createTestGameState([player1, player2], [card]);

    const actions = createTurnActions(
      'player1',
      { type: 'stand', targetLane: 0 },
      'player2',
      { type: 'stand', targetLane: 0 }
    );

    const newState = resolveTurn(state, actions);

    // Game should be over (all lanes already locked)
    expect(newState.gameOver).toBe(true);

    // Player2 wins (P1 wins lane 0: 10>9, P2 wins lane 1: 10>0 bust, P2 wins lane 2: 7>5)
    expect(newState.winner).toBe('player2');
  });

  it('should handle draw when tied appropriately', () => {
    const card = createTestCard('test-k', 'K', '♦');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane([createTestCard('p1-k', 'K', '♠')], 10, true, false), // Locked
      createTestLane([createTestCard('p1-9', '9', '♥')], 9, true, false), // Locked
      createTestLane([createTestCard('p1-7', '7', '♣')], 7, true, false), // Locked
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane([createTestCard('p2-9', '9', '♦')], 9, true, false), // Locked
      createTestLane([createTestCard('p2-10', '10', '♠')], 10, true, false), // Locked
      createTestLane([createTestCard('p2-7', '7', '♥')], 7, true, false), // Locked
    ]);
    const state = createTestGameState([player1, player2], [card]);

    const actions = createTurnActions(
      'player1',
      { type: 'stand', targetLane: 0 },
      'player2',
      { type: 'stand', targetLane: 0 }
    );

    const newState = resolveTurn(state, actions);

    // Game should be over (all lanes already locked)
    expect(newState.gameOver).toBe(true);

    // Draw (P1 wins lane 0: 10>9, P2 wins lane 1: 10>9, tie lane 2: 7=7, equal high values 10=10)
    expect(newState.winner).toBe(null);
  });

  it('should not end game when lanes still open and cards remain', () => {
    const card1 = createTestCard('q1', '5', '♠');
    const card2 = createTestCard('q2', '6', '♥');
    const card3 = createTestCard('q3', '7', '♦');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState(
      [player1, player2],
      [card1, card2, card3],
      [createTestCard('d1', '8', '♣')]
    );

    const actions = createTurnActions(
      'player1',
      { type: 'take', targetLane: 0 },
      'player2',
      { type: 'take', targetLane: 1 }
    );

    const newState = resolveTurn(state, actions);

    // Game should NOT be over
    expect(newState.gameOver).toBe(false);
    expect(newState.winner).toBe(null);
  });
});

// ============================================================================
// Tests: Determinism and Immutability
// ============================================================================

describe('Determinism and immutability', () => {
  it('should not mutate original state', () => {
    const card = createTestCard('test-5', '5', '♠');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState([player1, player2], [card]);

    const originalQueueLength = state.queue.length;
    const originalTurnNumber = state.turnNumber;
    const originalP1Energy = state.players[0].energy;

    const actions = createTurnActions(
      'player1',
      { type: 'take', targetLane: 0 },
      'player2',
      { type: 'burn' }
    );

    const newState = resolveTurn(state, actions);

    // Original state should be unchanged
    expect(state.queue.length).toBe(originalQueueLength);
    expect(state.turnNumber).toBe(originalTurnNumber);
    expect(state.players[0].energy).toBe(originalP1Energy);
    expect(state.players[0].lanes[0].cards).toHaveLength(0);

    // New state should be different
    expect(newState.queue.length).not.toBe(originalQueueLength);
    expect(newState.turnNumber).not.toBe(originalTurnNumber);
  });

  it('should produce same result for same inputs (determinism)', () => {
    const card = createTestCard('test-k', 'K', '♠');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState([player1, player2], [card]);

    const actions = createTurnActions(
      'player1',
      { type: 'take', targetLane: 0 },
      'player2',
      { type: 'take', targetLane: 1 }
    );

    const result1 = resolveTurn(state, actions);
    const result2 = resolveTurn(state, actions);

    // Both results should be identical
    expect(result1.turnNumber).toBe(result2.turnNumber);
    expect(result1.players[0].lanes[0].total).toBe(result2.players[0].lanes[0].total);
    expect(result1.players[1].lanes[1].total).toBe(result2.players[1].lanes[1].total);
    expect(result1.queue.length).toBe(result2.queue.length);
  });

  it('should handle early exit when game is already over', () => {
    const card = createTestCard('test-5', '5', '♠');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane([], 0, true, false),
      createTestLane([], 0, true, false),
      createTestLane([], 0, true, false),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane([], 0, true, false),
      createTestLane([], 0, true, false),
      createTestLane([], 0, true, false),
    ]);
    const state = createTestGameState([player1, player2], [card], [], 10, true, 'player1');

    const actions = createTurnActions(
      'player1',
      { type: 'take', targetLane: 0 },
      'player2',
      { type: 'take', targetLane: 0 }
    );

    const newState = resolveTurn(state, actions);

    // State should be returned unchanged
    expect(newState).toBe(state);
    expect(newState.turnNumber).toBe(10);
    expect(newState.gameOver).toBe(true);
  });

  it('should increment turn number on every resolution', () => {
    const card = createTestCard('test-7', '7', '♥');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(),
      createTestLane(),
      createTestLane(),
    ]);
    const state = createTestGameState([player1, player2], [card], [], 5);

    const actions = createTurnActions(
      'player1',
      { type: 'stand', targetLane: 0 },
      'player2',
      { type: 'stand', targetLane: 1 }
    );

    const newState = resolveTurn(state, actions);

    expect(newState.turnNumber).toBe(6);
  });
});
