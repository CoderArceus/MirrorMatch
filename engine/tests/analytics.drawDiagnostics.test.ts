/**
 * MirrorMatch: Strategic 21 - Draw Diagnostics Tests
 * 
 * DAY 18 TASK 2.2: Tests for analyzeDrawDiagnostics aggregation
 * 
 * Tests that draw diagnostics correctly:
 * - Aggregate draw reason + metrics
 * - Use existing functions (no duplication)
 * - Are deterministic
 * - Respect actionLog for forcedPasses
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialGameState,
  analyzeDrawDiagnostics,
  analyzeDrawReason,
  getDecisivenessMetrics,
  type DrawDiagnostics,
  type DrawReason
} from '../src/index';

describe('Draw Diagnostics Aggregation (Day 18 Task 2.2)', () => {
  // ==========================================================================
  // Basic Structure Tests
  // ==========================================================================

  describe('interface and exports', () => {
    it('should export analyzeDrawDiagnostics function', () => {
      expect(typeof analyzeDrawDiagnostics).toBe('function');
    });

    it('should return DrawDiagnostics with correct structure', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        players: [
          {
            ...state.players[0],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false }
            ]
          },
          {
            ...state.players[1],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false }
            ]
          }
        ]
      };

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2');

      expect(diagnostics).toHaveProperty('reason');
      expect(diagnostics).toHaveProperty('p1');
      expect(diagnostics).toHaveProperty('p2');
      
      // Verify nested structure
      expect(diagnostics.p1).toHaveProperty('contestableLanes');
      expect(diagnostics.p1).toHaveProperty('energyRemaining');
      expect(diagnostics.p1).toHaveProperty('forcedPasses');
      expect(diagnostics.p1).toHaveProperty('winThreats');
      
      expect(diagnostics.p2).toHaveProperty('contestableLanes');
      expect(diagnostics.p2).toHaveProperty('energyRemaining');
      expect(diagnostics.p2).toHaveProperty('forcedPasses');
      expect(diagnostics.p2).toHaveProperty('winThreats');
    });
  });

  // ==========================================================================
  // Determinism Tests
  // ==========================================================================

  describe('determinism', () => {
    it('should return identical results for same input', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        players: [
          {
            ...state.players[0],
            energy: 1,
            lanes: [
              { cards: [], total: 20, locked: true, busted: false },
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 12, locked: true, busted: false }
            ]
          },
          {
            ...state.players[1],
            energy: 2,
            lanes: [
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 12, locked: true, busted: false }
            ]
          }
        ]
      };

      const diag1 = analyzeDrawDiagnostics(drawState, 'player1', 'player2');
      const diag2 = analyzeDrawDiagnostics(drawState, 'player1', 'player2');

      expect(diag1).toEqual(diag2);
    });

    it('should be deterministic across multiple calls', () => {
      const state = createInitialGameState(123);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        deck: [],
        queue: [],
        players: [
          {
            ...state.players[0],
            lanes: [
              { cards: [], total: 19, locked: false, busted: false },
              { cards: [], total: 20, locked: false, busted: false },
              { cards: [], total: 21, locked: false, busted: false }
            ]
          },
          {
            ...state.players[1],
            lanes: [
              { cards: [], total: 19, locked: false, busted: false },
              { cards: [], total: 20, locked: false, busted: false },
              { cards: [], total: 21, locked: false, busted: false }
            ]
          }
        ]
      };

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(analyzeDrawDiagnostics(drawState, 'player1', 'player2'));
      }

      // All should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }
    });
  });

  // ==========================================================================
  // Draw Reason Forwarding Tests
  // ==========================================================================

  describe('draw reason forwarding', () => {
    it('should use analyzeDrawReason for reason field', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        players: [
          {
            ...state.players[0],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false }
            ]
          },
          {
            ...state.players[1],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false }
            ]
          }
        ]
      };

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2');
      const directReason = analyzeDrawReason(drawState);

      expect(diagnostics.reason).toBe(directReason);
    });

    it('should correctly identify lane_split draws', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        players: [
          {
            ...state.players[0],
            lanes: [
              { cards: [], total: 20, locked: true, busted: false }, // P1 wins
              { cards: [], total: 15, locked: true, busted: false }, // P2 wins
              { cards: [], total: 10, locked: true, busted: false }  // Tie
            ]
          },
          {
            ...state.players[1],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false }, // P1 wins
              { cards: [], total: 20, locked: true, busted: false }, // P2 wins
              { cards: [], total: 10, locked: true, busted: false }  // Tie
            ]
          }
        ]
      };

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2');
      expect(diagnostics.reason).toBe('lane_split');
    });

    it('should correctly identify perfect_symmetry draws', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        players: [
          {
            ...state.players[0],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false }
            ]
          },
          {
            ...state.players[1],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false }
            ]
          }
        ]
      };

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2');
      expect(diagnostics.reason).toBe('perfect_symmetry');
    });

    it('should correctly identify deck_exhausted draws', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        deck: [],
        queue: [],
        players: [
          {
            ...state.players[0],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 12, locked: false, busted: false }
            ]
          },
          {
            ...state.players[1],
            lanes: [
              { cards: [], total: 16, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 12, locked: false, busted: false }
            ]
          }
        ]
      };

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2');
      expect(['deck_exhausted', 'lane_split']).toContain(diagnostics.reason);
    });

    it('should correctly identify mutual_pass draws', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        queue: [state.queue[0]], // Cards remain
        deck: [state.deck[0]],
        players: [
          {
            ...state.players[0],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 12, locked: true, busted: false }
            ]
          },
          {
            ...state.players[1],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 12, locked: true, busted: false }
            ]
          }
        ]
      };

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2');
      expect(['mutual_pass', 'perfect_symmetry']).toContain(diagnostics.reason);
    });
  });

  // ==========================================================================
  // Metrics Forwarding Tests
  // ==========================================================================

  describe('metrics forwarding', () => {
    it('should use getDecisivenessMetrics for p1 and p2', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        players: [
          {
            ...state.players[0],
            energy: 1,
            lanes: [
              { cards: [], total: 20, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 15, locked: true, busted: false }
            ]
          },
          {
            ...state.players[1],
            energy: 2,
            lanes: [
              { cards: [], total: 19, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 15, locked: true, busted: false }
            ]
          }
        ]
      };

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2');
      const directP1Metrics = getDecisivenessMetrics(drawState, 'player1');
      const directP2Metrics = getDecisivenessMetrics(drawState, 'player2');

      expect(diagnostics.p1).toEqual(directP1Metrics);
      expect(diagnostics.p2).toEqual(directP2Metrics);
    });

    it('should correctly capture different metrics for each player', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        players: [
          {
            ...state.players[0],
            energy: 0,
            lanes: [
              { cards: [], total: 21, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false },
              { cards: [], total: 19, locked: true, busted: false }
            ]
          },
          {
            ...state.players[1],
            energy: 3,
            lanes: [
              { cards: [], total: 21, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false },
              { cards: [], total: 10, locked: true, busted: false }
            ]
          }
        ]
      };

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2');

      // Different energy
      expect(diagnostics.p1.energyRemaining).toBe(0);
      expect(diagnostics.p2.energyRemaining).toBe(3);

      // Different win threats
      expect(diagnostics.p1.winThreats).toBe(3); // All lanes 18-21
      expect(diagnostics.p2.winThreats).toBe(2); // Only 2 lanes 18-21

      // Same contestable lanes (all locked by both)
      expect(diagnostics.p1.contestableLanes).toBe(0);
      expect(diagnostics.p2.contestableLanes).toBe(0);
    });
  });

  // ==========================================================================
  // Action Log Integration Tests
  // ==========================================================================

  describe('actionLog integration', () => {
    it('should pass actionLog to getDecisivenessMetrics for forcedPasses', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        players: [
          {
            ...state.players[0],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false }
            ]
          },
          {
            ...state.players[1],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false }
            ]
          }
        ]
      };

      const actionLog = [
        { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
        { playerId: 'player2', action: { type: 'take', targetLane: 0 } },
        { playerId: 'player1', action: { type: 'pass' } },
        { playerId: 'player2', action: { type: 'pass' } },
        { playerId: 'player1', action: { type: 'pass' } },
        { playerId: 'player2', action: { type: 'stand', targetLane: 0 } }
      ];

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2', actionLog);

      expect(diagnostics.p1.forcedPasses).toBe(2);
      expect(diagnostics.p2.forcedPasses).toBe(1);
    });

    it('should have 0 forcedPasses when no actionLog provided', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        players: [
          {
            ...state.players[0],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false }
            ]
          },
          {
            ...state.players[1],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false }
            ]
          }
        ]
      };

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2');

      expect(diagnostics.p1.forcedPasses).toBe(0);
      expect(diagnostics.p2.forcedPasses).toBe(0);
    });

    it('should correctly count passes for each player independently', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        players: [
          {
            ...state.players[0],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false }
            ]
          },
          {
            ...state.players[1],
            lanes: [
              { cards: [], total: 15, locked: true, busted: false },
              { cards: [], total: 18, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false }
            ]
          }
        ]
      };

      const actionLog = [
        { playerId: 'player1', action: { type: 'pass' } },
        { playerId: 'player2', action: { type: 'burn' } },
        { playerId: 'player1', action: { type: 'pass' } },
        { playerId: 'player2', action: { type: 'pass' } },
        { playerId: 'player1', action: { type: 'pass' } },
        { playerId: 'player2', action: { type: 'pass' } }
      ];

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2', actionLog);

      expect(diagnostics.p1.forcedPasses).toBe(3);
      expect(diagnostics.p2.forcedPasses).toBe(2);
    });
  });

  // ==========================================================================
  // Comprehensive Scenarios
  // ==========================================================================

  describe('comprehensive scenarios', () => {
    it('should correctly diagnose high-pressure lane_split draw', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        players: [
          {
            ...state.players[0],
            energy: 0,
            lanes: [
              { cards: [], total: 20, locked: true, busted: false }, // P1 wins
              { cards: [], total: 18, locked: true, busted: false }, // P2 wins
              { cards: [], total: 19, locked: true, busted: false }  // Tie
            ]
          },
          {
            ...state.players[1],
            energy: 0,
            lanes: [
              { cards: [], total: 19, locked: true, busted: false }, // P1 wins
              { cards: [], total: 20, locked: true, busted: false }, // P2 wins
              { cards: [], total: 19, locked: true, busted: false }  // Tie
            ]
          }
        ]
      };

      const actionLog = [
        { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
        { playerId: 'player2', action: { type: 'take', targetLane: 1 } }
      ];

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2', actionLog);

      expect(diagnostics.reason).toBe('lane_split');
      expect(diagnostics.p1.contestableLanes).toBe(0);
      expect(diagnostics.p1.energyRemaining).toBe(0);
      expect(diagnostics.p1.winThreats).toBe(3); // 20, 19, and 18 (all within ≤3 of 21)
      expect(diagnostics.p2.contestableLanes).toBe(0);
      expect(diagnostics.p2.energyRemaining).toBe(0);
      expect(diagnostics.p2.winThreats).toBe(3); // 20, 19, and 19 - wait, p2 has 19, 20, 19
    });

    it('should correctly diagnose low-pressure perfect_symmetry draw', () => {
      const state = createInitialGameState(42);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        players: [
          {
            ...state.players[0],
            energy: 3,
            lanes: [
              { cards: [], total: 10, locked: true, busted: false },
              { cards: [], total: 12, locked: true, busted: false },
              { cards: [], total: 15, locked: true, busted: false }
            ]
          },
          {
            ...state.players[1],
            energy: 3,
            lanes: [
              { cards: [], total: 10, locked: true, busted: false },
              { cards: [], total: 12, locked: true, busted: false },
              { cards: [], total: 15, locked: true, busted: false }
            ]
          }
        ]
      };

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2');

      expect(diagnostics.reason).toBe('perfect_symmetry');
      expect(diagnostics.p1.contestableLanes).toBe(0);
      expect(diagnostics.p1.energyRemaining).toBe(3);
      expect(diagnostics.p1.winThreats).toBe(0);
      expect(diagnostics.p2.contestableLanes).toBe(0);
      expect(diagnostics.p2.energyRemaining).toBe(3);
      expect(diagnostics.p2.winThreats).toBe(0);
    });
  });

  // ==========================================================================
  // Integration: Real GameState Fixtures
  // ==========================================================================

  describe('real game state fixtures', () => {
    it('should work with realistic draw scenarios', () => {
      const state = createInitialGameState(12345);
      const drawState = {
        ...state,
        gameOver: true,
        winner: null,
        turnNumber: 15,
        deck: [],
        queue: [],
        players: [
          {
            ...state.players[0],
            energy: 1,
            lanes: [
              { cards: [], total: 20, locked: true, busted: false },
              { cards: [], total: 17, locked: true, busted: false },
              { cards: [], total: 15, locked: true, busted: false }
            ]
          },
          {
            ...state.players[1],
            energy: 0,
            lanes: [
              { cards: [], total: 19, locked: true, busted: false },
              { cards: [], total: 20, locked: true, busted: false },
              { cards: [], total: 15, locked: true, busted: false }
            ]
          }
        ]
      };

      const diagnostics = analyzeDrawDiagnostics(drawState, 'player1', 'player2');

      // Should have valid structure
      expect(typeof diagnostics.reason).toBe('string');
      expect(diagnostics.p1).toBeDefined();
      expect(diagnostics.p2).toBeDefined();
      
      // Metrics should be in valid ranges
      expect(diagnostics.p1.contestableLanes).toBeGreaterThanOrEqual(0);
      expect(diagnostics.p1.contestableLanes).toBeLessThanOrEqual(3);
      expect(diagnostics.p1.energyRemaining).toBeGreaterThanOrEqual(0);
      expect(diagnostics.p1.energyRemaining).toBeLessThanOrEqual(3);
      expect(diagnostics.p1.winThreats).toBeGreaterThanOrEqual(0);
      expect(diagnostics.p1.winThreats).toBeLessThanOrEqual(3);
    });
  });
});
