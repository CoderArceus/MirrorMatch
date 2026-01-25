/**
 * Tests for engine invariants
 * These are the "physics laws" of the game that must NEVER be violated
 * 
 * Invariants are tested across random but legal action sequences
 * to prove the engine is stable under stress
 */

import { describe, it, expect } from 'vitest';
import { createInitialGameState, calculateLaneTotal } from '../src/state';
import { resolveTurn } from '../src/resolveTurn';
import { isActionLegal } from '../src/validators';
import { GameState, Card } from '../src/types';
import { TurnActions, PlayerAction, BidAction, BlindHitAction } from '../src/actions';

// ============================================================================
// Random Legal Action Generator
// ============================================================================

/**
 * Generates a random but legal action for a player
 * Uses validators to ensure only legal actions are produced
 */
function generateRandomLegalAction(state: GameState, playerId: string): PlayerAction {
  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    throw new Error(`Player ${playerId} not found`);
  }

  // Collect all possible actions
  const possibleActions: PlayerAction[] = [];

  // Try TAKE actions for each lane
  for (let lane = 0; lane < player.lanes.length; lane++) {
    const action: PlayerAction = { type: 'take', targetLane: lane };
    if (isActionLegal(state, playerId, action)) {
      possibleActions.push(action);
    }
  }

  // Try BURN action
  const burnAction: PlayerAction = { type: 'burn' };
  if (isActionLegal(state, playerId, burnAction)) {
    possibleActions.push(burnAction);
  }

  // Try STAND actions for each lane
  for (let lane = 0; lane < player.lanes.length; lane++) {
    const action: PlayerAction = { type: 'stand', targetLane: lane };
    if (isActionLegal(state, playerId, action)) {
      possibleActions.push(action);
    }
  }

  // Try BLIND HIT actions (v2.5)
  for (let lane = 0; lane < player.lanes.length; lane++) {
    const action: PlayerAction = { type: 'blind_hit', targetLane: lane };
    if (isActionLegal(state, playerId, action)) {
      possibleActions.push(action);
    }
  }

  // Try BID actions (v2.5) - only relevant during auction, but checking is cheap
  // Optimization: Only check if turn number is appropriate
  if ([4, 8].includes(state.turnNumber)) {
    for (let bid = 0; bid <= player.energy; bid++) {
      // Try a few void stone placements (not exhaustive to save perf)
      for (let i = 0; i < player.lanes.length; i++) {
        const action: BidAction = { type: 'bid', bidAmount: bid, potentialVoidStoneLane: i };
        if (isActionLegal(state, playerId, action)) {
          possibleActions.push(action);
        }
      }
    }
  }

  // If no legal actions (shouldn't happen in normal game), default to stand on first unlocked lane
  if (possibleActions.length === 0) {
    const firstUnlockedLane = player.lanes.findIndex(l => !l.locked);
    if (firstUnlockedLane >= 0) {
      return { type: 'stand', targetLane: firstUnlockedLane };
    }
    // All lanes locked - stand on any lane (will be no-op)
    return { type: 'stand', targetLane: 0 };
  }

  // Pick a random legal action
  const randomIndex = Math.floor(Math.random() * possibleActions.length);
  return possibleActions[randomIndex];
}

/**
 * Generates random but legal actions for both players
 */
function generateRandomTurnActions(state: GameState): TurnActions {
  const player1Id = state.players[0].id;
  const player2Id = state.players[1].id;

  return {
    playerActions: [
      { playerId: player1Id, action: generateRandomLegalAction(state, player1Id) },
      { playerId: player2Id, action: generateRandomLegalAction(state, player2Id) },
    ],
  };
}

// ============================================================================
// Invariant Checking Functions
// ============================================================================

/**
 * Asserts all engine invariants for a given state
 * Throws if any invariant is violated
 */
