/**
 * Seque - Turn Resolution
 * Pure, deterministic turn-by-turn state transition
 * 
 * CRITICAL: This function assumes actions are already validated.
 * It does NOT re-validate them. Validation happens in validators.ts.
 * 
 * Resolution follows a strict order to prevent bugs and ensure determinism.
 */

import type { GameState, Card, LaneState, PlayerState } from './types';
import type { TurnActions, PlayerAction, BidAction } from './actions';
import { calculateLaneTotal } from './state';

const AUCTION_TURNS = [4, 8];

/**
 * Resolves a single turn, transitioning from one game state to the next
 * 
 * CONSTRAINTS:
 * - Pure function (no side effects)
 * - Does NOT mutate input state
 * - Returns brand-new GameState
 * - Increments turnNumber
 * - Assumes actions are already validated
 * 
 * RESOLUTION ORDER (DO NOT CHANGE):
 * 1. Early exit if game over
 * 2. Extract player actions
 * 3. Resolve interaction matrix
 * 4. Apply card effects
 * 5. Apply STAND actions
 * 6. Resolve busts and locks
 * 7. Refill queue
 * 8. Check game end
 * 9. Return new state
 * 
 * @param state - Current game state (immutable)
 * @param actions - Validated actions from all players
 * @returns New game state after turn resolution
 */
