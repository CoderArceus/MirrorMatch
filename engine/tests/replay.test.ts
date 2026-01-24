/**
 * Tests for replay runner
 * Proves replays are deterministic and reproduce exact game states
 */

import { describe, it, expect } from 'vitest';
import { runReplay, runReplayWithHistory, compareReplays, Replay } from '../src/replay';
import { resolveTurn } from '../src/resolveTurn';
import { createInitialGameState } from '../src/state';
import { GameState, PlayerState, LaneState, Card } from '../src/types';
import { TurnActions } from '../src/actions';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestCard(id: string, rank: Card['rank'], suit: Card['suit']): Card {
  return { id, rank, suit };
}

function createTestLane(
  cards: Card[] = [],
  total: number = 0,
  locked: boolean = false,
  busted: boolean = false,
  shackled: boolean = false
): LaneState {
  return { cards, total, locked, busted, shackled };
}

function createTestPlayer(
  id: string,
  energy: number,
  lanes: LaneState[],
  overheat: number = 0
): PlayerState {
  return { id, energy, overheat, lanes };
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
// Tests: Simple Replay
// ============================================================================

describe('Simple replay', () => {
  it('should replay a 3-turn game correctly', () => {
    const card1 = createTestCard('c1', '5', '♠');
    const card2 = createTestCard('c2', '7', '♥');
    const card3 = createTestCard('c3', '9', '♦');
    const card4 = createTestCard('c4', '10', '♣');

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

    const initialState = createTestGameState(
      [player1, player2],
      [card1, card2, card3],
      [card4]
    );

    const replay: Replay = {
      initialState,
      turns: [
        // Turn 1: Both take to lane 0
        createTurnActions(
          'player1',
          { type: 'take', targetLane: 0 },
          'player2',
          { type: 'take', targetLane: 0 }
        ),
        // Turn 2: P1 burns, P2 takes to lane 1
        createTurnActions(
          'player1',
          { type: 'burn' },
          'player2',
          { type: 'take', targetLane: 1 }
        ),
        // Turn 3: Both stand
        createTurnActions(
          'player1',
          { type: 'stand', targetLane: 0 },
          'player2',
          { type: 'stand', targetLane: 0 }
        ),
      ],
    };

    const finalState = runReplay(replay);

    // Verify turn number
    expect(finalState.turnNumber).toBe(4); // Started at 1, +3 turns

    // Verify P1 lane 0 has card
    expect(finalState.players[0].lanes[0].cards).toHaveLength(1);
    expect(finalState.players[0].lanes[0].cards[0].id).toBe('c1');
    expect(finalState.players[0].lanes[0].locked).toBe(true); // Stood

    // Verify P2 lane 0 has card
    expect(finalState.players[1].lanes[0].cards).toHaveLength(1);
    expect(finalState.players[1].lanes[0].cards[0].id).toBe('c1');
    expect(finalState.players[1].lanes[0].locked).toBe(true); // Stood

    // Verify P2 lane 1 has Ash card (burned by P1)
    expect(finalState.players[1].lanes[1].cards).toHaveLength(1);
    expect(finalState.players[1].lanes[1].cards[0].rank).toBe('ASH');

    // Verify energy
    expect(finalState.players[0].energy).toBe(2); // Used 1 for burn
    expect(finalState.players[1].energy).toBe(4); // No burns + 1 Consolation
  });

  it('should handle empty replay (no turns)', () => {
    const initialState = createInitialGameState(42);

    const replay: Replay = {
      initialState,
      turns: [],
    };

    const finalState = runReplay(replay);

    // Should return initial state unchanged
    expect(finalState.turnNumber).toBe(1);
    expect(finalState.gameOver).toBe(false);
    expect(finalState.players[0].lanes[0].cards).toHaveLength(0);
  });

  it('should stop early when game ends', () => {
    const card = createTestCard('c1', '5', '♠');
    const player1 = createTestPlayer('player1', 3, [
      createTestLane([], 0, true, false),
      createTestLane([], 0, true, false),
      createTestLane([], 0, false, false),
    ]);
    const player2 = createTestPlayer('player2', 3, [
      createTestLane([], 0, true, false),
      createTestLane([], 0, true, false),
      createTestLane([], 0, false, false),
    ]);

    const initialState = createTestGameState([player1, player2], [card]);

    const replay: Replay = {
      initialState,
      turns: [
        // Turn 1: Both stand on last lane (game ends)
        createTurnActions(
          'player1',
          { type: 'stand', targetLane: 2 },
          'player2',
          { type: 'stand', targetLane: 2 }
        ),
        // Turn 2: Should not execute (game over)
        createTurnActions(
          'player1',
          { type: 'take', targetLane: 0 },
          'player2',
          { type: 'take', targetLane: 0 }
        ),
      ],
    };

    const finalState = runReplay(replay);

    // Game should end after turn 1
    expect(finalState.gameOver).toBe(true);
    expect(finalState.turnNumber).toBe(2); // Only 1 turn executed
  });
});

// ============================================================================
// Tests: Replay Determinism
// ============================================================================

describe('Replay determinism', () => {
  it('should produce identical results when run twice', () => {
    const initialState = createInitialGameState(12345);

    const replay: Replay = {
      initialState,
      turns: [
        createTurnActions(
          'player1',
          { type: 'take', targetLane: 0 },
          'player2',
          { type: 'take', targetLane: 1 }
        ),
        createTurnActions(
          'player1',
          { type: 'burn' },
          'player2',
          { type: 'burn' }
        ),
        createTurnActions(
          'player1',
          { type: 'take', targetLane: 0 },
          'player2',
          { type: 'stand', targetLane: 0 }
        ),
      ],
    };

    const result1 = runReplay(replay);
    const result2 = runReplay(replay);

    // Deep equality check
    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));

    // Specific checks
    expect(result1.turnNumber).toBe(result2.turnNumber);
    expect(result1.players[0].energy).toBe(result2.players[0].energy);
    expect(result1.players[0].lanes[0].total).toBe(result2.players[0].lanes[0].total);
    expect(result1.queue.length).toBe(result2.queue.length);
  });

  it('should produce identical results across multiple runs', () => {
    const initialState = createInitialGameState(99999);

    const replay: Replay = {
      initialState,
      turns: [
        createTurnActions(
          'player1',
          { type: 'take', targetLane: 0 },
          'player2',
          { type: 'take', targetLane: 0 }
        ),
        createTurnActions(
          'player1',
          { type: 'take', targetLane: 1 },
          'player2',
          { type: 'take', targetLane: 1 }
        ),
        createTurnActions(
          'player1',
          { type: 'take', targetLane: 2 },
          'player2',
          { type: 'take', targetLane: 2 }
        ),
      ],
    };

    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(runReplay(replay));
    }

    // All results should be identical
    const firstResult = JSON.stringify(results[0]);
    for (let i = 1; i < results.length; i++) {
      expect(JSON.stringify(results[i])).toBe(firstResult);
    }
  });

  it('should use compareReplays helper correctly', () => {
    const initialState = createInitialGameState(777);

    const replay1: Replay = {
      initialState,
      turns: [
        createTurnActions(
          'player1',
          { type: 'take', targetLane: 0 },
          'player2',
          { type: 'burn' }
        ),
      ],
    };

    const replay2: Replay = {
      initialState,
      turns: [
        createTurnActions(
          'player1',
          { type: 'take', targetLane: 0 },
          'player2',
          { type: 'burn' }
        ),
      ],
    };

    // Should be identical
    expect(compareReplays(replay1, replay2)).toBe(true);

    const replay3: Replay = {
      initialState,
      turns: [
        createTurnActions(
          'player1',
          { type: 'burn' },
          'player2',
          { type: 'take', targetLane: 0 }
        ),
      ],
    };

    // Should be different
    expect(compareReplays(replay1, replay3)).toBe(false);
  });
});