function assertInvariants(state: GameState, context: string = ''): void {
  const prefix = context ? `[${context}] ` : '';

  // Invariant 1: Lane totals must match card sums
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    for (let j = 0; j < player.lanes.length; j++) {
      const lane = player.lanes[j];
      const expectedTotal = calculateLaneTotal(lane.cards);
      expect(lane.total, `${prefix}Player ${player.id} lane ${j} total mismatch`).toBe(expectedTotal);
    }
  }

  // Invariant 2: Busted lanes must be locked
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    for (let j = 0; j < player.lanes.length; j++) {
      const lane = player.lanes[j];
      if (lane.busted) {
        // v2.5 Exception: Shackled lanes can be unlocked even if busted (to allow redemption/stacking?)
        // Actually, if it's busted, unlocking is mostly useless, but the rules say "Unlock".
        if (!lane.shackled) {
          expect(lane.locked, `${prefix}Player ${player.id} lane ${j} is busted but not locked`).toBe(true);
        }
      }
    }
  }

  // Invariant 3: Energy never negative
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    expect(player.energy, `${prefix}Player ${player.id} has negative energy`).toBeGreaterThanOrEqual(0);
  }

  // Invariant 4: Queue size <= 3
  expect(state.queue.length, `${prefix}Queue size exceeds 3`).toBeLessThanOrEqual(3);

  // Invariant 5: No duplicate card IDs within deck or queue
  // Note: Same card CAN appear in multiple player lanes (when both players Take the same card)
  const deckCardIds = new Set<string>();
  const queueCardIds = new Set<string>();

  // Collect from deck (no duplicates allowed)
  for (const card of state.deck) {
    expect(deckCardIds.has(card.id), `${prefix}Duplicate card ID in deck: ${card.id}`).toBe(false);
    deckCardIds.add(card.id);
  }

  // Collect from queue (no duplicates allowed)
  for (const card of state.queue) {
    if (!card.id.startsWith('ash-')) { // Ash cards are generated, not from deck
      expect(queueCardIds.has(card.id), `${prefix}Duplicate card ID in queue: ${card.id}`).toBe(false);
      queueCardIds.add(card.id);
    }
  }

  // Check that deck and queue don't share cards
  for (const queueCardId of queueCardIds) {
    expect(deckCardIds.has(queueCardId), `${prefix}Card ${queueCardId} appears in both deck and queue`).toBe(false);
  }

  // Invariant 6: Turn number must be positive
  expect(state.turnNumber, `${prefix}Turn number is not positive`).toBeGreaterThan(0);

  // Invariant 7: If gameOver is true, it stays true (tested by comparing consecutive states)
  // This is tested in the simulation loop

  // Invariant 8: Winner never changes once set (tested in simulation loop)
  // This is tested in the simulation loop

  // Invariant 9: Lanes at exactly 21 must be locked
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    for (let j = 0; j < player.lanes.length; j++) {
      const lane = player.lanes[j];
      if (lane.total === 21) {
        if (!lane.shackled) {
          expect(lane.locked, `${prefix}Player ${player.id} lane ${j} is at 21 but not locked`).toBe(true);
        }
      }
    }
  }

  // Invariant 10: Lanes over 21 must be busted
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    for (let j = 0; j < player.lanes.length; j++) {
      const lane = player.lanes[j];
      if (lane.total > 21) {
        expect(lane.busted, `${prefix}Player ${player.id} lane ${j} is over 21 but not busted`).toBe(true);
      }
    }
  }
}

// ============================================================================
// Tests: Single Turn Invariants
// ============================================================================