export function resolveTurn(
  state: GameState,
  actions: TurnActions
): GameState {
  // ============================================================================
  // STEP 0: Special Turn Handling (Dark Auction)
  // ============================================================================
  if (AUCTION_TURNS.includes(state.turnNumber)) {
    return resolveAuctionTurn(state, actions);
  }

  // ============================================================================
  // STEP 1: Early exit if game is already over
  // ============================================================================
  if (state.gameOver) {
    return state;
  }

  // ============================================================================
  // STEP 2: Extract player actions (MVP: exactly 2 players)
  // ============================================================================
  const player1Action = actions.playerActions.find(pa => pa.playerId === state.players[0].id)?.action;
  const player2Action = actions.playerActions.find(pa => pa.playerId === state.players[1].id)?.action;

  if (!player1Action || !player2Action) {
    // Missing action - should never happen if validated, but return unchanged state
    return state;
  }

  // ============================================================================
  // STEP 3: Resolve interaction matrix
  // ============================================================================
  const interaction = resolveInteractionMatrix(
    state,
    state.players[0].id,
    player1Action,
    state.players[1].id,
    player2Action
  );

  // ============================================================================
  // STEP 3.5: Resolve Blind Hits (v2.5) & Deck Draws
  // ============================================================================
  // Blind Hits happen independently of the queue interaction
  let newDeck = [...state.deck];

  // Resolve P1 Blind Hit
  let p1BlindCard: Card | null = null;
  if (player1Action.type === 'blind_hit') {
    if (newDeck.length > 0) {
      p1BlindCard = newDeck[0];
      newDeck = newDeck.slice(1);
    }
  }

  // Resolve P2 Blind Hit
  let p2BlindCard: Card | null = null;
  if (player2Action.type === 'blind_hit') {
    if (newDeck.length > 0) {
      p2BlindCard = newDeck[0];
      newDeck = newDeck.slice(1);
    }
  }

  // ============================================================================
  // STEP 4: Apply card effects (add cards to lanes)
  // ============================================================================
  let newPlayers = [...state.players];

  // Apply cards for player 1
  if (interaction.player1Card) {
    newPlayers[0] = addCardToPlayerLane(
      newPlayers[0],
      interaction.player1Card,
      interaction.player1TargetLane!
    );
  }

  // Apply cards for player 2
  if (interaction.player2Card) {
    newPlayers[1] = addCardToPlayerLane(
      newPlayers[1],
      interaction.player2Card,
      interaction.player2TargetLane!
    );
  }

  // Apply Blind Hit cards
  if (p1BlindCard && player1Action.type === 'blind_hit') {
    newPlayers[0] = addCardToPlayerLane(
      newPlayers[0],
      p1BlindCard,
      player1Action.targetLane
    );
  }
  if (p2BlindCard && player2Action.type === 'blind_hit') {
    newPlayers[1] = addCardToPlayerLane(
      newPlayers[1],
      p2BlindCard,
      player2Action.targetLane
    );
  }

  // Apply energy costs
  newPlayers[0] = {
    ...newPlayers[0],
    energy: newPlayers[0].energy - interaction.player1EnergyCost,
  };
  newPlayers[1] = {
    ...newPlayers[1],
    energy: newPlayers[1].energy - interaction.player2EnergyCost,
  };

  // Apply energy gains (v2.5)
  // +1 for Take->Ash interaction (Consolation)
  if (interaction.player1ConsolationEnergy) {
    newPlayers[0] = { ...newPlayers[0], energy: Math.min(5, newPlayers[0].energy + 1) };
  }
  if (interaction.player2ConsolationEnergy) {
    newPlayers[1] = { ...newPlayers[1], energy: Math.min(5, newPlayers[1].energy + 1) };
  }

  // Apply Overheat (v2.5)
  // Costs + Decay
  newPlayers[0] = resolveOverheat(newPlayers[0], player1Action);
  newPlayers[1] = resolveOverheat(newPlayers[1], player2Action);

  // ============================================================================
  // STEP 5: Apply STAND actions (lock lanes)
  // ============================================================================
  if (player1Action.type === 'stand') {
    newPlayers[0] = lockPlayerLane(newPlayers[0], player1Action.targetLane);
  }
  if (player2Action.type === 'stand') {
    newPlayers[1] = lockPlayerLane(newPlayers[1], player2Action.targetLane);
  }

  // ============================================================================
  // STEP 6: Resolve busts and locks (check all lanes)
  // ============================================================================
  newPlayers[0] = resolveLaneBustsAndLocks(newPlayers[0]);
  newPlayers[1] = resolveLaneBustsAndLocks(newPlayers[1]);

  // Apply energy gain for natural 21 (v2.5)
  // We need to know if 21 happened THIS turn.
  // We can infer it: if locked AND total==21 AND wasn't locked before?
  // Actually, resolveLaneBustsAndLocks handles locking.
  // Let's modify resolveLaneBustsAndLocks to return energy gain flag or handle it there.
  // For MVP refactor minimal diff: Check logic separately or enhance helper.
  // Better: Check newly locked 21s.
  newPlayers[0] = checkAndApply21EnergyBonus(state.players[0], newPlayers[0]);
  newPlayers[1] = checkAndApply21EnergyBonus(state.players[1], newPlayers[1]);

  // ============================================================================
  // STEP 7: Refill queue (maintain size = 3)
  // ============================================================================
  // newDeck is already updated from Blind Hits
  let newQueue = [...state.queue];
  // let newDeck = [...state.deck]; // newDeck is already updated from Blind Hits

  // Remove front card if it was consumed
  if (interaction.cardConsumed) {
    newQueue = newQueue.slice(1);
  }

  // Refill queue from deck to maintain 3 cards
  while (newQueue.length < 3 && newDeck.length > 0) {
    newQueue.push(newDeck[0]);
    newDeck = newDeck.slice(1);
  }

  // ============================================================================
  // STEP 8: Check game end conditions
  // ============================================================================
  const allLanesLocked = newPlayers.every(player =>
    player.lanes.every(lane => lane.locked)
  );
  const deckExhausted = newDeck.length === 0 && newQueue.length === 0;
  const bothPlayersPass = player1Action.type === 'pass' && player2Action.type === 'pass';
  const gameOver = allLanesLocked || deckExhausted || bothPlayersPass;

  let winner: string | null = null;
  if (gameOver) {
    winner = determineWinner(newPlayers[0], newPlayers[1]);
  }

  // ============================================================================
  // STEP 9: Return new state
  // ============================================================================
  return {
    deck: newDeck,
    queue: newQueue,
    players: newPlayers,
    turnNumber: state.turnNumber + 1,
    gameOver,
    winner,
  };
}

// ==============================================================================
// Helper Functions (Internal - Not Exported)
// ==============================================================================

/**
 * Interaction result from the matrix resolution
 */
interface InteractionResult {
  cardConsumed: boolean; // Was the front card removed from queue?
  player1Card: Card | null; // Card to give player 1 (null if none)
  player1TargetLane: number | null; // Lane for player 1's card
  player1EnergyCost: number; // Energy cost for player 1
  player2Card: Card | null; // Card to give player 2 (null if none)
  player2TargetLane: number | null; // Lane for player 2's card
  player2EnergyCost: number; // Energy cost for player 2
  player1ConsolationEnergy: boolean; // P1 gets +1 energy (Ash Consolation)
  player2ConsolationEnergy: boolean; // P2 gets +1 energy (Ash Consolation)
}

/**
 * Resolves the interaction matrix for two simultaneous actions
 * 
 * Matrix:
 * | P1    | P2    | Result                    |
 * |-------|-------|---------------------------|
 * | Take  | Take  | Both get card             |
 * | Burn  | Burn  | Card destroyed            |
 * | Take  | Burn  | Card destroyed, Take->Ash |
 * | Burn  | Take  | Card destroyed, Take->Ash |
 * | Stand | Any   | Stand resolves independently |
 */
