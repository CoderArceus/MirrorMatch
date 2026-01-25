/**
 * Seque - Action Type Definitions
 * Serializable action types for all legal player actions in the MVP
 */
/**
 * Action: Take the front card from the queue and place it in a lane
 *
 * Rules:
 * - Takes the front card from the shared queue
 * - Must specify which lane to place the card
 * - If both players Take, both receive a copy of the card
 * - Lane must not be locked
 */
export interface TakeAction {
    readonly type: 'take';
    readonly targetLane: number;
}
/**
 * Action: Burn (destroy) the front card from the queue
 *
 * Rules:
 * - Destroys the front card so no one can use it
 * - Costs 1 Energy (must have Energy > 0)
 * - If one player Takes and the other Burns, the Taker receives an Ash Card (value = 1)
 * - If both players Burn, the card is simply destroyed
 */
export interface BurnAction {
    readonly type: 'burn';
}
/**
 * Action: Stand (permanently lock) one of your lanes
 *
 * Rules:
 * - Permanently locks the specified lane
 * - No more cards can be added to that lane
 * - Lane still scores at endgame
 * - Resolves independently of opponent's action
 */
export interface StandAction {
    readonly type: 'stand';
    readonly targetLane: number;
}
/**
 * Action: Pass (do nothing this turn)
 *
 * Rules:
 * - Player takes no action this turn
 * - No energy cost, no card interaction, no lane changes
 * - Pass is ONLY legal when no other actions are available
 * - If both players pass, the game ends
 * - This is a first-class action to prevent engine soft-locks
 */
export interface PassAction {
    readonly type: 'pass';
}
/**
 * Action: Blind Hit (v2.5)
 * Draw from remaining deck to a shackled lane
 */
export interface BlindHitAction {
    readonly type: 'blind_hit';
    readonly targetLane: number;
}
/**
 * Action: Bid (v2.5 Dark Auction)
 * Bid energy for a prize; loser gets Void Stone
 */
export interface BidAction {
    readonly type: 'bid';
    readonly bidAmount: number;
    readonly potentialVoidStoneLane: number;
}
/**
 * Union type for all possible player actions
 */
export type PlayerAction = TakeAction | BurnAction | StandAction | PassAction | BlindHitAction | BidAction;
/**
 * Represents the simultaneous actions submitted by all players for a single turn
 *
 * In MVP: exactly 2 players
 * Actions are revealed and resolved simultaneously using the interaction matrix
 */
export interface TurnActions {
    readonly playerActions: ReadonlyArray<{
        readonly playerId: string;
        readonly action: PlayerAction;
    }>;
}
