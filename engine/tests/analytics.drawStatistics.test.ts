/**
 * Seque: Strategic 21 - Draw Statistics Tests
 * 
 * DAY 18 TASK 2.3: Tests for aggregateDrawStatistics
 * 
 * Tests that statistics correctly:
 * - Handle empty input
 * - Count draw reasons
 * - Average metrics across players and draws
 * - Are order-independent
 * - Work with realistic fixtures
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateDrawStatistics,
  type DrawDiagnostics,
  type DrawStatistics
} from '../src/index';

describe('Draw Statistics Aggregation (Day 18 Task 2.3)', () => {
  // ==========================================================================
  // Basic Structure Tests
  // ==========================================================================

  describe('interface and exports', () => {
    it('should export aggregateDrawStatistics function', () => {
      expect(typeof aggregateDrawStatistics).toBe('function');
    });

    it('should return DrawStatistics with correct structure', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 1, forcedPasses: 0, winThreats: 2 },
          p2: { contestableLanes: 0, energyRemaining: 2, forcedPasses: 1, winThreats: 3 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      expect(stats).toHaveProperty('totalDraws');
      expect(stats).toHaveProperty('byReason');
      expect(stats).toHaveProperty('avgContestableLanes');
      expect(stats).toHaveProperty('avgEnergyRemaining');
      expect(stats).toHaveProperty('avgForcedPasses');
      expect(stats).toHaveProperty('avgWinThreats');
    });

    it('should have all DrawReason keys in byReason', () => {
      const stats = aggregateDrawStatistics([]);

      expect(stats.byReason).toHaveProperty('mutual_pass');
      expect(stats.byReason).toHaveProperty('lane_split');
      expect(stats.byReason).toHaveProperty('deck_exhausted');
      expect(stats.byReason).toHaveProperty('stall_equilibrium');
      expect(stats.byReason).toHaveProperty('perfect_symmetry');
      expect(stats.byReason).toHaveProperty('energy_exhaustion');
      expect(stats.byReason).toHaveProperty('mutual_perfection');
      expect(stats.byReason).toHaveProperty('stall_lock');
      expect(stats.byReason).toHaveProperty('equal_lanes');
      expect(stats.byReason).toHaveProperty('tiebreaker_equal');
    });
  });

  // ==========================================================================
  // Empty Input Tests
  // ==========================================================================

  describe('empty input', () => {
    it('should return all zeros for empty array', () => {
      const stats = aggregateDrawStatistics([]);

      expect(stats.totalDraws).toBe(0);
      expect(stats.avgContestableLanes).toBe(0);
      expect(stats.avgEnergyRemaining).toBe(0);
      expect(stats.avgForcedPasses).toBe(0);
      expect(stats.avgWinThreats).toBe(0);
    });

    it('should have zero count for all reasons when empty', () => {
      const stats = aggregateDrawStatistics([]);

      expect(stats.byReason.mutual_pass).toBe(0);
      expect(stats.byReason.lane_split).toBe(0);
      expect(stats.byReason.deck_exhausted).toBe(0);
      expect(stats.byReason.stall_equilibrium).toBe(0);
      expect(stats.byReason.perfect_symmetry).toBe(0);
      expect(stats.byReason.energy_exhaustion).toBe(0);
      expect(stats.byReason.mutual_perfection).toBe(0);
      expect(stats.byReason.stall_lock).toBe(0);
      expect(stats.byReason.equal_lanes).toBe(0);
      expect(stats.byReason.tiebreaker_equal).toBe(0);
    });
  });

  // ==========================================================================
  // Single Draw Tests
  // ==========================================================================

  describe('single draw', () => {
    it('should correctly calculate averages for one draw', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 2, forcedPasses: 1, winThreats: 3 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 3, winThreats: 1 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      expect(stats.totalDraws).toBe(1);
      expect(stats.byReason.lane_split).toBe(1);
      
      // Average p1 and p2 for each metric
      expect(stats.avgContestableLanes).toBe((0 + 0) / 2); // 0
      expect(stats.avgEnergyRemaining).toBe((2 + 0) / 2); // 1
      expect(stats.avgForcedPasses).toBe((1 + 3) / 2); // 2
      expect(stats.avgWinThreats).toBe((3 + 1) / 2); // 2
    });

    it('should count only the single reason type', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'perfect_symmetry',
          p1: { contestableLanes: 0, energyRemaining: 3, forcedPasses: 0, winThreats: 0 },
          p2: { contestableLanes: 0, energyRemaining: 3, forcedPasses: 0, winThreats: 0 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      expect(stats.totalDraws).toBe(1);
      expect(stats.byReason.perfect_symmetry).toBe(1);
      expect(stats.byReason.lane_split).toBe(0);
      expect(stats.byReason.mutual_pass).toBe(0);
    });
  });

  // ==========================================================================
  // Draw Reason Counting Tests
  // ==========================================================================

  describe('draw reason counting', () => {
    it('should count multiple draws with same reason', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 2 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 2 }
        },
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 1, forcedPasses: 0, winThreats: 3 },
          p2: { contestableLanes: 0, energyRemaining: 1, forcedPasses: 0, winThreats: 1 }
        },
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 2, forcedPasses: 1, winThreats: 2 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 2, winThreats: 2 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      expect(stats.totalDraws).toBe(3);
      expect(stats.byReason.lane_split).toBe(3);
      expect(stats.byReason.perfect_symmetry).toBe(0);
    });

    it('should count multiple different draw reasons', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 2 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 2 }
        },
        {
          reason: 'perfect_symmetry',
          p1: { contestableLanes: 0, energyRemaining: 3, forcedPasses: 0, winThreats: 0 },
          p2: { contestableLanes: 0, energyRemaining: 3, forcedPasses: 0, winThreats: 0 }
        },
        {
          reason: 'mutual_pass',
          p1: { contestableLanes: 0, energyRemaining: 1, forcedPasses: 2, winThreats: 1 },
          p2: { contestableLanes: 0, energyRemaining: 2, forcedPasses: 2, winThreats: 1 }
        },
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 3 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 1 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      expect(stats.totalDraws).toBe(4);
      expect(stats.byReason.lane_split).toBe(2);
      expect(stats.byReason.perfect_symmetry).toBe(1);
      expect(stats.byReason.mutual_pass).toBe(1);
      expect(stats.byReason.deck_exhausted).toBe(0);
    });

    it('should correctly count all draw reason types', () => {
      const diagnostics: DrawDiagnostics[] = [
        { reason: 'mutual_pass', p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 }, p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 } },
        { reason: 'lane_split', p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 }, p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 } },
        { reason: 'deck_exhausted', p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 }, p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 } },
        { reason: 'stall_equilibrium', p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 }, p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 } },
        { reason: 'perfect_symmetry', p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 }, p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 } }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      expect(stats.byReason.mutual_pass).toBe(1);
      expect(stats.byReason.lane_split).toBe(1);
      expect(stats.byReason.deck_exhausted).toBe(1);
      expect(stats.byReason.stall_equilibrium).toBe(1);
      expect(stats.byReason.perfect_symmetry).toBe(1);
    });
  });

  // ==========================================================================
  // Metrics Averaging Tests
  // ==========================================================================

  describe('metrics averaging', () => {
    it('should average contestable lanes correctly', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'lane_split',
          p1: { contestableLanes: 2, energyRemaining: 0, forcedPasses: 0, winThreats: 0 },
          p2: { contestableLanes: 2, energyRemaining: 0, forcedPasses: 0, winThreats: 0 }
        },
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      // Draw 1: (2+2)/2 = 2
      // Draw 2: (0+0)/2 = 0
      // Average: (2+0)/2 = 1
      expect(stats.avgContestableLanes).toBe(1);
    });

    it('should average energy remaining correctly', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 3, forcedPasses: 0, winThreats: 0 },
          p2: { contestableLanes: 0, energyRemaining: 1, forcedPasses: 0, winThreats: 0 }
        },
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 },
          p2: { contestableLanes: 0, energyRemaining: 2, forcedPasses: 0, winThreats: 0 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      // Draw 1: (3+1)/2 = 2
      // Draw 2: (0+2)/2 = 1
      // Average: (2+1)/2 = 1.5
      expect(stats.avgEnergyRemaining).toBe(1.5);
    });

    it('should average forced passes correctly', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'mutual_pass',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 4, winThreats: 0 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 2, winThreats: 0 }
        },
        {
          reason: 'mutual_pass',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      // Draw 1: (4+2)/2 = 3
      // Draw 2: (0+0)/2 = 0
      // Average: (3+0)/2 = 1.5
      expect(stats.avgForcedPasses).toBe(1.5);
    });

    it('should average win threats correctly', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 3 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 1 }
        },
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 2 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 2 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      // Draw 1: (3+1)/2 = 2
      // Draw 2: (2+2)/2 = 2
      // Average: (2+2)/2 = 2
      expect(stats.avgWinThreats).toBe(2);
    });

    it('should average all metrics together correctly', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'lane_split',
          p1: { contestableLanes: 1, energyRemaining: 2, forcedPasses: 0, winThreats: 3 },
          p2: { contestableLanes: 1, energyRemaining: 0, forcedPasses: 2, winThreats: 1 }
        },
        {
          reason: 'perfect_symmetry',
          p1: { contestableLanes: 0, energyRemaining: 3, forcedPasses: 0, winThreats: 0 },
          p2: { contestableLanes: 0, energyRemaining: 3, forcedPasses: 0, winThreats: 0 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      // avgContestableLanes: ((1+1)/2 + (0+0)/2) / 2 = (1 + 0) / 2 = 0.5
      expect(stats.avgContestableLanes).toBe(0.5);
      
      // avgEnergyRemaining: ((2+0)/2 + (3+3)/2) / 2 = (1 + 3) / 2 = 2
      expect(stats.avgEnergyRemaining).toBe(2);
      
      // avgForcedPasses: ((0+2)/2 + (0+0)/2) / 2 = (1 + 0) / 2 = 0.5
      expect(stats.avgForcedPasses).toBe(0.5);
      
      // avgWinThreats: ((3+1)/2 + (0+0)/2) / 2 = (2 + 0) / 2 = 1
      expect(stats.avgWinThreats).toBe(1);
    });
  });

  // ==========================================================================
  // Order Independence Tests
  // ==========================================================================

  describe('order independence', () => {
    it('should produce same results regardless of input order', () => {
      const diag1: DrawDiagnostics = {
        reason: 'lane_split',
        p1: { contestableLanes: 0, energyRemaining: 1, forcedPasses: 0, winThreats: 2 },
        p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 1, winThreats: 3 }
      };
      const diag2: DrawDiagnostics = {
        reason: 'perfect_symmetry',
        p1: { contestableLanes: 0, energyRemaining: 3, forcedPasses: 0, winThreats: 0 },
        p2: { contestableLanes: 0, energyRemaining: 3, forcedPasses: 0, winThreats: 0 }
      };
      const diag3: DrawDiagnostics = {
        reason: 'mutual_pass',
        p1: { contestableLanes: 1, energyRemaining: 2, forcedPasses: 2, winThreats: 1 },
        p2: { contestableLanes: 1, energyRemaining: 1, forcedPasses: 3, winThreats: 1 }
      };

      const stats1 = aggregateDrawStatistics([diag1, diag2, diag3]);
      const stats2 = aggregateDrawStatistics([diag3, diag1, diag2]);
      const stats3 = aggregateDrawStatistics([diag2, diag3, diag1]);

      expect(stats1).toEqual(stats2);
      expect(stats2).toEqual(stats3);
    });

    it('should handle shuffled large datasets consistently', () => {
      const diagnostics: DrawDiagnostics[] = [];
      for (let i = 0; i < 20; i++) {
        diagnostics.push({
          reason: i % 2 === 0 ? 'lane_split' : 'perfect_symmetry',
          p1: { contestableLanes: i % 3, energyRemaining: i % 4, forcedPasses: i % 2, winThreats: i % 3 },
          p2: { contestableLanes: (i + 1) % 3, energyRemaining: (i + 1) % 4, forcedPasses: (i + 1) % 2, winThreats: (i + 1) % 3 }
        });
      }

      const stats1 = aggregateDrawStatistics(diagnostics);
      const shuffled = [...diagnostics].reverse();
      const stats2 = aggregateDrawStatistics(shuffled);

      expect(stats1).toEqual(stats2);
    });
  });

  // ==========================================================================
  // Realistic Fixtures
  // ==========================================================================

  describe('realistic fixtures', () => {
    it('should handle realistic draw diagnostics', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 3 },
          p2: { contestableLanes: 0, energyRemaining: 1, forcedPasses: 0, winThreats: 2 }
        },
        {
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 1, winThreats: 2 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 3 }
        },
        {
          reason: 'perfect_symmetry',
          p1: { contestableLanes: 0, energyRemaining: 2, forcedPasses: 0, winThreats: 2 },
          p2: { contestableLanes: 0, energyRemaining: 2, forcedPasses: 0, winThreats: 2 }
        },
        {
          reason: 'mutual_pass',
          p1: { contestableLanes: 0, energyRemaining: 1, forcedPasses: 3, winThreats: 1 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 4, winThreats: 1 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      expect(stats.totalDraws).toBe(4);
      expect(stats.byReason.lane_split).toBe(2);
      expect(stats.byReason.perfect_symmetry).toBe(1);
      expect(stats.byReason.mutual_pass).toBe(1);

      // All metrics should be in valid ranges
      expect(stats.avgContestableLanes).toBeGreaterThanOrEqual(0);
      expect(stats.avgContestableLanes).toBeLessThanOrEqual(3);
      expect(stats.avgEnergyRemaining).toBeGreaterThanOrEqual(0);
      expect(stats.avgEnergyRemaining).toBeLessThanOrEqual(3);
      expect(stats.avgWinThreats).toBeGreaterThanOrEqual(0);
      expect(stats.avgWinThreats).toBeLessThanOrEqual(3);
    });

    it('should provide meaningful aggregation for balance analysis', () => {
      // Simulate 10 high-pressure draws
      const diagnostics: DrawDiagnostics[] = [];
      for (let i = 0; i < 10; i++) {
        diagnostics.push({
          reason: 'lane_split',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 3 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 2 }
        });
      }

      const stats = aggregateDrawStatistics(diagnostics);

      expect(stats.totalDraws).toBe(10);
      expect(stats.byReason.lane_split).toBe(10);
      expect(stats.avgEnergyRemaining).toBe(0); // All energy spent = high pressure
      expect(stats.avgWinThreats).toBe(2.5); // High win threats = high pressure
      expect(stats.avgContestableLanes).toBe(0); // All locked = decisive
    });

    it('should distinguish low-pressure draws', () => {
      // Simulate 5 low-pressure draws
      const diagnostics: DrawDiagnostics[] = [];
      for (let i = 0; i < 5; i++) {
        diagnostics.push({
          reason: 'perfect_symmetry',
          p1: { contestableLanes: 2, energyRemaining: 3, forcedPasses: 0, winThreats: 0 },
          p2: { contestableLanes: 2, energyRemaining: 3, forcedPasses: 0, winThreats: 0 }
        });
      }

      const stats = aggregateDrawStatistics(diagnostics);

      expect(stats.totalDraws).toBe(5);
      expect(stats.byReason.perfect_symmetry).toBe(5);
      expect(stats.avgEnergyRemaining).toBe(3); // Full energy = low pressure
      expect(stats.avgWinThreats).toBe(0); // No threats = low pressure
      expect(stats.avgContestableLanes).toBe(2); // Many open = less decisive
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle all metrics at zero', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'stall_equilibrium',
          p1: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 0, winThreats: 0 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      expect(stats.avgContestableLanes).toBe(0);
      expect(stats.avgEnergyRemaining).toBe(0);
      expect(stats.avgForcedPasses).toBe(0);
      expect(stats.avgWinThreats).toBe(0);
    });

    it('should handle all metrics at maximum', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'deck_exhausted',
          p1: { contestableLanes: 3, energyRemaining: 3, forcedPasses: 10, winThreats: 3 },
          p2: { contestableLanes: 3, energyRemaining: 3, forcedPasses: 10, winThreats: 3 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      expect(stats.avgContestableLanes).toBe(3);
      expect(stats.avgEnergyRemaining).toBe(3);
      expect(stats.avgForcedPasses).toBe(10);
      expect(stats.avgWinThreats).toBe(3);
    });

    it('should handle asymmetric player metrics', () => {
      const diagnostics: DrawDiagnostics[] = [
        {
          reason: 'lane_split',
          p1: { contestableLanes: 3, energyRemaining: 3, forcedPasses: 0, winThreats: 3 },
          p2: { contestableLanes: 0, energyRemaining: 0, forcedPasses: 5, winThreats: 0 }
        }
      ];

      const stats = aggregateDrawStatistics(diagnostics);

      // Should average p1 and p2
      expect(stats.avgContestableLanes).toBe(1.5);
      expect(stats.avgEnergyRemaining).toBe(1.5);
      expect(stats.avgForcedPasses).toBe(2.5);
      expect(stats.avgWinThreats).toBe(1.5);
    });
  });
});