function resolveInteractionMatrix(
  state: GameState,
  player1Id: string,
  player1Action: PlayerAction,
  player2Id: string,
  player2Action: PlayerAction
): InteractionResult {
  const frontCard = state.queue[0];

  // Default result
  const result: InteractionResult = {
    cardConsumed: false,
    player1Card: null,
    player1TargetLane: null,
    player1EnergyCost: 0,
    player2Card: null,
    player2TargetLane: null,
    player2EnergyCost: 0,
    player1ConsolationEnergy: false,
    player2ConsolationEnergy: false,
  };

  // Handle non-queue actions (Stand and Pass don't interact with queue)
  // Blind Hit also doesn't interact with queue directly here (handled in resolveTurn)
  // Bid is not valid here (checked in step 0)
  const p1InteractsWithQueue = player1Action.type === 'take' || player1Action.type === 'burn';
  const p2InteractsWithQueue = player2Action.type === 'take' || player2Action.type === 'burn';

  if (!p1InteractsWithQueue && !p2InteractsWithQueue) {
    // Neither player interacts with queue (both Stand/Pass)
    return result;
  }

  if (!frontCard) {
    // No card in queue (should never happen if validated)
    return result;
  }

  // Extract take/burn actions
  const p1Type = p1InteractsWithQueue ? player1Action.type : null;
  const p2Type = p2InteractsWithQueue ? player2Action.type : null;

  // Case 1: Take vs Take - Both players get the card
  if (p1Type === 'take' && p2Type === 'take') {
    result.cardConsumed = true;
    result.player1Card = frontCard;
    result.player1TargetLane = (player1Action as any).targetLane;
    result.player2Card = frontCard;
    result.player2TargetLane = (player2Action as any).targetLane;
    return result;
  }

  // Case 2: Burn vs Burn - Card destroyed, both pay energy
  if (p1Type === 'burn' && p2Type === 'burn') {
    result.cardConsumed = true;
    result.player1EnergyCost = 1;
    result.player2EnergyCost = 1;
    return result;
  }

  // Case 3: Take vs Burn - Card destroyed, Taker gets Ash
  if (p1Type === 'take' && p2Type === 'burn') {
    result.cardConsumed = true;
    result.player1Card = createAshCard(state.turnNumber, player1Id);
    result.player1TargetLane = (player1Action as any).targetLane;
    result.player2EnergyCost = 1;
    result.player1ConsolationEnergy = true; // Consolation Logic
    return result;
  }

  // P1 Burns vs P2 Take (Reversed)
  if (player1Action.type === 'burn' && player2Action.type === 'take') {
    result.cardConsumed = true;
    result.player1EnergyCost = 1;
    result.player2Card = createAshCard(state.turnNumber, player2Id);
    result.player2TargetLane = (player2Action as any).targetLane;
    result.player2ConsolationEnergy = true; // Consolation Logic
    return result;
  }

  // Case 5: One player Takes, other Stands
  if (p1Type === 'take' && !p2InteractsWithQueue) {
    result.cardConsumed = true;
    result.player1Card = frontCard;
    result.player1TargetLane = (player1Action as any).targetLane;
    return result;
  }

  if (p2Type === 'take' && !p1InteractsWithQueue) {
    result.cardConsumed = true;
    result.player2Card = frontCard;
    result.player2TargetLane = (player2Action as any).targetLane;
    return result;
  }

  // Case 6: One player Burns, other Stands
  if (p1Type === 'burn' && !p2InteractsWithQueue) {
    result.cardConsumed = true;
    result.player1EnergyCost = 1;
    return result;
  }

  if (p2Type === 'burn' && !p1InteractsWithQueue) {
    result.cardConsumed = true;
    result.player2EnergyCost = 1;
    return result;
  }

  return result;
}

/**
 * Creates an Ash card (value = 1)
 * Ash cards have unique IDs to ensure traceability in replays
 */
function createAshCard(turnNumber: number, playerId: string): Card {
  return {
    id: `ash-turn${turnNumber}-${playerId}`,
    suit: 'none',
    rank: 'ASH',
  };
}

/**
 * Adds a card to a specific lane for a player
 * Returns new PlayerState with updated lane
 */
