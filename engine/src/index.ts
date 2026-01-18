/**
 * MirrorMatch Engine - Public API
 * All exports for external consumers (UI, server, etc.)
 */

// Core types
export type { Card, LaneState, PlayerState, GameState } from './types';
export type { PlayerAction, TurnActions, TakeAction, BurnAction, StandAction } from './actions';
export type { Replay } from './replay';

// State management
export { createInitialGameState, calculateLaneTotal } from './state';

// Action validation
export { isActionLegal } from './validators';

// Turn resolution
export { resolveTurn } from './resolveTurn';

// Replay system
export { runReplay, runReplayWithHistory, compareReplays } from './replay';
