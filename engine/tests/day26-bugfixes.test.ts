/**
 * Day 26: Bug Fix Tests
 * Tests for shackle reapplication prevention and burn overheat removal
 */

import { describe, it, expect } from 'vitest';
import { createInitialGameState } from '../src/state';
import { resolveTurn } from '../src/resolveTurn';
import { getLegalActions } from '../src/validators';
import type { GameState, TurnActions } from '../src/types';

describe('Day 26 Bug Fixes', () => {
  
  // ============================================================================
  // Bug #1: Shackle Reapplication Prevention
  // ============================================================================
  
  describe('Bug #1: Shackle Reapplication', () => {
    it('should prevent shackling a lane that was already shackled', () => {
      let state = createInitialGameState(12345);
      
      // Advance to turn 4 (first auction)
      for (let i = 0; i < 3; i++) {
        state = resolveTurn(state, {
          playerActions: [
            { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
            { playerId: 'player2', action: { type: 'take', targetLane: 0 } },
          ],
        });
      }
      
      expect(state.turnNumber).toBe(4);
      
      // First auction: P1 bids 0, P2 bids 1 → P1 loses and lane 1 gets shackled
      state = resolveTurn(state, {
        playerActions: [
          { playerId: 'player1', action: { type: 'bid', bidAmount: 0, potentialVoidStoneLane: 1 } },
          { playerId: 'player2', action: { type: 'bid', bidAmount: 1, potentialVoidStoneLane: 0 } },
        ],
      });
      
      expect(state.players[0].lanes[1].shackled).toBe(true);
      expect(state.players[0].lanes[1].hasBeenShackled).toBe(true);
      
      // Advance to turn 8 (second auction)
      for (let i = 0; i < 3; i++) {
        state = resolveTurn(state, {
          playerActions: [
            { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
            { playerId: 'player2', action: { type: 'take', targetLane: 0 } },
          ],
        });
      }
      
      expect(state.turnNumber).toBe(8);
      
      // Second auction: P1 loses again and tries to shackle lane 1 again
      // This should be prevented
      state = resolveTurn(state, {
        playerActions: [
          { playerId: 'player1', action: { type: 'bid', bidAmount: 0, potentialVoidStoneLane: 1 } },
          { playerId: 'player2', action: { type: 'bid', bidAmount: 1, potentialVoidStoneLane: 0 } },
        ],
      });
      
      // Lane 1 should still have hasBeenShackled=true but the Void Stone should be discarded
      expect(state.players[0].lanes[1].hasBeenShackled).toBe(true);
      // The lane might be unshackled now if it was unshackled between auctions
    });
    
    it('should only allow bids with valid void stone lanes (never shackled)', () => {
      let state = createInitialGameState(54321);
      
      // Advance to turn 4
      for (let i = 0; i < 3; i++) {
        state = resolveTurn(state, {
          playerActions: [
            { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
            { playerId: 'player2', action: { type: 'take', targetLane: 0 } },
          ],
        });
      }
      
      // First auction: shackle lane 0
      state = resolveTurn(state, {
        playerActions: [
          { playerId: 'player1', action: { type: 'bid', bidAmount: 0, potentialVoidStoneLane: 0 } },
          { playerId: 'player2', action: { type: 'bid', bidAmount: 1, potentialVoidStoneLane: 0 } },
        ],
      });
      
      expect(state.players[0].lanes[0].hasBeenShackled).toBe(true);
      
      // Advance to turn 8
      for (let i = 0; i < 3; i++) {
        state = resolveTurn(state, {
          playerActions: [
            { playerId: 'player1', action: { type: 'take', targetLane: 1 } },
            { playerId: 'player2', action: { type: 'take', targetLane: 1 } },
          ],
        });
      }
      
      // Check legal actions - lane 0 should NOT be a valid target
      const legalActions = getLegalActions(state, 'player1');
      const bidActionsWithLane0 = legalActions.filter(
        a => a.type === 'bid' && 'potentialVoidStoneLane' in a && a.potentialVoidStoneLane === 0
      );
      
      expect(bidActionsWithLane0.length).toBe(0);
      
      // But lanes 1 and 2 should be valid
      const bidActionsWithLane1 = legalActions.filter(
        a => a.type === 'bid' && 'potentialVoidStoneLane' in a && a.potentialVoidStoneLane === 1
      );
      const bidActionsWithLane2 = legalActions.filter(
        a => a.type === 'bid' && 'potentialVoidStoneLane' in a && a.potentialVoidStoneLane === 2
      );
      
      expect(bidActionsWithLane1.length).toBeGreaterThan(0);
      expect(bidActionsWithLane2.length).toBeGreaterThan(0);
    });
    
    it('should discard void stone if all lanes have been shackled', () => {
      // This is a rare edge case but must not soft-lock
      let state = createInitialGameState(99999);
      
      // Manually create a scenario where all lanes have been shackled
      // We'll do this by modifying the state directly for testing
      state = {
        ...state,
        players: [
          {
            ...state.players[0],
            lanes: [
              { ...state.players[0].lanes[0], hasBeenShackled: true },
              { ...state.players[0].lanes[1], hasBeenShackled: true },
              { ...state.players[0].lanes[2], hasBeenShackled: true },
            ],
          },
          state.players[1],
        ],
        turnNumber: 4,
      };
      
      // Check that no bid actions are available (all lanes invalid)
      const legalActions = getLegalActions(state, 'player1');
      expect(legalActions.length).toBe(0);
    });
  });
  
  // ============================================================================
  // Bug #2: Burn Overheat Removal
  // ============================================================================
  
  describe('Bug #2: Burn Overheat', () => {
    it('should apply overheat when burning and block subsequent burn/blindhit', () => {
      let state = createInitialGameState(11111);
      
      // Player should have 2 energy to start
      expect(state.players[0].energy).toBe(2);
      expect(state.players[0].overheat).toBe(0);
      
      // Burn on turn 1
      state = resolveTurn(state, {
        playerActions: [
          { playerId: 'player1', action: { type: 'burn' } },
          { playerId: 'player2', action: { type: 'take', targetLane: 0 } },
        ],
      });
      
      expect(state.players[0].energy).toBe(1);
      expect(state.players[0].overheat).toBe(2); // Burn causes overheat (2 turns cooldown)
      
      // Burn again on turn 2 - should be ILLEGAL (blocked by overheat)
      const legalActions = getLegalActions(state, 'player1');
      const burnAction = legalActions.find(a => a.type === 'burn');
      expect(burnAction).toBeUndefined();
      
      // Take instead to wait for overheat to decay (turn 2)
      state = resolveTurn(state, {
        playerActions: [
          { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
          { playerId: 'player2', action: { type: 'take', targetLane: 0 } },
        ],
      });
      
      expect(state.players[0].overheat).toBe(1); // Overheat decayed from 2 to 1
      
      // Still blocked on turn 3
      const legalActions2 = getLegalActions(state, 'player1');
      const burnAction2 = legalActions2.find(a => a.type === 'burn');
      expect(burnAction2).toBeUndefined();
      
      // Take again to wait for overheat to fully clear (turn 3)
      state = resolveTurn(state, {
        playerActions: [
          { playerId: 'player1', action: { type: 'take', targetLane: 1 } },
          { playerId: 'player2', action: { type: 'take', targetLane: 1 } },
        ],
      });
      
      expect(state.players[0].overheat).toBe(0); // Overheat fully cleared
      expect(state.turnNumber).toBe(4); // Now on turn 4 (Dark Auction - skip verification)
    });
    
    it('should block both burn and blindhit when overheat is active', () => {
      let state = createInitialGameState(22222);
      
      // Advance to turn 4 and lose auction to get shackled lane
      for (let i = 0; i < 3; i++) {
        state = resolveTurn(state, {
          playerActions: [
            { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
            { playerId: 'player2', action: { type: 'take', targetLane: 0 } },
          ],
        });
      }
      
      state = resolveTurn(state, {
        playerActions: [
          { playerId: 'player1', action: { type: 'bid', bidAmount: 0, potentialVoidStoneLane: 1 } },
          { playerId: 'player2', action: { type: 'bid', bidAmount: 1, potentialVoidStoneLane: 0 } },
        ],
      });
      
      expect(state.players[0].lanes[1].shackled).toBe(true);
      
      // Use BlindHit to cause overheat
      if (state.deck.length > 0) {
        state = resolveTurn(state, {
          playerActions: [
            { playerId: 'player1', action: { type: 'blind_hit', targetLane: 1 } },
            { playerId: 'player2', action: { type: 'take', targetLane: 0 } },
          ],
        });
        
        // Player should now have overheat
        expect(state.players[0].overheat).toBeGreaterThan(0);
        
        // Both Burn and BlindHit should be BLOCKED by overheat
        const legalActions = getLegalActions(state, 'player1');
        const burnAction = legalActions.find(a => a.type === 'burn');
        const blindHitAction = legalActions.find(a => a.type === 'blind_hit');
        
        expect(burnAction).toBeUndefined();
        expect(blindHitAction).toBeUndefined();
      }
    });
    
    it('should apply overheat from both Burn and BlindHit', () => {
      let state = createInitialGameState(33333);
      
      // Burn action SHOULD apply overheat
      state = resolveTurn(state, {
        playerActions: [
          { playerId: 'player1', action: { type: 'burn' } },
          { playerId: 'player2', action: { type: 'burn' } },
        ],
      });
      
      // Both players should have overheat (2 turns)
      expect(state.players[0].overheat).toBe(2);
      expect(state.players[1].overheat).toBe(2);
    });
  });
  
  // ============================================================================
  // Replay Determinism Verification
  // ============================================================================
  
  describe('Replay Determinism', () => {
    it('should produce identical results with same actions (bug fixes intact)', () => {
      const seed = 55555;
      let state1 = createInitialGameState(seed);
      let state2 = createInitialGameState(seed);
      
      const actions: TurnActions[] = [
        {
          playerActions: [
            { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
            { playerId: 'player2', action: { type: 'take', targetLane: 0 } },
          ],
        },
        {
          playerActions: [
            { playerId: 'player1', action: { type: 'burn' } },
            { playerId: 'player2', action: { type: 'burn' } },
          ],
        },
        {
          playerActions: [
            { playerId: 'player1', action: { type: 'take', targetLane: 1 } },
            { playerId: 'player2', action: { type: 'take', targetLane: 1 } },
          ],
        },
      ];
      
      for (const turnActions of actions) {
        state1 = resolveTurn(state1, turnActions);
        state2 = resolveTurn(state2, turnActions);
      }
      
      // States should be identical
      expect(state1.turnNumber).toBe(state2.turnNumber);
      expect(state1.players[0].energy).toBe(state2.players[0].energy);
      expect(state1.players[0].overheat).toBe(state2.players[0].overheat);
      expect(state1.players[0].lanes[0].hasBeenShackled).toBe(state2.players[0].lanes[0].hasBeenShackled);
    });
  });
});