describe('Single turn invariants', () => {
  it('should maintain invariants after simple take action', () => {
    const state = createInitialGameState(42);

    const actions: TurnActions = {
      playerActions: [
        { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
        { playerId: 'player2', action: { type: 'take', targetLane: 0 } },
      ],
    };

    const newState = resolveTurn(state, actions);
    assertInvariants(newState, 'After take action');
  });

  it('should maintain invariants after burn action', () => {
    const state = createInitialGameState(123);

    const actions: TurnActions = {
      playerActions: [
        { playerId: 'player1', action: { type: 'burn' } },
        { playerId: 'player2', action: { type: 'burn' } },
      ],
    };

    const newState = resolveTurn(state, actions);
    assertInvariants(newState, 'After burn action');
  });

  it('should maintain invariants after stand action', () => {
    const state = createInitialGameState(456);

    const actions: TurnActions = {
      playerActions: [
        { playerId: 'player1', action: { type: 'stand', targetLane: 0 } },
        { playerId: 'player2', action: { type: 'stand', targetLane: 1 } },
      ],
    };

    const newState = resolveTurn(state, actions);
    assertInvariants(newState, 'After stand action');
  });

  it('should maintain invariants after ash card is given', () => {
    const state = createInitialGameState(789);

    const actions: TurnActions = {
      playerActions: [
        { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
        { playerId: 'player2', action: { type: 'burn' } },
      ],
    };

    const newState = resolveTurn(state, actions);
    assertInvariants(newState, 'After ash card given');
  });
});

// ============================================================================
// Tests: Multi-Turn Simulations
// ============================================================================

describe('Multi-turn simulations', () => {
  it('should maintain invariants across 20 random legal turns', () => {
    let state = createInitialGameState(1000);
    assertInvariants(state, 'Initial state');

    let previousGameOver = false;
    let previousWinner = state.winner;

    for (let turn = 0; turn < 20; turn++) {
      if (state.gameOver) {
        break;
      }

      const actions = generateRandomTurnActions(state);
      state = resolveTurn(state, actions);

      assertInvariants(state, `Turn ${turn + 1}`);

      // Invariant: gameOver is irreversible
      if (previousGameOver) {
        expect(state.gameOver, `Turn ${turn + 1}: gameOver changed from true to false`).toBe(true);
      }
      previousGameOver = state.gameOver;

      // Invariant: winner never changes once set
      if (previousWinner !== null) {
        expect(state.winner, `Turn ${turn + 1}: winner changed from ${previousWinner}`).toBe(previousWinner);
      }
      previousWinner = state.winner;
    }
  });

  it('should maintain invariants across 50 random legal turns', () => {
    let state = createInitialGameState(2000);
    assertInvariants(state, 'Initial state');

    for (let turn = 0; turn < 50; turn++) {
      if (state.gameOver) {
        break;
      }

      const actions = generateRandomTurnActions(state);
      state = resolveTurn(state, actions);

      assertInvariants(state, `Turn ${turn + 1}`);
    }
  });

  it('should maintain invariants in a game that reaches natural end', () => {
    let state = createInitialGameState(3000);
    assertInvariants(state, 'Initial state');

    let turnCount = 0;
    const maxTurns = 100; // Safety limit

    while (!state.gameOver && turnCount < maxTurns) {
      const actions = generateRandomTurnActions(state);
      state = resolveTurn(state, actions);
      turnCount++;

      assertInvariants(state, `Turn ${turnCount}`);
    }

    // Game should eventually end
    expect(turnCount, 'Game did not end within 100 turns').toBeLessThan(maxTurns);
  });

  it('should maintain turn number increments exactly by 1', () => {
    let state = createInitialGameState(4000);

    for (let turn = 0; turn < 30; turn++) {
      if (state.gameOver) {
        break;
      }

      const expectedTurn = state.turnNumber + 1;
      const actions = generateRandomTurnActions(state);
      state = resolveTurn(state, actions);

      expect(state.turnNumber, `Turn ${turn + 1}: turn number did not increment correctly`).toBe(expectedTurn);
    }
  });

  it('should handle multiple games without breaking invariants', () => {
    for (let gameNum = 0; gameNum < 10; gameNum++) {
      let state = createInitialGameState(5000 + gameNum);
      assertInvariants(state, `Game ${gameNum + 1} - Initial`);

      for (let turn = 0; turn < 20; turn++) {
        if (state.gameOver) {
          break;
        }

        const actions = generateRandomTurnActions(state);
        state = resolveTurn(state, actions);

        assertInvariants(state, `Game ${gameNum + 1} - Turn ${turn + 1}`);
      }
    }
  });
});

// ============================================================================
// Tests: Specific Edge Cases
// ============================================================================

describe('Edge case invariants', () => {
  it('should maintain invariants when all players run out of energy', () => {
    let state = createInitialGameState(6000);

    // Burn until both players have no energy
    while (state.players[0].energy > 0 || state.players[1].energy > 0) {
      if (state.gameOver) break;

      const actions: TurnActions = {
        playerActions: [
          {
            playerId: 'player1',
            action: state.players[0].energy > 0 ? { type: 'burn' } : { type: 'take', targetLane: 0 }
          },
          {
            playerId: 'player2',
            action: state.players[1].energy > 0 ? { type: 'burn' } : { type: 'take', targetLane: 0 }
          },
        ],
      };

      state = resolveTurn(state, actions);
      assertInvariants(state, 'After energy depletion');
    }

    expect(state.players[0].energy).toBe(0);
    expect(state.players[1].energy).toBe(0);
  });

  it('should maintain invariants when deck is exhausted', () => {
    let state = createInitialGameState(7000);

    // Play until deck is empty or game ends
    let turnCount = 0;
    while (state.deck.length > 0 && !state.gameOver && turnCount < 100) {
      const actions = generateRandomTurnActions(state);
      state = resolveTurn(state, actions);
      turnCount++;

      assertInvariants(state, `Turn ${turnCount} - deck exhaustion test`);
    }

    // Either deck is exhausted, game ended, or we hit turn limit
    // All are valid outcomes - just verify invariants held throughout
    expect(turnCount).toBeGreaterThan(0);
  });

  it('should maintain invariants when lanes bust', () => {
    let state = createInitialGameState(8000);

    // Keep taking to lane 0 until it busts
    let turnCount = 0;
    while (!state.players[0].lanes[0].busted && turnCount < 20) {
      if (state.gameOver) break;
      if (state.players[0].lanes[0].locked) break;

      const actions: TurnActions = {
        playerActions: [
          { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
          { playerId: 'player2', action: { type: 'stand', targetLane: 0 } },
        ],
      };

      state = resolveTurn(state, actions);
      turnCount++;

      assertInvariants(state, `Turn ${turnCount} - bust test`);
    }
  });

  it('should maintain invariants across different seeds', () => {
    const seeds = [100, 200, 300, 400, 500];

    for (const seed of seeds) {
      let state = createInitialGameState(seed);
      assertInvariants(state, `Seed ${seed} - Initial`);

      for (let turn = 0; turn < 15; turn++) {
        if (state.gameOver) break;

        const actions = generateRandomTurnActions(state);
        state = resolveTurn(state, actions);

        assertInvariants(state, `Seed ${seed} - Turn ${turn + 1}`);
      }
    }
  });
});

// ============================================================================
// Tests: Stress Test (Optional but Strong)
// ============================================================================

describe('Stress test', () => {
  it('should maintain invariants across 100 full games', () => {
    let gamesCompleted = 0;
    let totalTurns = 0;

    for (let gameNum = 0; gameNum < 100; gameNum++) {
      let state = createInitialGameState(10000 + gameNum);
      let turnCount = 0;
      const maxTurns = 100;

      while (!state.gameOver && turnCount < maxTurns) {
        const actions = generateRandomTurnActions(state);
        state = resolveTurn(state, actions);
        turnCount++;
        totalTurns++;

        // Only assert invariants every few turns for performance
        if (turnCount % 5 === 0 || state.gameOver) {
          assertInvariants(state, `Game ${gameNum + 1} - Turn ${turnCount}`);
        }
      }

      if (state.gameOver) {
        gamesCompleted++;
      }

      // Final check
      assertInvariants(state, `Game ${gameNum + 1} - Final`);
    }

    // Most games should complete naturally
    expect(gamesCompleted).toBeGreaterThan(50);

    // Should have played substantial turns (average ~8-10 per game)
    expect(totalTurns).toBeGreaterThan(500);
  });
});
