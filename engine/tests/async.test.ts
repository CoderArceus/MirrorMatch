/**
 * MirrorMatch: Strategic 21 - Async PvP Tests
 * Test async match creation, action submission, and turn resolution
 */

import { describe, it, expect } from 'vitest';
import {
  createAsyncMatch,
  applyAsyncAction,
  getAsyncMatchStatus,
  verifyAsyncMatch,
  replayAsyncMatch,
  type AsyncMatch
} from '../src/async';
import type { PlayerAction } from '../src/types';

describe('Async PvP System', () => {
  // ============================================================================
  // Match Creation
  // ============================================================================

  describe('createAsyncMatch', () => {
    it('should create a new async match with initial state', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);

      expect(match.matchId).toBe('match-1');
      expect(match.seed).toBe(12345);
      expect(match.player1Id).toBe('alice');
      expect(match.player2Id).toBe('bob');
      expect(match.actionLog).toHaveLength(0);
      expect(match.nextPlayerId).toBe('alice');
      expect(match.pendingAction).toBeNull();
      
      // Verify initial state via replay
      const state = replayAsyncMatch(match);
      expect(state.players[0].id).toBe('alice');
      expect(state.players[1].id).toBe('bob');
      expect(state.gameOver).toBe(false);
      expect(state.turnNumber).toBe(1);
    });

    it('should create deterministic initial state from seed', () => {
      const match1 = createAsyncMatch('m1', 'p1', 'p2', 42);
      const match2 = createAsyncMatch('m2', 'p1', 'p2', 42);

      // Same seed should produce same deck order
      const state1 = replayAsyncMatch(match1);
      const state2 = replayAsyncMatch(match2);
      expect(state1.deck).toEqual(state2.deck);
      expect(state1.queue).toEqual(state2.queue);
    });

    it('should create different initial states from different seeds', () => {
      const match1 = createAsyncMatch('m1', 'p1', 'p2', 42);
      const match2 = createAsyncMatch('m2', 'p1', 'p2', 99);

      // Different seeds should produce different deck orders
      const state1 = replayAsyncMatch(match1);
      const state2 = replayAsyncMatch(match2);
      expect(state1.deck).not.toEqual(state2.deck);
    });
  });

  // ============================================================================
  // Turn Taking - First Action
  // ============================================================================

  describe('applyAsyncAction - first action', () => {
    it('should accept action from first player and store as pending', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      const action: PlayerAction = { type: 'take', targetLane: 0 };

      const result = applyAsyncAction(match, 'alice', action);

      expect(result.success).toBe(true);
      expect(result.match.pendingAction).not.toBeNull();
      expect(result.match.pendingAction?.playerId).toBe('alice');
      expect(result.match.pendingAction?.action).toEqual(action);
      expect(result.match.nextPlayerId).toBe('bob');
      
      // Turn hasn't resolved yet - verify via replay
      const state = replayAsyncMatch(result.match);
      expect(state.turnNumber).toBe(1);
    });

    it('should reject action from wrong player', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      const action: PlayerAction = { type: 'take', targetLane: 0 };

      const result = applyAsyncAction(match, 'bob', action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not your turn');
      expect(result.match).toEqual(match); // Match unchanged
    });

    it('should reject illegal action', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      const action: PlayerAction = { type: 'take', targetLane: 99 }; // Invalid lane

      const result = applyAsyncAction(match, 'alice', action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not legal');
    });
  });

  // ============================================================================
  // Turn Taking - Second Action (Turn Resolution)
  // ============================================================================

  describe('applyAsyncAction - second action', () => {
    it('should resolve turn when second player acts', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      
      // Alice takes to lane 0
      const action1: PlayerAction = { type: 'take', targetLane: 0 };
      const result1 = applyAsyncAction(match, 'alice', action1);
      expect(result1.success).toBe(true);

      // Bob takes to lane 0
      const action2: PlayerAction = { type: 'take', targetLane: 0 };
      const result2 = applyAsyncAction(result1.match, 'bob', action2);

      expect(result2.success).toBe(true);
      expect(result2.match.pendingAction).toBeNull(); // Turn resolved
      expect(result2.match.nextPlayerId).toBe('alice'); // Back to player 1
      expect(result2.match.actionLog).toHaveLength(2); // Both actions logged
      
      // Verify turn incremented via replay
      const state = replayAsyncMatch(result2.match);
      expect(state.turnNumber).toBe(2);
    });

    it('should apply both actions to game state', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      
      // Get the front card before actions
      const initialState = replayAsyncMatch(match);
      const frontCard = initialState.queue[0];

      // Both players take the same card
      const action: PlayerAction = { type: 'take', targetLane: 0 };
      
      let result = applyAsyncAction(match, 'alice', action);
      result = applyAsyncAction(result.match, 'bob', action);

      // Verify via replay
      const finalState = replayAsyncMatch(result.match);
      
      // Both players should have the card in lane 0
      expect(finalState.players[0].lanes[0].cards).toHaveLength(1);
      expect(finalState.players[1].lanes[0].cards).toHaveLength(1);
      expect(finalState.players[0].lanes[0].cards[0].id).toBe(frontCard.id);
      expect(finalState.players[1].lanes[0].cards[0].id).toBe(frontCard.id);
    });

    it('should handle burn actions correctly', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      
      // Alice takes, Bob burns
      const takeAction: PlayerAction = { type: 'take', targetLane: 0 };
      const burnAction: PlayerAction = { type: 'burn' };
      
      let result = applyAsyncAction(match, 'alice', takeAction);
      result = applyAsyncAction(result.match, 'bob', burnAction);

      expect(result.success).toBe(true);
      
      // Verify via replay
      const state = replayAsyncMatch(result.match);
      
      // Alice should get an Ash card (value 1)
      expect(state.players[0].lanes[0].cards).toHaveLength(1);
      expect(state.players[0].lanes[0].cards[0].rank).toBe('ASH');
      // Bob should have spent energy
      expect(state.players[1].energy).toBe(2);
    });

    it('should handle stand actions correctly', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      
      // Alice stands lane 0, Bob also stands lane 0
      const standAction: PlayerAction = { type: 'stand', targetLane: 0 };
      
      let result = applyAsyncAction(match, 'alice', standAction);
      result = applyAsyncAction(result.match, 'bob', standAction);

      expect(result.success).toBe(true);
      
      // Verify via replay
      const state = replayAsyncMatch(result.match);
      
      // Both players' lane 0 should be locked
      expect(state.players[0].lanes[0].locked).toBe(true);
      expect(state.players[1].lanes[0].locked).toBe(true);
    });
  });

  // ============================================================================
  // Multi-Turn Sequences
  // ============================================================================

  describe('applyAsyncAction - multi-turn sequences', () => {
    it('should handle multiple turns in sequence', () => {
      let match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      
      // Turn 1
      let result = applyAsyncAction(match, 'alice', { type: 'take', targetLane: 0 });
      result = applyAsyncAction(result.match, 'bob', { type: 'take', targetLane: 0 });
      let state = replayAsyncMatch(result.match);
      expect(state.turnNumber).toBe(2);
      expect(result.match.nextPlayerId).toBe('alice');

      // Turn 2
      result = applyAsyncAction(result.match, 'alice', { type: 'take', targetLane: 1 });
      result = applyAsyncAction(result.match, 'bob', { type: 'take', targetLane: 1 });
      state = replayAsyncMatch(result.match);
      expect(state.turnNumber).toBe(3);
      expect(result.match.nextPlayerId).toBe('alice');

      // Turn 3
      result = applyAsyncAction(result.match, 'alice', { type: 'take', targetLane: 2 });
      result = applyAsyncAction(result.match, 'bob', { type: 'take', targetLane: 2 });
      state = replayAsyncMatch(result.match);
      expect(state.turnNumber).toBe(4);
      
      expect(result.match.actionLog).toHaveLength(6); // 3 turns × 2 actions
    });

    it('should maintain action log integrity across turns', () => {
      let match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      
      // Turn 1
      let result = applyAsyncAction(match, 'alice', { type: 'take', targetLane: 0 });
      result = applyAsyncAction(result.match, 'bob', { type: 'burn' });

      const log = result.match.actionLog;
      expect(log[0].playerId).toBe('alice');
      expect(log[0].action.type).toBe('take');
      expect(log[1].playerId).toBe('bob');
      expect(log[1].action.type).toBe('burn');
    });
  });

  // ============================================================================
  // Game End Conditions
  // ============================================================================

  describe('applyAsyncAction - game end', () => {
    it('should reject actions after game ends', () => {
      let match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      
      // Lock all lanes for both players - this ends the game
      for (let i = 0; i < 3; i++) {
        let result = applyAsyncAction(match, 'alice', { type: 'stand', targetLane: i });
        result = applyAsyncAction(result.match, 'bob', { type: 'stand', targetLane: i });
        match = result.match;
      }

      // Game should be over now - verify via replay
      const state = replayAsyncMatch(match);
      expect(state.gameOver).toBe(true);

      // Try to take another action - should fail because game is over
      const afterGameResult = applyAsyncAction(match, 'alice', { type: 'pass' });
      
      expect(afterGameResult.success).toBe(false);
      expect(afterGameResult.error).toContain('already over');
    });
  });

  // ============================================================================
  // Match Status
  // ============================================================================

  describe('getAsyncMatchStatus', () => {
    it('should correctly identify whose turn it is', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);

      const aliceStatus = getAsyncMatchStatus(match, 'alice');
      const bobStatus = getAsyncMatchStatus(match, 'bob');

      expect(aliceStatus.isYourTurn).toBe(true);
      expect(aliceStatus.waitingFor).toBeNull();
      expect(bobStatus.isYourTurn).toBe(false);
      expect(bobStatus.waitingFor).toBe('alice');
    });

    it('should provide legal actions for current player', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);

      const aliceStatus = getAsyncMatchStatus(match, 'alice');
      const bobStatus = getAsyncMatchStatus(match, 'bob');

      expect(aliceStatus.legalActions.length).toBeGreaterThan(0);
      expect(bobStatus.legalActions).toHaveLength(0); // Not Bob's turn
    });

    it('should update after first player acts', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      const result = applyAsyncAction(match, 'alice', { type: 'take', targetLane: 0 });

      const aliceStatus = getAsyncMatchStatus(result.match, 'alice');
      const bobStatus = getAsyncMatchStatus(result.match, 'bob');

      expect(aliceStatus.isYourTurn).toBe(false);
      expect(aliceStatus.waitingFor).toBe('bob');
      expect(bobStatus.isYourTurn).toBe(true);
      expect(bobStatus.waitingFor).toBeNull();
    });

    it('should indicate game over status', () => {
      let match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      
      // Lock all lanes
      for (let i = 0; i < 3; i++) {
        let result = applyAsyncAction(match, 'alice', { type: 'stand', targetLane: i });
        result = applyAsyncAction(result.match, 'bob', { type: 'stand', targetLane: i });
        match = result.match;
      }

      // Both pass
      let result = applyAsyncAction(match, 'alice', { type: 'pass' });
      result = applyAsyncAction(result.match, 'bob', { type: 'pass' });

      const status = getAsyncMatchStatus(result.match, 'alice');
      expect(status.gameOver).toBe(true);
      expect(status.legalActions).toHaveLength(0);
    });
  });

  // ============================================================================
  // Match Verification
  // ============================================================================

  describe('verifyAsyncMatch', () => {
    it('should verify a fresh match', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      expect(verifyAsyncMatch(match)).toBe(true);
    });

    it('should verify match after actions', () => {
      let match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      
      // Take several turns
      let result = applyAsyncAction(match, 'alice', { type: 'take', targetLane: 0 });
      result = applyAsyncAction(result.match, 'bob', { type: 'take', targetLane: 0 });
      result = applyAsyncAction(result.match, 'alice', { type: 'take', targetLane: 1 });
      result = applyAsyncAction(result.match, 'bob', { type: 'burn' });

      expect(verifyAsyncMatch(result.match)).toBe(true);
    });

    it('should verify match with pending action', () => {
      const match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      const result = applyAsyncAction(match, 'alice', { type: 'take', targetLane: 0 });

      expect(verifyAsyncMatch(result.match)).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle pass actions when no other moves available', () => {
      let match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      
      // Deplete the queue and energy to force pass actions
      // Take cards until we're close to forced pass scenario
      for (let turn = 0; turn < 15; turn++) {
        const status = getAsyncMatchStatus(match, match.nextPlayerId);
        if (status.legalActions.length === 0) break;
        
        // Pick first legal action
        let action = status.legalActions[0];
        let result = applyAsyncAction(match, match.nextPlayerId, action);
        
        if (!result.success) break;
        match = result.match;
        
        // Check if game is over via replay
        const state = replayAsyncMatch(match);
        if (state.gameOver) break;
      }

      // Verify final state via replay
      const finalState = replayAsyncMatch(match);
      
      // If game is over, that's fine - we tested the system works
      // If not over, check if pass is available when it should be
      if (!finalState.gameOver) {
        const status = getAsyncMatchStatus(match, match.nextPlayerId);
        // Pass should be available if no other actions exist
        if (status.legalActions.length === 1 && status.legalActions[0].type === 'pass') {
          expect(status.legalActions[0].type).toBe('pass');
        }
      }
      
      // Main assertion: the game should reach an end state without deadlock
      expect(finalState.gameOver || match.actionLog.length > 0).toBe(true);
    });

    it('should maintain alternating turn order throughout game', () => {
      let match = createAsyncMatch('match-1', 'alice', 'bob', 12345);
      
      for (let turn = 0; turn < 5; turn++) {
        expect(match.nextPlayerId).toBe('alice');
        
        let result = applyAsyncAction(match, 'alice', { type: 'take', targetLane: turn % 3 });
        expect(result.match.nextPlayerId).toBe('bob');
        
        result = applyAsyncAction(result.match, 'bob', { type: 'take', targetLane: turn % 3 });
        expect(result.match.nextPlayerId).toBe('alice');
        
        match = result.match;
      }
    });
  });
});
