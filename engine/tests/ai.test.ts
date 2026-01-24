/**
 * Seque AI Tests - Correctness Validation
 * 
 * These tests verify that the AI:
 * - Always returns legal actions
 * - Never deadlocks
 * - Handles Pass correctly
 * - Follows engine rules
 * 
 * NOT testing: Strategy quality (that comes later)
 * TESTING: Correctness and safety
 */

import { describe, it, expect } from 'vitest';
import { chooseAction } from '../src/ai';
import type { AIDifficulty } from '../src/ai';
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

describe('AI - Correctness Validation', () => {
  describe('AI always returns a legal action', () => {
    it('should return a legal action for easy AI in normal state', () => {
      const state = createInitialGameState(12345);
      const action = chooseAction(state, 'player1', 'easy');

      expect(isActionLegal(state, 'player1', action)).toBe(true);
    });

    it('should return a legal action for medium AI in normal state', () => {
      const state = createInitialGameState(54321);
      const action = chooseAction(state, 'player2', 'medium');

      expect(isActionLegal(state, 'player2', action)).toBe(true);
    });

    it('should return a legal action when multiple actions available', () => {
      const state = createTestState(
        createPlayer('p1', 3, [
          createLane(10, false),
          createLane(15, false),
          createLane(0, false),
        ]),
        createPlayer('p2', 2, [
          createLane(12, false),
          createLane(14, false),
          createLane(8, false),
        ]),
        3,
        10
      );

      const easyAction = chooseAction(state, 'p1', 'easy');
      const mediumAction = chooseAction(state, 'p1', 'medium');

      expect(isActionLegal(state, 'p1', easyAction)).toBe(true);
      expect(isActionLegal(state, 'p1', mediumAction)).toBe(true);
    });

    it('should return a legal action when only one lane is unlocked', () => {
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

      const action = chooseAction(state, 'p1', 'medium');
      expect(isActionLegal(state, 'p1', action)).toBe(true);
    });
  });

  describe('AI returns Pass when forced', () => {
    it('should return pass when all lanes locked and queue empty', () => {
      const state = createTestState(
        createPlayer('p1', 0, [
          createLane(21, true),
          createLane(20, true),
          createLane(19, true),
        ]),
        createPlayer('p2', 2, [
          createLane(18, false),
          createLane(17, false),
          createLane(16, false),
        ]),
        0,
        0
      );

      const easyAction = chooseAction(state, 'p1', 'easy');
      const mediumAction = chooseAction(state, 'p1', 'medium');

      expect(easyAction).toEqual({ type: 'pass' });
      expect(mediumAction).toEqual({ type: 'pass' });
      expect(isActionLegal(state, 'p1', easyAction)).toBe(true);
      expect(isActionLegal(state, 'p1', mediumAction)).toBe(true);
    });

    it('should return pass when all lanes locked and no energy', () => {
      const state = createTestState(
        createPlayer('p1', 0, [
          createLane(21, true),
          createLane(20, true),
          createLane(19, true),
        ]),
        createPlayer('p2', 2, [
          createLane(18, false),
          createLane(17, false),
          createLane(16, false),
        ]),
        1,
        5
      );

      const legalActions = getLegalActions(state, 'p1');
      expect(legalActions).toEqual([{ type: 'pass' }]);

      const easyAction = chooseAction(state, 'p1', 'easy');
      const mediumAction = chooseAction(state, 'p1', 'medium');

      expect(easyAction).toEqual({ type: 'pass' });
      expect(mediumAction).toEqual({ type: 'pass' });
    });

    it('should handle pass correctly when only action available', () => {
      const state = createTestState(
        createPlayer('p1', 0, [
          createLane(21, true),
          createLane(22, true),
          createLane(25, true),
        ]),
        createPlayer('p2', 3, [
          createLane(18, false),
          createLane(0, false),
          createLane(0, false),
        ]),
        0,
        0
      );

      const action = chooseAction(state, 'p1', 'medium');
      expect(action.type).toBe('pass');
      expect(getLegalActions(state, 'p1')).toEqual([{ type: 'pass' }]);
    });
  });

  describe('AI never crashes on edge cases', () => {
    it('should handle terminal-adjacent states (one turn from game over)', () => {
      const state = createTestState(
        createPlayer('p1', 1, [
          createLane(21, true),
          createLane(20, true),
          createLane(19, false),
        ]),
        createPlayer('p2', 0, [
          createLane(18, true),
          createLane(17, true),
          createLane(16, true),
        ]),
        1,
        0
      );

      expect(() => chooseAction(state, 'p1', 'easy')).not.toThrow();
      expect(() => chooseAction(state, 'p1', 'medium')).not.toThrow();

      const action = chooseAction(state, 'p1', 'medium');
      expect(isActionLegal(state, 'p1', action)).toBe(true);
    });

    it('should handle state with empty queue but cards in deck', () => {
      const state = createTestState(
        createPlayer('p1', 2, [
          createLane(10, false),
          createLane(12, false),
          createLane(8, false),
        ]),
        createPlayer('p2', 2, [
          createLane(11, false),
          createLane(13, false),
          createLane(9, false),
        ]),
        0,
        20
      );

      expect(() => chooseAction(state, 'p1', 'easy')).not.toThrow();
      expect(() => chooseAction(state, 'p1', 'medium')).not.toThrow();
    });

    it('should handle state with all lanes busted except one', () => {
      const state = createTestState(
        createPlayer('p1', 3, [
          createLane(25, true, true),
          createLane(23, true, true),
          createLane(10, false),
        ]),
        createPlayer('p2', 3, [
          createLane(18, false),
          createLane(19, false),
          createLane(17, false),
        ]),
        2,
        10
      );

      const action = chooseAction(state, 'p1', 'medium');
      expect(isActionLegal(state, 'p1', action)).toBe(true);
    });
  });

  describe('AI vs AI game always terminates', () => {
    it('should complete a full AI vs AI game without deadlock (easy vs easy)', () => {
      let state = createInitialGameState(99999);
      let iterations = 0;
      const maxIterations = 1000;

      while (!state.gameOver && iterations < maxIterations) {
        const p1Action = chooseAction(state, 'player1', 'easy');
        const p2Action = chooseAction(state, 'player2', 'easy');

        // Verify both actions are legal
        expect(isActionLegal(state, 'player1', p1Action)).toBe(true);
        expect(isActionLegal(state, 'player2', p2Action)).toBe(true);

        const turnActions: TurnActions = {
          playerActions: [
            { playerId: 'player1', action: p1Action },
            { playerId: 'player2', action: p2Action },
          ],
        };

        const newState = resolveTurn(state, turnActions);

        // State must advance
        expect(newState.turnNumber).toBeGreaterThan(state.turnNumber);

        state = newState;
        iterations++;
      }

      expect(state.gameOver).toBe(true);
      expect(iterations).toBeLessThan(maxIterations);
    });

    it('should complete a full AI vs AI game without deadlock (medium vs medium)', () => {
      let state = createInitialGameState(42424);
      let iterations = 0;
      const maxIterations = 1000;

      while (!state.gameOver && iterations < maxIterations) {
        const p1Action = chooseAction(state, 'player1', 'medium');
        const p2Action = chooseAction(state, 'player2', 'medium');

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

    it('should complete a full AI vs AI game without deadlock (easy vs medium)', () => {
      let state = createInitialGameState(77777);
      let iterations = 0;
      const maxIterations = 1000;

      while (!state.gameOver && iterations < maxIterations) {
        const p1Action = chooseAction(state, 'player1', 'easy');
        const p2Action = chooseAction(state, 'player2', 'medium');

        expect(isActionLegal(state, 'player1', p1Action)).toBe(true);
        expect(isActionLegal(state, 'player2', p2Action)).toBe(true);

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
    });
  });

  describe('Easy AI randomness does not violate legality', () => {
    it('should return legal actions across multiple calls (randomness test)', () => {
      const state = createTestState(
        createPlayer('p1', 3, [
          createLane(10, false),
          createLane(12, false),
          createLane(8, false),
        ]),
        createPlayer('p2', 2, [
          createLane(11, false),
          createLane(13, false),
          createLane(9, false),
        ]),
        3,
        20
      );

      // Call easy AI 50 times and verify all actions are legal
      for (let i = 0; i < 50; i++) {
        const action = chooseAction(state, 'p1', 'easy');
        expect(isActionLegal(state, 'p1', action)).toBe(true);
      }
    });

    it('should return different actions due to randomness', () => {
      const state = createTestState(
        createPlayer('p1', 3, [
          createLane(10, false),
          createLane(12, false),
          createLane(8, false),
        ]),
        createPlayer('p2', 2, [
          createLane(11, false),
          createLane(13, false),
          createLane(9, false),
        ]),
        3,
        20
      );

      const actions = new Set<string>();
      
      // Call 100 times and collect unique actions
      for (let i = 0; i < 100; i++) {
        const action = chooseAction(state, 'p1', 'easy');
        actions.add(JSON.stringify(action));
      }

      // With multiple legal actions, we should see some variety
      const legalActions = getLegalActions(state, 'p1');
      if (legalActions.length > 1) {
        expect(actions.size).toBeGreaterThan(1);
      }
    });
  });

  describe('Medium AI is deterministic', () => {
    it('should return the same action for the same state', () => {
      const state = createTestState(
        createPlayer('p1', 2, [
          createLane(15, false),
          createLane(18, false),
          createLane(10, false),
        ]),
        createPlayer('p2', 2, [
          createLane(16, false),
          createLane(17, false),
          createLane(12, false),
        ]),
        2,
        15
      );

      const action1 = chooseAction(state, 'p1', 'medium');
      const action2 = chooseAction(state, 'p1', 'medium');
      const action3 = chooseAction(state, 'p1', 'medium');

      expect(action1).toEqual(action2);
      expect(action2).toEqual(action3);
    });
  });
});
