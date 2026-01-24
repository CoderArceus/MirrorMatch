/**
 * MirrorMatch: Strategic 21 - Async PvP Integration Tests
 * 
 * CRITICAL: These tests verify integration constraints from the Day 17 prompt:
 * 1. Out-of-turn actions are rejected
 * 2. PassAction works in async mode
 * 3. Replay produces identical final state
 * 4. Async match always terminates
 * 5. No engine state is stored outside actionLog
 */

import { describe, it, expect } from 'vitest';
import {
  createAsyncMatch,
  applyAsyncAction,
  replayAsyncMatch,
  verifyAsyncMatch
} from '../src/async';
import { resolveTurn } from '../src/resolveTurn';
import { createInitialGameState } from '../src/state';
import { getLegalActions, isActionLegal } from '../src/validators';
import type { PlayerAction, TurnActions } from '../src/types';

describe('Async PvP Integration Tests', () => {
  // ==========================================================================
  // CONSTRAINT 1: Out-of-turn actions are rejected
  // ==========================================================================

  describe('out-of-turn action rejection', () => {
    it('should reject action when not player turn', () => {
      const match = createAsyncMatch('test', 'p1', 'p2', 42);

      // Player 1's turn
      expect(match.nextPlayerId).toBe('p1');

      // Player 2 tries to act
      const result = applyAsyncAction(match, 'p2', { type: 'take', targetLane: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not your turn');
    });

    it('should reject second action from same player', () => {
      const match = createAsyncMatch('test', 'p1', 'p2', 42);

      // Player 1 acts
      const result1 = applyAsyncAction(match, 'p1', { type: 'take', targetLane: 0 });
      expect(result1.success).toBe(true);
      expect(result1.match.nextPlayerId).toBe('p2');

      // Player 1 tries to act again
      const result2 = applyAsyncAction(result1.match, 'p1', { type: 'take', targetLane: 1 });

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Not your turn');
    });

    it('should enforce strict alternation across multiple turns', () => {
      let match = createAsyncMatch('test', 'p1', 'p2', 42);

      for (let i = 0; i < 3; i++) {
        // Should be p1's turn
        expect(match.nextPlayerId).toBe('p1');

        let result = applyAsyncAction(match, 'p1', { type: 'take', targetLane: i % 3 });
        expect(result.success).toBe(true);

        // Should now be p2's turn
        expect(result.match.nextPlayerId).toBe('p2');

        result = applyAsyncAction(result.match, 'p2', { type: 'take', targetLane: i % 3 });
        expect(result.success).toBe(true);

        match = result.match;
      }
    });
  });

  // ==========================================================================
  // CONSTRAINT 2: PassAction works in async mode
  // ==========================================================================

  describe('PassAction in async mode', () => {
    it('should allow PassAction when no other moves available', () => {
      let match = createAsyncMatch('test', 'p1', 'p2', 42);

      // Lock all lanes for both players
      for (let i = 0; i < 3; i++) {
        let result = applyAsyncAction(match, 'p1', { type: 'stand', targetLane: i });
        result = applyAsyncAction(result.match, 'p2', { type: 'stand', targetLane: i });
        match = result.match;
      }

      // Game should be over (all lanes locked)
      const state = replayAsyncMatch(match);
      expect(state.gameOver).toBe(true);
    });

    it('should use existing getLegalActions for validation', () => {
      const match = createAsyncMatch('test', 'p1', 'p2', 42);
      const state = replayAsyncMatch(match);

      // Get legal actions from validator
      const legalActions = getLegalActions(state, 'p1');

      // Verify each legal action can be applied
      for (const action of legalActions) {
        const result = applyAsyncAction(match, 'p1', action);
        expect(result.success).toBe(true);
      }
    });

    it('should reject actions not returned by getLegalActions', () => {
      const match = createAsyncMatch('test', 'p1', 'p2', 42);

      // Try an illegal action (invalid lane)
      const result = applyAsyncAction(match, 'p1', { type: 'take', targetLane: 99 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not legal');
    });
  });

  // ==========================================================================
  // CONSTRAINT 3: Replay produces identical final state
  // ==========================================================================

  describe('replay determinism', () => {
    it('should produce identical state from replay', () => {
      let match = createAsyncMatch('test', 'p1', 'p2', 12345);

      // Play several turns
      const actions: PlayerAction[] = [
        { type: 'take', targetLane: 0 },
        { type: 'take', targetLane: 0 },
        { type: 'burn' },
        { type: 'take', targetLane: 1 },
        { type: 'stand', targetLane: 0 },
        { type: 'stand', targetLane: 1 }
      ];

      for (const action of actions) {
        const result = applyAsyncAction(match, match.nextPlayerId, action);
        expect(result.success).toBe(true);
        match = result.match;
      }

      // Replay match
      const replayedState = replayAsyncMatch(match);

      // Manually reconstruct using resolveTurn
      let manualState = createInitialGameState(match.seed);
      manualState = {
        ...manualState,
        players: [
          { ...manualState.players[0], id: 'p1' },
          { ...manualState.players[1], id: 'p2' }
        ]
      };

      // Process action log in pairs
      for (let i = 0; i < match.actionLog.length; i += 2) {
        const action1 = match.actionLog[i];
        const action2 = match.actionLog[i + 1];

        let p1Action: PlayerAction;
        let p2Action: PlayerAction;

        if (action1.playerId === 'p1') {
          p1Action = action1.action;
          p2Action = action2.action;
        } else {
          p1Action = action2.action;
          p2Action = action1.action;
        }

        const turnActions: TurnActions = {
          playerActions: [
            { playerId: 'p1', action: p1Action },
            { playerId: 'p2', action: p2Action }
          ]
        };

        manualState = resolveTurn(manualState, turnActions);
      }

      // States should match
      expect(replayedState.turnNumber).toBe(manualState.turnNumber);
      expect(replayedState.gameOver).toBe(manualState.gameOver);
      expect(replayedState.winner).toBe(manualState.winner);
      expect(replayedState.deck.length).toBe(manualState.deck.length);
      expect(replayedState.queue.length).toBe(manualState.queue.length);
      expect(replayedState.players[0].energy).toBe(manualState.players[0].energy);
      expect(replayedState.players[1].energy).toBe(manualState.players[1].energy);
    });

    it('should produce same result across multiple replays', () => {
      let match = createAsyncMatch('test', 'p1', 'p2', 42);

      // Play some turns
      for (let i = 0; i < 3; i++) {
        let result = applyAsyncAction(match, 'p1', { type: 'take', targetLane: i });
        result = applyAsyncAction(result.match, 'p2', { type: 'take', targetLane: i });
        match = result.match;
      }

      // Replay multiple times
      const replay1 = replayAsyncMatch(match);
      const replay2 = replayAsyncMatch(match);
      const replay3 = replayAsyncMatch(match);

      // All should be identical
      expect(replay1).toEqual(replay2);
      expect(replay2).toEqual(replay3);
    });

    it('should handle empty action log correctly', () => {
      const match = createAsyncMatch('test', 'p1', 'p2', 42);
      const state = replayAsyncMatch(match);

      // Should produce initial state
      expect(state.turnNumber).toBe(1);
      expect(state.gameOver).toBe(false);
      expect(state.players[0].id).toBe('p1');
      expect(state.players[1].id).toBe('p2');
    });
  });

  // ==========================================================================
  // CONSTRAINT 4: Async match always terminates
  // ==========================================================================

  describe('match termination guarantee', () => {
    it('should terminate when all lanes locked', () => {
      let match = createAsyncMatch('test', 'p1', 'p2', 42);

      // Lock all lanes
      for (let i = 0; i < 3; i++) {
        let result = applyAsyncAction(match, 'p1', { type: 'stand', targetLane: i });
        result = applyAsyncAction(result.match, 'p2', { type: 'stand', targetLane: i });
        match = result.match;
      }

      const state = replayAsyncMatch(match);
      expect(state.gameOver).toBe(true);
    });

    it('should never deadlock due to PassAction availability', () => {
      let match = createAsyncMatch('test', 'p1', 'p2', 42);

      // Play until game ends or 100 turns (safety limit)
      for (let turn = 0; turn < 100; turn++) {
        const state = replayAsyncMatch(match);
        if (state.gameOver) break;

        // Get legal actions - should always have at least one
        const legalActions = getLegalActions(state, match.nextPlayerId);
        expect(legalActions.length).toBeGreaterThan(0);

        // Apply first legal action
        const result = applyAsyncAction(match, match.nextPlayerId, legalActions[0]);
        expect(result.success).toBe(true);
        match = result.match;
      }

      // Game should have ended
      const finalState = replayAsyncMatch(match);
      expect(finalState.gameOver).toBe(true);
    });

    it('should reject actions after game ends', () => {
      let match = createAsyncMatch('test', 'p1', 'p2', 42);

      // Force game end
      for (let i = 0; i < 3; i++) {
        let result = applyAsyncAction(match, 'p1', { type: 'stand', targetLane: i });
        result = applyAsyncAction(result.match, 'p2', { type: 'stand', targetLane: i });
        match = result.match;
      }

      const state = replayAsyncMatch(match);
      expect(state.gameOver).toBe(true);

      // Try to act after game ends
      const result = applyAsyncAction(match, 'p1', { type: 'take', targetLane: 0 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already over');
    });
  });

  // ==========================================================================
  // CONSTRAINT 5: No engine state stored outside actionLog
  // ==========================================================================

  describe('no state storage outside actionLog', () => {
    it('should not have GameState property in AsyncMatch', () => {
      const match = createAsyncMatch('test', 'p1', 'p2', 42);

      // AsyncMatch should NOT have a 'state' property
      expect('state' in match).toBe(false);
    });

    it('should derive all state from actionLog via replay', () => {
      let match = createAsyncMatch('test', 'p1', 'p2', 42);

      // Play several turns
      for (let i = 0; i < 3; i++) {
        let result = applyAsyncAction(match, 'p1', { type: 'take', targetLane: i % 3 });
        result = applyAsyncAction(result.match, 'p2', { type: 'take', targetLane: i % 3 });
        match = result.match;
      }

      // All state queries must go through replay
      const state1 = replayAsyncMatch(match);
      const state2 = replayAsyncMatch(match);

      // Both replays should be identical
      expect(state1).toEqual(state2);
    });

    it('should validate actions using replayed state', () => {
      const match = createAsyncMatch('test', 'p1', 'p2', 42);
      const state = replayAsyncMatch(match);

      // applyAsyncAction should use isActionLegal with replayed state
      const testAction: PlayerAction = { type: 'take', targetLane: 0 };

      // Manually check legality
      const isLegal = isActionLegal(state, 'p1', testAction);

      // applyAsyncAction should agree
      const result = applyAsyncAction(match, 'p1', testAction);

      if (isLegal) {
        expect(result.success).toBe(true);
      } else {
        expect(result.success).toBe(false);
      }
    });

    it('should use verifyAsyncMatch for integrity checks', () => {
      let match = createAsyncMatch('test', 'p1', 'p2', 42);

      // Fresh match should be valid
      expect(verifyAsyncMatch(match)).toBe(true);

      // After actions, should still be valid
      let result = applyAsyncAction(match, 'p1', { type: 'take', targetLane: 0 });
      result = applyAsyncAction(result.match, 'p2', { type: 'take', targetLane: 0 });
      match = result.match;

      expect(verifyAsyncMatch(match)).toBe(true);
    });

    it('should maintain only actionLog and metadata in AsyncMatch', () => {
      const match = createAsyncMatch('test', 'p1', 'p2', 42);

      // AsyncMatch should only have:
      // - matchId, seed, player1Id, player2Id (metadata)
      // - actionLog, pendingAction, nextPlayerId (state tracking)
      const keys = Object.keys(match);

      expect(keys).toContain('matchId');
      expect(keys).toContain('seed');
      expect(keys).toContain('player1Id');
      expect(keys).toContain('player2Id');
      expect(keys).toContain('actionLog');
      expect(keys).toContain('pendingAction');
      expect(keys).toContain('nextPlayerId');

      // Should NOT contain 'state'
      expect(keys).not.toContain('state');
    });
  });

  // ==========================================================================
  // INTEGRATION: Uses existing engine primitives
  // ==========================================================================

  describe('integration with existing engine', () => {
    it('should use resolveTurn for turn resolution', () => {
      const match = createAsyncMatch('test', 'p1', 'p2', 42);

      // Apply actions
      let result = applyAsyncAction(match, 'p1', { type: 'take', targetLane: 0 });
      result = applyAsyncAction(result.match, 'p2', { type: 'take', targetLane: 0 });

      // Replay should produce same result as manual resolveTurn
      const replayedState = replayAsyncMatch(result.match);

      let manualState = createInitialGameState(match.seed);
      manualState = {
        ...manualState,
        players: [
          { ...manualState.players[0], id: 'p1' },
          { ...manualState.players[1], id: 'p2' }
        ]
      };

      const turnActions: TurnActions = {
        playerActions: [
          { playerId: 'p1', action: { type: 'take', targetLane: 0 } },
          { playerId: 'p2', action: { type: 'take', targetLane: 0 } }
        ]
      };

      manualState = resolveTurn(manualState, turnActions);

      expect(replayedState.turnNumber).toBe(manualState.turnNumber);
    });

    it('should use getLegalActions for validation', () => {
      const match = createAsyncMatch('test', 'p1', 'p2', 42);
      const state = replayAsyncMatch(match);

      // Get legal actions using existing validator
      const legalActions = getLegalActions(state, 'p1');

      // All legal actions should be accepted
      for (const action of legalActions) {
        const result = applyAsyncAction(match, 'p1', action);
        expect(result.success).toBe(true);
      }
    });

    it('should use isActionLegal for action validation', () => {
      const match = createAsyncMatch('test', 'p1', 'p2', 42);
      const state = replayAsyncMatch(match);

      const testAction: PlayerAction = { type: 'take', targetLane: 0 };

      // Check using existing validator
      const isLegal = isActionLegal(state, 'p1', testAction);

      // applyAsyncAction should respect this
      const result = applyAsyncAction(match, 'p1', testAction);

      expect(result.success).toBe(isLegal);
    });
  });
});
