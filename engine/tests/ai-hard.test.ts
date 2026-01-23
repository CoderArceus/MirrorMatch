/**
 * MirrorMatch Hard AI Tests - Minimax-Lite Validation
 * 
 * Tests verify that Hard AI:
 * - Beats Easy AI consistently
 * - Avoids obvious draw lines
 * - Does not pass unless forced
 * - Always terminates (no infinite loops)
 * - Handles Pass-only states correctly
 */

import { describe, it, expect } from 'vitest';
import { chooseAction } from '../src/ai';
import { createInitialGameState } from '../src/state';
import { getLegalActions, isActionLegal } from '../src/validators';
import { resolveTurn } from '../src/resolveTurn';
import type { GameState, LaneState, PlayerState } from '../src/types';
import type { TurnActions } from '../src/actions';

// ============================================================================
// Helper Functions
// ============================================================================

function createLane(total: number, locked: boolean, busted: boolean = false): LaneState {
  return { cards: [], total, locked, busted };
}

function createPlayer(id: string, energy: number, lanes: LaneState[]): PlayerState {
  return { id, energy, lanes };
}

function createTestState(
  player1: PlayerState,
  player2: PlayerState,
  queueSize: number = 1,
  deckSize: number = 0
): GameState {
  const queue = [];
  for (let i = 0; i < queueSize; i++) {
    queue.push({ id: `card-${i}`, suit: '♠' as const, rank: '5' as const });
  }

  const deck = [];
  for (let i = 0; i < deckSize; i++) {
    deck.push({ id: `deck-${i}`, suit: '♥' as const, rank: '3' as const });
  }

  return {
    deck,
    queue,
    players: [player1, player2],
    turnNumber: 1,
    gameOver: false,
    winner: null,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Hard AI - Minimax-Lite', () => {
  describe('Hard AI always returns legal actions', () => {
    it('should return legal action in normal state', () => {
      const state = createInitialGameState(12345);
      const action = chooseAction(state, 'player1', 'hard');

      expect(isActionLegal(state, 'player1', action)).toBe(true);
    });

    it('should return legal action when multiple choices available', () => {
      const state = createTestState(
        createPlayer('p1', 3, [
          createLane(15, false),
          createLane(18, false),
          createLane(10, false),
        ]),
        createPlayer('p2', 2, [
          createLane(16, false),
          createLane(17, false),
          createLane(12, false),
        ]),
        3,
        20
      );

      const action = chooseAction(state, 'p1', 'hard');
      expect(isActionLegal(state, 'p1', action)).toBe(true);
    });
  });

  describe('Hard AI does not pass unless forced', () => {
    it('should NOT pass when other actions are available', () => {
      const state = createTestState(
        createPlayer('p1', 2, [
          createLane(15, false),
          createLane(18, true),
          createLane(19, true),
        ]),
        createPlayer('p2', 2, [
          createLane(16, false),
          createLane(17, false),
          createLane(12, false),
        ]),
        2,
        15
      );

      const legalActions = getLegalActions(state, 'p1');
      expect(legalActions.length).toBeGreaterThan(1);
      expect(legalActions.some(a => a.type === 'pass')).toBe(false);

      const action = chooseAction(state, 'p1', 'hard');
      expect(action.type).not.toBe('pass');
    });

    it('should pass ONLY when forced (no other actions)', () => {
      const state = createTestState(
        createPlayer('p1', 0, [
          createLane(21, true),
          createLane(20, true),
          createLane(19, true),
        ]),
        createPlayer('p2', 2, [
          createLane(16, false),
          createLane(17, false),
          createLane(12, false),
        ]),
        0,
        0
      );

      const legalActions = getLegalActions(state, 'p1');
      expect(legalActions).toEqual([{ type: 'pass' }]);

      const action = chooseAction(state, 'p1', 'hard');
      expect(action).toEqual({ type: 'pass' });
    });

    it('should handle forced pass without crashing', () => {
      const state = createTestState(
        createPlayer('p1', 0, [
          createLane(21, true),
          createLane(22, true, true),
          createLane(19, true),
        ]),
        createPlayer('p2', 3, [
          createLane(16, false),
          createLane(17, false),
          createLane(12, false),
        ]),
        1,
        0
      );

      // P1 has queue but all lanes locked and no energy
      const legalActions = getLegalActions(state, 'p1');
      expect(legalActions).toEqual([{ type: 'pass' }]);

      expect(() => chooseAction(state, 'p1', 'hard')).not.toThrow();
      const action = chooseAction(state, 'p1', 'hard');
      expect(action.type).toBe('pass');
    });
  });

  describe('Hard AI vs Easy AI - Win Rate', () => {
    it('should beat Easy AI consistently over multiple games', () => {
      const numGames = 20;
      let hardWins = 0;
      let easyWins = 0;
      let draws = 0;

      for (let seed = 1000; seed < 1000 + numGames; seed++) {
        let state = createInitialGameState(seed);

        while (!state.gameOver) {
          const p1Action = chooseAction(state, 'player1', 'hard');
          const p2Action = chooseAction(state, 'player2', 'easy');

          const turnActions: TurnActions = {
            playerActions: [
              { playerId: 'player1', action: p1Action },
              { playerId: 'player2', action: p2Action },
            ],
          };

          state = resolveTurn(state, turnActions);
        }

        if (state.winner === 'player1') {
          hardWins++;
        } else if (state.winner === 'player2') {
          easyWins++;
        } else {
          draws++;
        }
      }

      // Hard AI should win significantly more than Easy AI
      expect(hardWins).toBeGreaterThan(easyWins);
      // Hard should win at least 60% of games against random play
      expect(hardWins).toBeGreaterThanOrEqual(numGames * 0.6);
    });

    it('should beat Easy AI when playing as player2', () => {
      const numGames = 20;
      let hardWins = 0;
      let easyWins = 0;

      for (let seed = 2000; seed < 2000 + numGames; seed++) {
        let state = createInitialGameState(seed);

        while (!state.gameOver) {
          const p1Action = chooseAction(state, 'player1', 'easy');
          const p2Action = chooseAction(state, 'player2', 'hard');

          const turnActions: TurnActions = {
            playerActions: [
              { playerId: 'player1', action: p1Action },
              { playerId: 'player2', action: p2Action },
            ],
          };

          state = resolveTurn(state, turnActions);
        }

        if (state.winner === 'player2') {
          hardWins++;
        } else if (state.winner === 'player1') {
          easyWins++;
        }
      }

      expect(hardWins).toBeGreaterThan(easyWins);
      expect(hardWins).toBeGreaterThanOrEqual(numGames * 0.6);
    });
  });

  describe('Hard AI vs Medium AI - Competitive', () => {
    it('should be competitive against Medium AI', () => {
      const numGames = 20;
      let hardWins = 0;
      let mediumWins = 0;
      let draws = 0;

      for (let seed = 3000; seed < 3000 + numGames; seed++) {
        let state = createInitialGameState(seed);

        while (!state.gameOver) {
          const p1Action = chooseAction(state, 'player1', 'hard');
          const p2Action = chooseAction(state, 'player2', 'medium');

          const turnActions: TurnActions = {
            playerActions: [
              { playerId: 'player1', action: p1Action },
              { playerId: 'player2', action: p2Action },
            ],
          };

          state = resolveTurn(state, turnActions);
        }

        if (state.winner === 'player1') {
          hardWins++;
        } else if (state.winner === 'player2') {
          mediumWins++;
        } else {
          draws++;
        }
      }

      // Hard should win at least as often as Medium
      expect(hardWins).toBeGreaterThanOrEqual(mediumWins);
      // Hard should win more than 40% (could be close due to randomness)
      expect(hardWins).toBeGreaterThanOrEqual(numGames * 0.4);
    });
  });

  describe('Hard AI vs Hard AI - Always Terminates', () => {
    it('should complete a full game without deadlock', () => {
      let state = createInitialGameState(99999);
      let iterations = 0;
      const maxIterations = 1000;

      while (!state.gameOver && iterations < maxIterations) {
        const p1Action = chooseAction(state, 'player1', 'hard');
        const p2Action = chooseAction(state, 'player2', 'hard');

        expect(isActionLegal(state, 'player1', p1Action)).toBe(true);
        expect(isActionLegal(state, 'player2', p2Action)).toBe(true);

        const turnActions: TurnActions = {
          playerActions: [
            { playerId: 'player1', action: p1Action },
            { playerId: 'player2', action: p2Action },
          ],
        };

        const newState = resolveTurn(state, turnActions);
        expect(newState.turnNumber).toBeGreaterThan(state.turnNumber);

        state = newState;
        iterations++;
      }

      expect(state.gameOver).toBe(true);
      expect(iterations).toBeLessThan(maxIterations);
    });

    it('should complete multiple Hard vs Hard games', () => {
      for (let seed = 5000; seed < 5005; seed++) {
        let state = createInitialGameState(seed);
        let iterations = 0;
        const maxIterations = 1000;

        while (!state.gameOver && iterations < maxIterations) {
          const p1Action = chooseAction(state, 'player1', 'hard');
          const p2Action = chooseAction(state, 'player2', 'hard');

          const turnActions: TurnActions = {
            playerActions: [
              { playerId: 'player1', action: p1Action },
              { playerId: 'player2', action: p2Action },
            ],
          };

          state = resolveTurn(state, turnActions);
          iterations++;
        }

        expect(state.gameOver).toBe(true);
        expect(iterations).toBeLessThan(maxIterations);
      }
    });
  });

  describe('Hard AI - Draw Awareness', () => {
    it('should avoid obvious draw scenarios when possible', () => {
      // State where both players are tied and AI could pass for draw
      // but should prefer aggressive play
      const state = createTestState(
        createPlayer('p1', 1, [
          createLane(18, true),
          createLane(17, false),
          createLane(16, true),
        ]),
        createPlayer('p2', 1, [
          createLane(18, true),
          createLane(17, true),
          createLane(16, true),
        ]),
        1,
        10
      );

      // P1 has one unlocked lane - should try to improve it, not give up
      const legalActions = getLegalActions(state, 'p1');
      expect(legalActions.some(a => a.type !== 'pass')).toBe(true);

      const action = chooseAction(state, 'p1', 'hard');
      
      // Should NOT stand prematurely (preferring to continue playing)
      // This is draw awareness - keep fighting instead of settling
      expect(action.type).not.toBe('pass');
    });

    it('should prefer risky continuation over certain draw', () => {
      // Setup: both players have 1 lane win each, one contested lane
      const state = createTestState(
        createPlayer('p1', 2, [
          createLane(20, true), // Win
          createLane(15, false), // Contested
          createLane(17, true), // Loss
        ]),
        createPlayer('p2', 2, [
          createLane(18, true), // Loss
          createLane(16, false), // Contested
          createLane(19, true), // Win
        ]),
        1,
        5
      );

      const action = chooseAction(state, 'p1', 'hard');
      
      // Should try to win the contested lane, not stand prematurely
      if (action.type === 'stand') {
        expect(action.targetLane).toBe(1); // Only stand the contested lane if confident
      } else {
        // Should be taking or burning to improve position
        expect(['take', 'burn']).toContain(action.type);
      }
    });
  });

  describe('Hard AI - Minimax Evaluation on Pass States', () => {
    it('should not crash when evaluating states with Pass', () => {
      const state = createTestState(
        createPlayer('p1', 0, [
          createLane(21, true),
          createLane(20, true),
          createLane(15, false),
        ]),
        createPlayer('p2', 1, [
          createLane(18, false),
          createLane(19, false),
          createLane(17, false),
        ]),
        1,
        5
      );

      // P1 can take on one lane, but opponent has many options
      expect(() => chooseAction(state, 'p1', 'hard')).not.toThrow();
      
      const action = chooseAction(state, 'p1', 'hard');
      expect(isActionLegal(state, 'p1', action)).toBe(true);
    });

    it('should handle opponent having only Pass as response', () => {
      const state = createTestState(
        createPlayer('p1', 2, [
          createLane(18, false),
          createLane(19, false),
          createLane(17, false),
        ]),
        createPlayer('p2', 0, [
          createLane(21, true),
          createLane(20, true),
          createLane(19, true),
        ]),
        1,
        5
      );

      // P2 can only pass - P1's minimax should handle this
      const p2Actions = getLegalActions(state, 'p2');
      expect(p2Actions).toEqual([{ type: 'pass' }]);

      expect(() => chooseAction(state, 'p1', 'hard')).not.toThrow();
      const action = chooseAction(state, 'p1', 'hard');
      expect(isActionLegal(state, 'p1', action)).toBe(true);
    });
  });

  describe('Hard AI - Strategic Decisions', () => {
    it('should recognize winning opportunities', () => {
      // AI already has 1 lane win, can secure 2nd lane
      const state = createTestState(
        createPlayer('p1', 2, [
          createLane(21, true), // Won
          createLane(20, false), // Can win with low card
          createLane(17, true), // Lost
        ]),
        createPlayer('p2', 2, [
          createLane(18, true), // Lost
          createLane(19, false), // Opponent can't catch up
          createLane(20, true), // Won
        ]),
        1, // Queue has a card
        5
      );

      const action = chooseAction(state, 'p1', 'hard');
      
      // Should aggressively pursue the second lane win
      if (action.type === 'take') {
        expect(action.targetLane).toBe(1); // Take on the lane we can secure
      }
    });

    it('should recognize loss prevention opportunities', () => {
      // Opponent about to secure 2nd lane - AI should burn or disrupt
      const state = createTestState(
        createPlayer('p1', 3, [
          createLane(18, true), // Decent
          createLane(15, false),
          createLane(16, true),
        ]),
        createPlayer('p2', 1, [
          createLane(20, true), // Won
          createLane(20, false), // About to win with 1 card
          createLane(17, true), // Won
        ]),
        1, // Queue has a low value card that helps opponent
        5
      );

      const action = chooseAction(state, 'p1', 'hard');
      
      // Should burn to deny opponent's winning lane
      // (This is lookahead - medium AI might not see this)
      expect(['burn', 'take']).toContain(action.type);
    });
  });
});
