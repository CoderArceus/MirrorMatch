/**
 * MirrorMatch: Strategic 21 - Pass Action Tests
 * Tests for the Pass action which prevents engine soft-locks
 */

import { describe, it, expect } from 'vitest';
import { getLegalActions, isActionLegal } from '../src/validators';
import { resolveTurn } from '../src/resolveTurn';
import { GameState, PlayerState, LaneState } from '../src/types';
import { TurnActions } from '../src/actions';

// Helper to create a lane
function createLane(total: number, locked: boolean, busted: boolean = false): LaneState {
  return {
    cards: [],
    total,
    locked,
    busted,
  };
}

// Helper to create a player
function createPlayer(id: string, energy: number, lanes: LaneState[]): PlayerState {
  return {
    id,
    energy,
    lanes,
  };
}

describe('Pass Action - Engine Contract', () => {
  describe('getLegalActions - Always returns at least one action', () => {
    it('should return pass when all lanes are locked and queue is empty', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 0, [
            createLane(21, true),
            createLane(20, true),
            createLane(19, true),
          ]),
          createPlayer('p2', 3, [
            createLane(15, false),
            createLane(0, false),
            createLane(0, false),
          ]),
        ],
        turnNumber: 10,
        gameOver: false,
        winner: null,
      };

      const actions = getLegalActions(state, 'p1');
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: 'pass' });
    });

    it('should return pass when all lanes are locked and energy is 0', () => {
      const state: GameState = {
        deck: [],
        queue: [{ id: 'card-1', suit: '♠', rank: '10' }],
        players: [
          createPlayer('p1', 0, [
            createLane(21, true),
            createLane(20, true),
            createLane(19, true),
          ]),
          createPlayer('p2', 3, [
            createLane(15, false),
            createLane(0, false),
            createLane(0, false),
          ]),
        ],
        turnNumber: 10,
        gameOver: false,
        winner: null,
      };

      const actions = getLegalActions(state, 'p1');
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: 'pass' });
    });

    it('should return real actions when available, not pass', () => {
      const state: GameState = {
        deck: [],
        queue: [{ id: 'card-1', suit: '♠', rank: '10' }],
        players: [
          createPlayer('p1', 1, [
            createLane(15, false),
            createLane(20, true),
            createLane(19, true),
          ]),
          createPlayer('p2', 3, [
            createLane(15, false),
            createLane(0, false),
            createLane(0, false),
          ]),
        ],
        turnNumber: 10,
        gameOver: false,
        winner: null,
      };

      const actions = getLegalActions(state, 'p1');
      
      // Should have take(0), burn, stand(0) - NO pass
      expect(actions.length).toBeGreaterThan(1);
      expect(actions.some(a => a.type === 'pass')).toBe(false);
      expect(actions.some(a => a.type === 'take')).toBe(true);
      expect(actions.some(a => a.type === 'burn')).toBe(true);
      expect(actions.some(a => a.type === 'stand')).toBe(true);
    });

    it('should return empty array when game is over', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 0, [
            createLane(21, true),
            createLane(20, true),
            createLane(19, true),
          ]),
          createPlayer('p2', 0, [
            createLane(21, true),
            createLane(20, true),
            createLane(18, true),
          ]),
        ],
        turnNumber: 10,
        gameOver: true,
        winner: 'p1',
      };

      const actions = getLegalActions(state, 'p1');
      expect(actions).toHaveLength(0);
    });
  });

  describe('isActionLegal - Pass validation', () => {
    it('should allow pass ONLY when it is the only legal action', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 0, [
            createLane(21, true),
            createLane(20, true),
            createLane(19, true),
          ]),
          createPlayer('p2', 3, [
            createLane(15, false),
            createLane(0, false),
            createLane(0, false),
          ]),
        ],
        turnNumber: 10,
        gameOver: false,
        winner: null,
      };

      expect(isActionLegal(state, 'p1', { type: 'pass' })).toBe(true);
    });

    it('should NOT allow pass when other actions are available', () => {
      const state: GameState = {
        deck: [],
        queue: [{ id: 'card-1', suit: '♠', rank: '10' }],
        players: [
          createPlayer('p1', 1, [
            createLane(15, false),
            createLane(20, true),
            createLane(19, true),
          ]),
          createPlayer('p2', 3, [
            createLane(15, false),
            createLane(0, false),
            createLane(0, false),
          ]),
        ],
        turnNumber: 10,
        gameOver: false,
        winner: null,
      };

      // Pass should be illegal when other actions exist
      expect(isActionLegal(state, 'p1', { type: 'pass' })).toBe(false);
      
      // But other actions should be legal
      expect(isActionLegal(state, 'p1', { type: 'take', targetLane: 0 })).toBe(true);
      expect(isActionLegal(state, 'p1', { type: 'burn' })).toBe(true);
    });
  });

  describe('resolveTurn - Pass action handling', () => {
    it('should handle one player passing while the other acts', () => {
      const state: GameState = {
        deck: [{ id: 'card-2', suit: '♥', rank: '7' }], // Add deck card to prevent game over
        queue: [{ id: 'card-1', suit: '♠', rank: '5' }],
        players: [
          createPlayer('p1', 0, [
            createLane(21, true),
            createLane(20, true),
            createLane(19, true),
          ]),
          createPlayer('p2', 1, [
            createLane(15, false),
            createLane(0, false),
            createLane(0, false),
          ]),
        ],
        turnNumber: 5,
        gameOver: false,
        winner: null,
      };

      const actions: TurnActions = {
        playerActions: [
          { playerId: 'p1', action: { type: 'pass' } },
          { playerId: 'p2', action: { type: 'take', targetLane: 0 } },
        ],
      };

      const newState = resolveTurn(state, actions);

      // Game should not be over (only p1 passed, deck still has cards)
      expect(newState.gameOver).toBe(false);
      
      // Turn should advance
      expect(newState.turnNumber).toBe(6);
      
      // P2 should have received the card
      expect(newState.players[1].lanes[0].cards).toHaveLength(1);
      
      // P1 should be unchanged (all lanes were already locked)
      expect(newState.players[0].lanes).toEqual(state.players[0].lanes);
    });

    it('should end game when both players pass', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 0, [
            createLane(21, true),
            createLane(20, true),
            createLane(19, true),
          ]),
          createPlayer('p2', 0, [
            createLane(18, true),
            createLane(17, true),
            createLane(16, true),
          ]),
        ],
        turnNumber: 10,
        gameOver: false,
        winner: null,
      };

      const actions: TurnActions = {
        playerActions: [
          { playerId: 'p1', action: { type: 'pass' } },
          { playerId: 'p2', action: { type: 'pass' } },
        ],
      };

      const newState = resolveTurn(state, actions);

      // Game MUST be over when both pass
      expect(newState.gameOver).toBe(true);
      
      // Winner should be determined
      expect(newState.winner).toBe('p1');
      
      // Turn should advance
      expect(newState.turnNumber).toBe(11);
    });

    it('should never return the same state when pass is used', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 0, [
            createLane(21, true),
            createLane(20, true),
            createLane(19, true),
          ]),
          createPlayer('p2', 0, [
            createLane(18, true),
            createLane(17, true),
            createLane(16, true),
          ]),
        ],
        turnNumber: 10,
        gameOver: false,
        winner: null,
      };

      const actions: TurnActions = {
        playerActions: [
          { playerId: 'p1', action: { type: 'pass' } },
          { playerId: 'p2', action: { type: 'pass' } },
        ],
      };

      const newState = resolveTurn(state, actions);

      // State MUST be different (at minimum, turnNumber changes)
      expect(newState).not.toBe(state);
      expect(newState.turnNumber).not.toBe(state.turnNumber);
    });

    it('should handle pass with stand - no interaction', () => {
      const state: GameState = {
        deck: [],
        queue: [{ id: 'card-1', suit: '♠', rank: '5' }],
        players: [
          createPlayer('p1', 0, [
            createLane(21, true),
            createLane(20, true),
            createLane(19, true),
          ]),
          createPlayer('p2', 1, [
            createLane(15, false),
            createLane(10, false),
            createLane(0, false),
          ]),
        ],
        turnNumber: 5,
        gameOver: false,
        winner: null,
      };

      const actions: TurnActions = {
        playerActions: [
          { playerId: 'p1', action: { type: 'pass' } },
          { playerId: 'p2', action: { type: 'stand', targetLane: 1 } },
        ],
      };

      const newState = resolveTurn(state, actions);

      // P2's lane should be locked
      expect(newState.players[1].lanes[1].locked).toBe(true);
      
      // Queue should be unchanged (no interaction)
      expect(newState.queue).toEqual(state.queue);
      
      // Game continues
      expect(newState.gameOver).toBe(false);
    });
  });

  describe('Pass Action - AI Loop Prevention', () => {
    it('should prevent infinite loops by always having a legal action', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 0, [
            createLane(21, true),
            createLane(20, true),
            createLane(19, true),
          ]),
          createPlayer('p2', 0, [
            createLane(18, true),
            createLane(17, true),
            createLane(16, true),
          ]),
        ],
        turnNumber: 1,
        gameOver: false,
        winner: null,
      };

      let currentState = state;
      let iterations = 0;
      const maxIterations = 100;

      // Simulate AI loop
      while (!currentState.gameOver && iterations < maxIterations) {
        const p1Actions = getLegalActions(currentState, 'p1');
        const p2Actions = getLegalActions(currentState, 'p2');

        // Contract: always at least one action
        expect(p1Actions.length).toBeGreaterThan(0);
        expect(p2Actions.length).toBeGreaterThan(0);

        const actions: TurnActions = {
          playerActions: [
            { playerId: 'p1', action: p1Actions[0] },
            { playerId: 'p2', action: p2Actions[0] },
          ],
        };

        const nextState = resolveTurn(currentState, actions);
        
        // Contract: state must change
        expect(nextState.turnNumber).toBeGreaterThan(currentState.turnNumber);
        
        currentState = nextState;
        iterations++;
      }

      // Should terminate (both players pass -> game over)
      expect(currentState.gameOver).toBe(true);
      expect(iterations).toBeLessThan(maxIterations);
    });
  });
});