// ============================================================================
// Tests: Replay vs Live Resolution
// ============================================================================

describe('Replay vs live resolution', () => {
  it('should match manual step-by-step resolution', () => {
    const initialState = createInitialGameState(5555);

    const turns: TurnActions[] = [
      createTurnActions(
        'player1',
        { type: 'take', targetLane: 0 },
        'player2',
        { type: 'take', targetLane: 0 }
      ),
      createTurnActions(
        'player1',
        { type: 'burn' },
        'player2',
        { type: 'burn' }
      ),
      createTurnActions(
        'player1',
        { type: 'stand', targetLane: 0 },
        'player2',
        { type: 'stand', targetLane: 1 }
      ),
    ];

    // Method 1: Use replay runner
    const replay: Replay = { initialState, turns };
    const replayResult = runReplay(replay);

    // Method 2: Manual step-by-step
    let liveState = initialState;
    for (const turnActions of turns) {
      liveState = resolveTurn(liveState, turnActions);
    }

    // Results must be identical
    expect(JSON.stringify(replayResult)).toBe(JSON.stringify(liveState));
    expect(replayResult.turnNumber).toBe(liveState.turnNumber);
    expect(replayResult.players[0].energy).toBe(liveState.players[0].energy);
    expect(replayResult.gameOver).toBe(liveState.gameOver);
  });

  it('should produce same result with runReplayWithHistory', () => {
    const initialState = createInitialGameState(3333);

    const turns: TurnActions[] = [
      createTurnActions(
        'player1',
        { type: 'take', targetLane: 0 },
        'player2',
        { type: 'take', targetLane: 1 }
      ),
      createTurnActions(
        'player1',
        { type: 'take', targetLane: 0 },
        'player2',
        { type: 'take', targetLane: 1 }
      ),
    ];

    const replay: Replay = { initialState, turns };

    // Get full history
    const history = runReplayWithHistory(replay);

    // Should have initial state + 2 turn states
    expect(history).toHaveLength(3);
    expect(history[0].turnNumber).toBe(1);
    expect(history[1].turnNumber).toBe(2);
    expect(history[2].turnNumber).toBe(3);

    // Final state from history should match runReplay
    const finalFromReplay = runReplay(replay);
    expect(JSON.stringify(history[2])).toBe(JSON.stringify(finalFromReplay));
  });

  it('should handle long replay sequences', () => {
    const initialState = createInitialGameState(11111);

    // Create 10 turns of alternating actions
    const turns: TurnActions[] = [];
    for (let i = 0; i < 10; i++) {
      const lane = i % 3;
      turns.push(
        createTurnActions(
          'player1',
          { type: 'take', targetLane: lane },
          'player2',
          { type: 'take', targetLane: lane }
        )
      );
    }

    const replay: Replay = { initialState, turns };

    // Replay method
    const replayResult = runReplay(replay);

    // Manual method
    let liveState = initialState;
    for (const turnActions of turns) {
      liveState = resolveTurn(liveState, turnActions);
      if (liveState.gameOver) break;
    }

    // Should match
    expect(replayResult.turnNumber).toBe(liveState.turnNumber);
    expect(JSON.stringify(replayResult)).toBe(JSON.stringify(liveState));
  });
});