function addCardToPlayerLane(
  player: PlayerState,
  card: Card,
  laneIndex: number
): PlayerState {
  const targetLane = player.lanes[laneIndex];

  // If lane is locked, don't add (should never happen if validated)
  if (targetLane.locked) {
    return player;
  }

  // Add card and recalculate total
  const newCards = [...targetLane.cards, card];
  const newTotal = calculateLaneTotal(newCards);

  const newLane: LaneState = {
    ...targetLane,
    cards: newCards,
    total: newTotal,
  };

  const newLanes = [...player.lanes];
  newLanes[laneIndex] = newLane;

  return {
    ...player,
    lanes: newLanes,
  };
}

/**
 * Locks a specific lane for a player (Stand action)
 * Returns new PlayerState with locked lane
 */
function lockPlayerLane(
  player: PlayerState,
  laneIndex: number
): PlayerState {
  const targetLane = player.lanes[laneIndex];

  // If already locked, no change
  if (targetLane.locked) {
    return player;
  }

  const newLane: LaneState = {
    ...targetLane,
    locked: true,
  };

  const newLanes = [...player.lanes];
  newLanes[laneIndex] = newLane;

  return {
    ...player,
    lanes: newLanes,
  };
}

/**
 * Checks all lanes for bust (>21) and exact 21, updating lock and bust flags
 * Returns new PlayerState with updated lanes
 */
function resolveLaneBustsAndLocks(player: PlayerState): PlayerState {
  const newLanes = player.lanes.map(lane => {
    // Already locked, no change
    if (lane.locked) {
      return lane;
    }

    // Check for bust (total > 21)
    if (lane.total > 21) {
      return {
        ...lane,
        locked: true,
        busted: true,
      };
    }

    // Check for exact 21
    if (lane.total === 21) {
      return {
        ...lane,
        locked: true,
      };
    }

    // No change
    return lane;
  });

  return {
    ...player,
    lanes: newLanes,
  };
}

/**
 * Determines the winner based on final lane scores
 * 
 * Rules:
 * - Win 2 out of 3 lanes to win match
 * - Lane scoring: higher value ≤21 wins, bust loses, equal ties
 * - Tiebreaker: compare winning lane values
 * 
 * @returns Player ID of winner, or null for draw
 */
function determineWinner(player1: PlayerState, player2: PlayerState): string | null {
  let player1Wins = 0;
  let player2Wins = 0;
  let ties = 0;

  let player1HighestWin = 0;
  let player2HighestWin = 0;

  // Score each lane independently
  for (let i = 0; i < 3; i++) {
    const p1Lane = player1.lanes[i];
    const p2Lane = player2.lanes[i];

    const winner = compareLanes(p1Lane, p2Lane);

    if (winner === 1) {
      player1Wins++;
      if (p1Lane.total > player1HighestWin) {
        player1HighestWin = p1Lane.total;
      }
    } else if (winner === 2) {
      player2Wins++;
      if (p2Lane.total > player2HighestWin) {
        player2HighestWin = p2Lane.total;
      }
    } else {
      ties++;
    }
  }

  // Check for clear winner (2 out of 3 lanes)
  if (player1Wins >= 2) {
    return player1.id;
  }
  if (player2Wins >= 2) {
    return player2.id;
  }

  // Tiebreaker: 1 win each, 1 tie
  // Compare winning lane values
  if (player1Wins === 1 && player2Wins === 1) {
    if (player1HighestWin > player2HighestWin) {
      return player1.id;
    }
    if (player2HighestWin > player1HighestWin) {
      return player2.id;
    }
    // Equal winning values = draw
    return null;
  }

  // Should not reach here in normal gameplay
  return null;
}

/**
 * Compares two lanes and determines the winner
 * 
 * @returns 1 if player 1 wins, 2 if player 2 wins, 0 if tie
 */
function compareLanes(lane1: LaneState, lane2: LaneState): 0 | 1 | 2 {
  const p1Busted = lane1.busted;
  const p2Busted = lane2.busted;

  // Both bust = tie
  if (p1Busted && p2Busted) {
    return 0;
  }

  // Only player 1 busted = player 2 wins
  if (p1Busted) {
    return 2;
  }

  // Only player 2 busted = player 1 wins
  if (p2Busted) {
    return 1;
  }

  // Neither busted - compare totals
  if (lane1.total > lane2.total) {
    return 1;
  }
  if (lane2.total > lane1.total) {
    return 2;
  }

  // Equal totals = tie
  return 0;
}

/**
 * Resolves Dark Auction Logic (Turn 4 & 8)
 */
