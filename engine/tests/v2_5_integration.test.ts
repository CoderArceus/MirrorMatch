import { describe, it, expect } from 'vitest';
import { createInitialGameState } from '../src/state';
import { resolveTurn } from '../src/resolveTurn';
import { getLegalActions, isActionLegal } from '../src/validators';
import { BidAction, BlindHitAction } from '../src/actions';

describe('v2.5 Integration Tests', () => {
    describe('Dark Auction', () => {
        it('should trigger auction on turn 4', () => {
            let state = createInitialGameState(100);

            // Fast forward to turn 4
            // Turn 1
            state = resolveTurn(state, {
                playerActions: [
                    { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
                    { playerId: 'player2', action: { type: 'take', targetLane: 0 } }
                ]
            });
            // Turn 2
            state = resolveTurn(state, {
                playerActions: [
                    { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
                    { playerId: 'player2', action: { type: 'take', targetLane: 0 } }
                ]
            });
            // Turn 3
            state = resolveTurn(state, {
                playerActions: [
                    { playerId: 'player1', action: { type: 'take', targetLane: 0 } },
                    { playerId: 'player2', action: { type: 'take', targetLane: 0 } }
                ]
            });

            expect(state.turnNumber).toBe(4);

            // Verify legal actions are only bids
            const p1Actions = getLegalActions(state, 'player1');
            expect(p1Actions.length).toBeGreaterThan(0);
            expect(p1Actions.every(a => a.type === 'bid')).toBe(true);
        });

        it('should resolve auction correctly (winner pays, loser shackled)', () => {
            let state = createInitialGameState(200);
            // Hack state to turn 4
            state = { ...state, turnNumber: 4 };

            const actions = {
                playerActions: [
                    { playerId: 'player1', action: { type: 'bid', bidAmount: 2, potentialVoidStoneLane: 0 } as BidAction },
                    { playerId: 'player2', action: { type: 'bid', bidAmount: 0, potentialVoidStoneLane: 1 } as BidAction }
                ]
            };

            const nextState = resolveTurn(state, actions);

            // P1 Wins (2 vs 0)
            // P1 pays 2 energy
            expect(nextState.players[0].energy).toBe(0); // 2 - 2 = 0
            // P1 lanes untouched
            expect(nextState.players[0].lanes[0].shackled).toBe(false);

            // P2 Loses
            // P2 pays 0 energy
            expect(nextState.players[1].energy).toBe(2);
            // P2 gets Void Stone on lane 1 (specified in bid)
            expect(nextState.players[1].lanes[1].shackled).toBe(true);

            // Turn advances
            expect(nextState.turnNumber).toBe(5);
        });
    });

    describe('Blind Hit', () => {
        it('should allow blind hit on shackled lane', () => {
            let state = createInitialGameState(300);

            // Manually shackle a lane
            const p1 = state.players[0];
            const newLanes = [...p1.lanes];
            newLanes[0] = { ...newLanes[0], shackled: true };
            const newPlayers = [
                { ...p1, lanes: newLanes },
                state.players[1]
            ];
            state = { ...state, players: newPlayers };

            // Verify blind hit is legal
            const isLegal = isActionLegal(state, 'player1', { type: 'blind_hit', targetLane: 0 });
            expect(isLegal).toBe(true);
        });

        it('should apply blind hit (card from deck, overheat)', () => {
            let state = createInitialGameState(400);

            // Manually shackle a lane
            const p1 = state.players[0];
            const newLanes = [...p1.lanes];
            newLanes[0] = { ...newLanes[0], shackled: true };
            const newPlayers = [
                { ...p1, lanes: newLanes },
                state.players[1]
            ];
            state = { ...state, players: newPlayers };

            const topDeckCard = state.deck[0];

            const actions = {
                playerActions: [
                    { playerId: 'player1', action: { type: 'blind_hit', targetLane: 0 } as BlindHitAction },
                    { playerId: 'player2', action: { type: 'take', targetLane: 0 } }
                ]
            };

            const nextState = resolveTurn(state, actions);

            // P1 should have the top deck card in lane 0
            expect(nextState.players[0].lanes[0].cards[0].id).toBe(topDeckCard.id);

            // P1 should have overheat
            // Base 2 + Cost 0? Or just set to 2? Rules say "Adds Overheat +2"
            // Implementation: nextVal = 2, then decay -1 = 1?
            expect(nextState.players[0].overheat).toBeGreaterThan(0);
        });
    });
});
