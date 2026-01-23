/**
 * MirrorMatch Engine - Public API
 * All exports for external consumers (UI, server, etc.)
 * 
 * CRITICAL: This is the ONLY entry point for external code.
 * Do not import directly from internal modules.
 */

// Core types
export type {
  Card,
  LaneState,
  PlayerState,
  GameState,
} from './types';

// Action types
export type {
  PlayerAction,
  TurnActions,
  TakeAction,
  BurnAction,
  StandAction,
  PassAction,
} from './actions';

// Replay types
export type { Replay } from './replay';

// State management functions
export { createInitialGameState, calculateLaneTotal } from './state';

// Action validation
export { isActionLegal, getLegalActions } from './validators';

// Turn resolution
export { resolveTurn } from './resolveTurn';

// Replay system
export { runReplay, runReplayWithHistory, compareReplays } from './replay';

// Analytics
export {
  analyzeLane,
  classifyDraw,
  getEndReason,
  getWinnerExplanation,
  explainGameEnd,
  detectSkillBadge,
  // Day 16: Draw analysis & decisiveness
  analyzeDraw,
  getDecisivenessScore,
  getMissedWinOpportunities,
  wasForcedDraw,
  // Day 18: Balance tuning
  analyzeDrawReason
} from './analytics';

export type {
  DrawReason,
  SkillBadge,
  LaneOutcome
} from './analytics';

// AI
export { chooseAction } from './ai';
export type { AIDifficulty } from './ai';

// Async PvP (INTEGRATION POINT)
export {
  createAsyncMatch,
  applyAsyncAction,
  replayAsyncMatch,
  getAsyncMatchStatus,
  verifyAsyncMatch
} from './async';

export type {
  AsyncMatch,
  ActionLogEntry,
  ApplyAsyncActionResult,
  AsyncMatchStatus
} from './async';
