/**
 * Tests for action validators
 * Using explicit state objects - no helpers allowed
 */

import { describe, it, expect } from 'vitest';
import { isActionLegal } from '../src/validators';
import { GameState, PlayerState, LaneState, Card } from '../src/types';
import { PlayerAction } from '../src/actions';

// ============================================================================
// Test Helpers - Explicit State Construction
// ============================================================================

function createTestCard(id: string, rank: Card['rank'], suit: Card['suit']): Card {
  return { id, rank, suit };
}

function createTestLane(locked: boolean = false, busted: boolean = false, cards: Card[] = []): LaneState {
  return {
    cards,
    total: 0, // Simplified for testing - validators don't check totals
    locked,
    busted,
    shackled: false,
  };
}

function createTestPlayer(id: string, energy: number, lanes: LaneState[]): PlayerState {
  return {
    id,
    energy,
    overheat: 0,
    lanes,
  };
}

function createTestGameState(
  players: PlayerState[],
  queueSize: number = 3,
  gameOver: boolean = false
): GameState {
  const queue: Card[] = [];
  for (let i = 0; i < queueSize; i++) {
    queue.push(createTestCard(`card-${i}`, '5', '♠'));
  }

  return {
    deck: [],
    queue,
    players,
    turnNumber: 1,
    gameOver,
    winner: null,
  };
}

// ============================================================================
// Tests: TAKE Action
// ============================================================================

describe('TAKE action validation', () => {
  it('should be legal on an unlocked lane with cards in queue', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false), // Lane 0: unlocked
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'take', targetLane: 0 };
    expect(isActionLegal(state, 'player1', action)).toBe(true);
  });

  it('should be illegal on a locked lane', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(true), // Lane 0: locked
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'take', targetLane: 0 };
    expect(isActionLegal(state, 'player1', action)).toBe(false);
  });

  it('should be illegal when queue is empty', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 0); // Empty queue

    const action: PlayerAction = { type: 'take', targetLane: 0 };
    expect(isActionLegal(state, 'player1', action)).toBe(false);
  });

  it('should be illegal with invalid lane index (negative)', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'take', targetLane: -1 };
    expect(isActionLegal(state, 'player1', action)).toBe(false);
  });

  it('should be illegal with invalid lane index (too high)', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'take', targetLane: 3 };
    expect(isActionLegal(state, 'player1', action)).toBe(false);
  });

  it('should be legal on any valid unlocked lane', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    expect(isActionLegal(state, 'player1', { type: 'take', targetLane: 0 })).toBe(true);
    expect(isActionLegal(state, 'player1', { type: 'take', targetLane: 1 })).toBe(true);
    expect(isActionLegal(state, 'player1', { type: 'take', targetLane: 2 })).toBe(true);
  });
});

// ============================================================================
// Tests: BURN Action
// ============================================================================

describe('BURN action validation', () => {
  it('should be legal with energy > 0 and cards in queue', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'burn' };
    expect(isActionLegal(state, 'player1', action)).toBe(true);
  });

  it('should be illegal with 0 energy', () => {
    const player = createTestPlayer('player1', 0, [ // No energy
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'burn' };
    expect(isActionLegal(state, 'player1', action)).toBe(false);
  });

  it('should be illegal when queue is empty', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 0); // Empty queue

    const action: PlayerAction = { type: 'burn' };
    expect(isActionLegal(state, 'player1', action)).toBe(false);
  });

  it('should be legal with exactly 1 energy', () => {
    const player = createTestPlayer('player1', 1, // Exactly 1 energy
      [
        createTestLane(false),
        createTestLane(false),
        createTestLane(false),
      ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'burn' };
    expect(isActionLegal(state, 'player1', action)).toBe(true);
  });

  it('should be legal with high energy', () => {
    const player = createTestPlayer('player1', 10, // Lots of energy
      [
        createTestLane(false),
        createTestLane(false),
        createTestLane(false),
      ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'burn' };
    expect(isActionLegal(state, 'player1', action)).toBe(true);
  });
});

// ============================================================================
// Tests: STAND Action
// ============================================================================

describe('STAND action validation', () => {
  it('should be legal on an unlocked lane', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false), // Lane 0: unlocked
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'stand', targetLane: 0 };
    expect(isActionLegal(state, 'player1', action)).toBe(true);
  });

  it('should be illegal on a locked lane', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(true), // Lane 0: locked
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'stand', targetLane: 0 };
    expect(isActionLegal(state, 'player1', action)).toBe(false);
  });

  it('should be illegal with invalid lane index (negative)', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'stand', targetLane: -1 };
    expect(isActionLegal(state, 'player1', action)).toBe(false);
  });

  it('should be illegal with invalid lane index (too high)', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'stand', targetLane: 3 };
    expect(isActionLegal(state, 'player1', action)).toBe(false);
  });

  it('should be legal on empty lane (standing early is allowed)', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false, false, []), // Empty lane
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'stand', targetLane: 0 };
    expect(isActionLegal(state, 'player1', action)).toBe(true);
  });

  it('should be legal on any valid unlocked lane', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    expect(isActionLegal(state, 'player1', { type: 'stand', targetLane: 0 })).toBe(true);
    expect(isActionLegal(state, 'player1', { type: 'stand', targetLane: 1 })).toBe(true);
    expect(isActionLegal(state, 'player1', { type: 'stand', targetLane: 2 })).toBe(true);
  });
});

// ============================================================================
// Tests: Universal Checks
// ============================================================================

describe('Universal validation checks', () => {
  it('should reject any action when game is over', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3, true); // gameOver = true

    expect(isActionLegal(state, 'player1', { type: 'take', targetLane: 0 })).toBe(false);
    expect(isActionLegal(state, 'player1', { type: 'burn' })).toBe(false);
    expect(isActionLegal(state, 'player1', { type: 'stand', targetLane: 0 })).toBe(false);
  });

  it('should reject action from non-existent player', () => {
    const player = createTestPlayer('player1', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player], 3);

    const action: PlayerAction = { type: 'take', targetLane: 0 };
    expect(isActionLegal(state, 'player2', action)).toBe(false); // player2 doesn't exist
  });

  it('should accept actions from valid players in 2-player game', () => {
    const player1 = createTestPlayer('player1', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane(false),
      createTestLane(false),
      createTestLane(false),
    ]);
    const state = createTestGameState([player1, player2], 3);

    const action: PlayerAction = { type: 'take', targetLane: 0 };
    expect(isActionLegal(state, 'player1', action)).toBe(true);
    expect(isActionLegal(state, 'player2', action)).toBe(true);
  });
});
