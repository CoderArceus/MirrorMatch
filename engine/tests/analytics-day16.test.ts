/**
 * Day 16 Analytics Tests - Draw Analysis & Decisiveness
 * 
 * Tests for draw classification, decisiveness scoring, and anti-draw metrics
 */

import { describe, it, expect } from 'vitest';
import { 
  analyzeDraw, 
  getDecisivenessScore, 
  getMissedWinOpportunities,
  wasForcedDraw 
} from '../src/analytics';
import type { GameState, LaneState, PlayerState } from '../src/types';

// Helper to create test states
function createLane(total: number, locked: boolean, busted: boolean = false): LaneState {
  return { cards: [], total, locked, busted };
}

function createPlayer(id: string, energy: number, lanes: LaneState[]): PlayerState {
  return { id, energy, lanes };
}

function createDrawState(p1: PlayerState, p2: PlayerState, deckSize: number = 0, queueSize: number = 0): GameState {
  const deck = Array.from({ length: deckSize }, (_, i) => ({
    id: `deck-${i}`,
    suit: '♥' as const,
    rank: '5' as const,
  }));
  
  const queue = Array.from({ length: queueSize }, (_, i) => ({
    id: `queue-${i}`,
    suit: '♠' as const,
    rank: '3' as const,
  }));

  return {
    deck,
    queue,
    players: [p1, p2],
    turnNumber: 10,
    gameOver: true,
    winner: null, // Draw
  };
}