function resolveAuctionTurn(state: GameState, actions: TurnActions): GameState {
  const p1Action = actions.playerActions.find(pa => pa.playerId === state.players[0].id)?.action as BidAction;
  const p2Action = actions.playerActions.find(pa => pa.playerId === state.players[1].id)?.action as BidAction;

  if (!p1Action || p1Action.type !== 'bid' || !p2Action || p2Action.type !== 'bid') {
    // Should never happen if validated
    return state;
  }

  let newPlayers = [...state.players];
  const p1Bid = p1Action.bidAmount;
  const p2Bid = p2Action.bidAmount;

  let loserIndex = -1;
  let winnerIndex = -1;

  if (p1Bid > p2Bid) {
    // P1 Wins
    winnerIndex = 0;
    loserIndex = 1;
  } else if (p2Bid > p1Bid) {
    // P2 Wins
    winnerIndex = 1;
    loserIndex = 0;
  } else {
    // Tie: Leader's Burden (Higher board score loses)
    const p1Score = calculateTotalBoardScore(newPlayers[0]);
    const p2Score = calculateTotalBoardScore(newPlayers[1]);

    if (p1Score > p2Score) {
      loserIndex = 0;
      winnerIndex = 1;
    } else if (p2Score > p1Score) {
      loserIndex = 1;
      winnerIndex = 0;
    } else {
      // Deterministic fallback (Player lexicographic)
      // PlayerIds are player1, player2. player2 > player1 lexicographically?
      // "player1" < "player2". 
      // Rule: "Use deterministic player ordering". Usually ID order.
      // Let's say Player 1 wins tie if all else equal.
      winnerIndex = 0;
      loserIndex = 1;
    }
  }

  // Apply results
  // Winner pays bid
  newPlayers[winnerIndex] = {
    ...newPlayers[winnerIndex],
    energy: newPlayers[winnerIndex].energy - (winnerIndex === 0 ? p1Bid : p2Bid),
  };

  // Loser pays 0, gets Void Stone
  const loserAction = loserIndex === 0 ? p1Action : p2Action;
  const voidLaneIndex = loserAction.potentialVoidStoneLane;
  newPlayers[loserIndex] = applyVoidStone(newPlayers[loserIndex], voidLaneIndex, state.turnNumber);

  return {
    ...state,
    players: newPlayers,
    turnNumber: state.turnNumber + 1, // Advance turn
    // Auctions don't trigger game over (usually)
  };
}

function calculateTotalBoardScore(player: PlayerState): number {
  return player.lanes.reduce((sum, lane) => sum + (lane.busted ? 0 : lane.total), 0);
}

function applyVoidStone(player: PlayerState, laneIndex: number, _turn: number): PlayerState {
  const newLanes = [...player.lanes];
  const lane = newLanes[laneIndex];

  // Day 26 Bug Fix: Check if lane has been shackled before
  // If lane has already been shackled, discard the Void Stone (no effect)
  if (lane.hasBeenShackled) {
    // Void Stone is discarded, no lane is shackled
    return player;
  }

  // Apply shackle to the lane
  newLanes[laneIndex] = {
    ...lane,
    shackled: true,
    hasBeenShackled: true, // Mark as having been shackled
    locked: false, // Unlock if locked
  };

  return {
    ...player,
    lanes: newLanes,
  };
}

/**
 * Resolves Overheat decay and costs
 * Day 28 Bug Fix: Overheat should last EXACTLY 2 full turns
 * Both Burn and BlindHit apply Overheat (+2)
 * Overheat blocks both Burn and BlindHit actions
 */
function resolveOverheat(player: PlayerState, action: PlayerAction): PlayerState {
  let newOverheat = player.overheat;

  // Apply costs FIRST - Both Burn and BlindHit cause overheat (+2)
  if (action.type === 'burn' || action.type === 'blind_hit') {
    // Set overheat to 2 (player cannot Burn/BlindHit for next 2 turns)
    newOverheat = 2;
  } else {
    // Decay at end of turn (only if NOT using Burn/BlindHit this turn)
    // Overheat decreases by 1 at the end of each turn
    if (newOverheat > 0) {
      newOverheat--;
    }
  }

  return {
    ...player,
    overheat: newOverheat,
  };
}

function checkAndApply21EnergyBonus(oldPlayer: PlayerState, newPlayer: PlayerState): PlayerState {
  // Check if any lane HIT 21 this turn
  // Logic: Old lane total != 21 AND New lane total == 21 ==> Bonus
  // Also clamp at 5.

  let bonus = 0;
  for (let i = 0; i < 3; i++) {
    const oldLane = oldPlayer.lanes[i];
    const newLane = newPlayer.lanes[i];

    if (oldLane.total !== 21 && newLane.total === 21) {
      bonus++;
    }
  }

  if (bonus > 0) {
    return {
      ...newPlayer,
      energy: Math.min(5, newPlayer.energy + bonus)
    };
  }
  return newPlayer;
}
