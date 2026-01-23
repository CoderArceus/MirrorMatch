/**
 * MirrorMatch: Strategic 21 - Turn Resolution
 * Pure, deterministic turn-by-turn state transition
 * 
 * CRITICAL: This function assumes actions are already validated.
 * It does NOT re-validate them. Validation happens in validators.ts.
 * 
 * Resolution follows a strict order to prevent bugs and ensure determinism.
 */

import { GameState, Card, LaneState, PlayerState } from './types';
import { TurnActions, PlayerAction } from './actions';
import { calculateLaneTotal } from './state';

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

  // Apply energy costs
  newPlayers[0] = {
    ...newPlayers[0],
    energy: newPlayers[0].energy - interaction.player1EnergyCost,
  };
  newPlayers[1] = {
    ...newPlayers[1],
    energy: newPlayers[1].energy - interaction.player2EnergyCost,
  };

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

  // ============================================================================
  // STEP 7: Refill queue (maintain size = 3)
  // ============================================================================
  let newQueue = [...state.queue];
  let newDeck = [...state.deck];

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
  };

  // Handle non-queue actions (Stand and Pass don't interact with queue)
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
    return result;
  }

  // Case 4: Burn vs Take - Card destroyed, Taker gets Ash
  if (p1Type === 'burn' && p2Type === 'take') {
    result.cardConsumed = true;
    result.player1EnergyCost = 1;
    result.player2Card = createAshCard(state.turnNumber, player2Id);
    result.player2TargetLane = (player2Action as any).targetLane;
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