describe('Day 16: Draw Analysis', () => {
  describe('analyzeDraw - Draw Classification', () => {
    it('should classify mutual_pass (all lanes locked, cards remain)', () => {
      const state = createDrawState(
        createPlayer('p1', 0, [
          createLane(19, true),
          createLane(18, true),
          createLane(17, true),
        ]),
        createPlayer('p2', 0, [
          createLane(19, true),
          createLane(18, true),
          createLane(17, true),
        ]),
        5, // Deck has cards
        2  // Queue has cards
      );

      const reason = analyzeDraw(state);
      expect(reason).toBe('mutual_pass');
    });

    it('should classify deck_exhausted', () => {
      const state = createDrawState(
        createPlayer('p1', 2, [
          createLane(19, true),
          createLane(18, false),
          createLane(17, true),
        ]),
        createPlayer('p2', 2, [
          createLane(19, true),
          createLane(18, true),
          createLane(17, true),
        ]),
        0, // No deck
        0  // No queue
      );

      const reason = analyzeDraw(state);
      expect(reason).toBe('deck_exhausted');
    });

    it('should classify lane_split (1-1 lane outcome)', () => {
      const state = createDrawState(
        createPlayer('p1', 1, [
          createLane(20, true), // P1 wins
          createLane(17, true), // P2 wins
          createLane(18, true), // Tie
        ]),
        createPlayer('p2', 1, [
          createLane(18, true), // P1 wins
          createLane(19, true), // P2 wins
          createLane(18, true), // Tie
        ]),
        0,
        0
      );

      const reason = analyzeDraw(state);
      expect(reason).toBe('lane_split');
    });

    it('should classify stall_equilibrium (all locked early)', () => {
      const state = createDrawState(
        createPlayer('p1', 3, [
          createLane(18, true),
          createLane(17, true),
          createLane(16, true),
        ]),
        createPlayer('p2', 3, [
          createLane(18, true),
          createLane(17, true),
          createLane(16, true),
        ]),
        0,
        0
      );

      const reason = analyzeDraw(state);
      expect(reason).toBe('stall_equilibrium');
    });

    it('should throw error if called on non-draw', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 0, [createLane(21, true), createLane(20, true), createLane(19, true)]),
          createPlayer('p2', 0, [createLane(18, true), createLane(17, true), createLane(16, true)]),
        ],
        turnNumber: 10,
        gameOver: true,
        winner: 'p1', // Not a draw
      };

      expect(() => analyzeDraw(state)).toThrow('analyzeDraw called on non-draw game state');
    });

    it('should be deterministic (same state = same result)', () => {
      const state = createDrawState(
        createPlayer('p1', 0, [createLane(19, true), createLane(18, true), createLane(17, true)]),
        createPlayer('p2', 0, [createLane(19, true), createLane(18, true), createLane(17, true)]),
        5,
        2
      );

      const reason1 = analyzeDraw(state);
      const reason2 = analyzeDraw(state);
      const reason3 = analyzeDraw(state);

      expect(reason1).toBe(reason2);
      expect(reason2).toBe(reason3);
    });
  });

  describe('getDecisivenessScore - Pressure Metrics', () => {
    it('should return high score for decisive position', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 0, [
            createLane(21, true), // Perfect
            createLane(20, true), // Strong
            createLane(19, true), // Strong
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

      const score = getDecisivenessScore(state, 'p1');
      expect(score).toBeGreaterThan(70); // Very decisive
    });

    it('should return low score for indecisive position', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 3, [
            createLane(8, false),  // Indecisive
            createLane(10, false), // Indecisive
            createLane(12, false), // Indecisive
          ]),
          createPlayer('p2', 3, [
            createLane(9, false),
            createLane(11, false),
            createLane(13, false),
          ]),
        ],
        turnNumber: 3,
        gameOver: false,
        winner: null,
      };

      const score = getDecisivenessScore(state, 'p1');
      expect(score).toBeLessThan(40); // Indecisive
    });

    it('should be deterministic', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 1, [createLane(19, false), createLane(18, true), createLane(17, false)]),
          createPlayer('p2', 2, [createLane(18, true), createLane(17, false), createLane(16, true)]),
        ],
        turnNumber: 8,
        gameOver: false,
        winner: null,
      };

      const score1 = getDecisivenessScore(state, 'p1');
      const score2 = getDecisivenessScore(state, 'p1');
      const score3 = getDecisivenessScore(state, 'p1');

      expect(score1).toBe(score2);
      expect(score2).toBe(score3);
    });

    it('should return 0 for invalid player', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 1, [createLane(19, false), createLane(18, true), createLane(17, false)]),
          createPlayer('p2', 2, [createLane(18, true), createLane(17, false), createLane(16, true)]),
        ],
        turnNumber: 8,
        gameOver: false,
        winner: null,
      };

      const score = getDecisivenessScore(state, 'invalid');
      expect(score).toBe(0);
    });
  });

  describe('getMissedWinOpportunities - Anti-Draw Tracking', () => {
    it('should detect missed opportunities in draw', () => {
      const state = createDrawState(
        createPlayer('p1', 1, [
          createLane(19, false), // Missed: should have locked!
          createLane(20, false), // Missed: should have locked!
          createLane(18, true),
        ]),
        createPlayer('p2', 0, [
          createLane(18, true), // P1 could have won these
          createLane(17, true),
          createLane(18, true),
        ]),
        0,
        0
      );

      const missed = getMissedWinOpportunities(state, 'p1');
      expect(missed).toBeGreaterThan(0);
    });

    it('should return 0 for won games', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 0, [createLane(21, true), createLane(20, true), createLane(19, true)]),
          createPlayer('p2', 0, [createLane(18, true), createLane(17, true), createLane(20, true)]),
        ],
        turnNumber: 10,
        gameOver: true,
        winner: 'p1',
      };

      const missed = getMissedWinOpportunities(state, 'p1');
      expect(missed).toBe(0);
    });

    it('should cap at 3 (one per lane)', () => {
      const state = createDrawState(
        createPlayer('p1', 1, [
          createLane(20, false),
          createLane(19, false),
          createLane(18, false),
        ]),
        createPlayer('p2', 0, [
          createLane(15, true),
          createLane(14, true),
          createLane(13, true),
        ]),
        0,
        0
      );

      const missed = getMissedWinOpportunities(state, 'p1');
      expect(missed).toBeLessThanOrEqual(3);
    });
  });

  describe('wasForcedDraw - Draw Analysis', () => {
    it('should return true if all lanes locked', () => {
      const state = createDrawState(
        createPlayer('p1', 3, [
          createLane(19, true),
          createLane(18, true),
          createLane(17, true),
        ]),
        createPlayer('p2', 3, [
          createLane(19, true),
          createLane(18, true),
          createLane(17, true),
        ]),
        5,
        2
      );

      expect(wasForcedDraw(state, 'p1')).toBe(true);
    });

    it('should return true if no energy and no viable lanes', () => {
      const state = createDrawState(
        createPlayer('p1', 0, [
          createLane(21, false, true), // Busted
          createLane(22, false, true), // Busted
          createLane(21, true),       // Locked
        ]),
        createPlayer('p2', 0, [
          createLane(20, true),
          createLane(19, true),
          createLane(18, true),
        ]),
        0,
        0
      );

      expect(wasForcedDraw(state, 'p1')).toBe(true);
    });

    it('should return false if player had options', () => {
      const state = createDrawState(
        createPlayer('p1', 2, [
          createLane(17, false), // Could have built more
          createLane(18, true),
          createLane(19, true),
        ]),
        createPlayer('p2', 1, [
          createLane(18, true),
          createLane(17, true),
          createLane(19, true),
        ]),
        10,
        3
      );

      expect(wasForcedDraw(state, 'p1')).toBe(false);
    });

    it('should return false for non-draw games', () => {
      const state: GameState = {
        deck: [],
        queue: [],
        players: [
          createPlayer('p1', 0, [createLane(21, true), createLane(20, true), createLane(19, true)]),
          createPlayer('p2', 0, [createLane(18, true), createLane(17, true), createLane(16, true)]),
        ],
        turnNumber: 10,
        gameOver: true,
        winner: 'p1',
      };

      expect(wasForcedDraw(state, 'p1')).toBe(false);
    });
  });
});
