/**
 * MirrorMatch UI - Minimal Local Play
 * Engine is treated as a BLACK BOX - no modifications
 */

import { useState, useEffect } from 'react';
import {
  createInitialGameState,
  isActionLegal,
  getLegalActions,
  resolveTurn,
  // Analytics
  classifyDraw,
  analyzeLane,
  detectSkillBadge,
  explainGameEnd,
  analyzeDrawDiagnostics,
  // AI
  chooseAction
} from '../../engine/src';

import type {
  GameState,
  PlayerAction,
  TurnActions,
  DrawReason,
  AIDifficulty,
  BidAction,
  BlindHitAction
} from '../../engine/src';
import { getMatchFromURL, createShareableURL } from './utils/encodeMatch';
import type { EncodedMatch } from './utils/encodeMatch';
import { runReplay } from '../../engine/src';

import './App.css';

type PendingActions = {
  player1?: PlayerAction;
  player2?: PlayerAction;
};

type SessionStats = {
  games: number;
  p1Wins: number;
  p2Wins: number;
  draws: number;
  totalTurns: number;
  drawReasons: Record<DrawReason, number>; // Track draw type frequency
};

type Replay = {
  id: string;
  seed: number;
  actions: TurnActions[];
  finalState: GameState;
  timestamp: number;
};

type FeedbackType = 'fun' | 'confusing' | 'frustrating' | 'thinking';

type Feedback = {
  type: FeedbackType;
  gameId: string;
  timestamp: number;
};

// ============================================================================
// Telemetry: Local Storage Stats
// ============================================================================

const STATS_KEY = 'mirrormatch-session-stats';

function loadStats(): SessionStats {
  const stored = localStorage.getItem(STATS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Ensure drawReasons exists (for backwards compatibility)
      if (!parsed.drawReasons) {
        parsed.drawReasons = {
          perfect_symmetry: 0,
          energy_exhaustion: 0,
          mutual_perfection: 0,
          stall_lock: 0,
          equal_lanes: 0,
          tiebreaker_equal: 0,
          deck_exhausted: 0,
        };
      }
      return parsed;
    } catch {
      // Invalid data, reset
    }
  }
  return {
    games: 0,
    p1Wins: 0,
    p2Wins: 0,
    draws: 0,
    totalTurns: 0,
    drawReasons: {
      perfect_symmetry: 0,
      energy_exhaustion: 0,
      mutual_perfection: 0,
      stall_lock: 0,
      equal_lanes: 0,
      tiebreaker_equal: 0,
      deck_exhausted: 0,
      mutual_pass: 0,
      lane_split: 0,
      stall_equilibrium: 0,
    }
  };
}

function saveStats(stats: SessionStats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function recordGame(state: GameState): void {
  const stats = loadStats();
  stats.games += 1;
  stats.totalTurns += state.turnNumber;

  if (state.winner === 'player1') {
    stats.p1Wins += 1;
  } else if (state.winner === 'player2') {
    stats.p2Wins += 1;
  } else {
    stats.draws += 1;
    // Track draw reason
    const drawInfo = classifyDraw(state);
    stats.drawReasons[drawInfo.type] = (stats.drawReasons[drawInfo.type] || 0) + 1;
  }

  saveStats(stats);
}

function resetStats(): void {
  localStorage.removeItem(STATS_KEY);
}

// ============================================================================
// Replay System: Storage and Retrieval
// ============================================================================

const REPLAYS_KEY = 'mirrormatch-replays';
const MAX_REPLAYS = 50; // Keep last 50 games

function loadReplays(): Replay[] {
  const stored = localStorage.getItem(REPLAYS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

function saveReplay(replay: Replay): void {
  const replays = loadReplays();
  replays.unshift(replay); // Add to front

  // Keep only last MAX_REPLAYS
  if (replays.length > MAX_REPLAYS) {
    replays.splice(MAX_REPLAYS);
  }

  localStorage.setItem(REPLAYS_KEY, JSON.stringify(replays));
}



// ============================================================================
// Feedback System: Quick 1-Click Capture
// ============================================================================

const FEEDBACK_KEY = 'mirrormatch-feedback';

function saveFeedback(feedback: Feedback): void {
  const stored = localStorage.getItem(FEEDBACK_KEY);
  const feedbacks: Feedback[] = stored ? JSON.parse(stored) : [];
  feedbacks.push(feedback);
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbacks));
}



// ============================================================================
// Replay Engine: Deterministic State Reconstruction
// ============================================================================



// ============================================================================
// Game Over Explanation
// ============================================================================



// ============================================================================
// Lane Outcome Analysis
// ============================================================================



// ============================================================================
// Draw Classification
// ============================================================================



// ============================================================================
// Game End Explanation Engine
// ============================================================================



// ============================================================================
// Skill Badge Detection
// ============================================================================



function App() {
  // ============================================================================
  // Day 25: Post-Game Explanation Logic (UI Mapping Only)
  // ============================================================================
  
  /**
   * Generate human-friendly strategic summary for game outcome
   * Pure mapping function - consumes existing analytics, no new logic
   */
  const generateStrategicSummary = (state: GameState, viewerPlayerId: 'player1' | 'player2'): string => {
    const isWin = state.winner === viewerPlayerId;
    const isDraw = state.winner === null;
    
    if (isWin) {
      return generateWinSummary(state, viewerPlayerId);
    } else if (isDraw) {
      return generateDrawSummary(state);
    } else {
      return generateLossSummary(state, viewerPlayerId);
    }
  };
  
  /**
   * Win summary - uses lane analysis to explain victory
   */
  const generateWinSummary = (state: GameState, playerId: 'player1' | 'player2'): string => {
    const player = state.players.find(p => p.id === playerId)!;
    const opponent = state.players.find(p => p.id !== playerId)!;
    
    // Analyze lanes
    const p1Lanes = state.players[0].lanes;
    const p2Lanes = state.players[1].lanes;
    const outcomes = [
      analyzeLane(p1Lanes[0], p2Lanes[0]),
      analyzeLane(p1Lanes[1], p2Lanes[1]),
      analyzeLane(p1Lanes[2], p2Lanes[2]),
    ];
    
    const myWins = outcomes.filter(o => o.winner === playerId).length;
    const opponentBusts = opponent.lanes.filter(l => l.busted).length;
    const my21s = player.lanes.filter(l => l.total === 21 && !l.busted).length;
    
    // Pattern matching for explanation
    if (opponentBusts >= 2) {
      return "You won because your opponent overextended and busted multiple lanes.";
    }
    
    if (my21s >= 2) {
      return "You secured victory with precision play, hitting 21 in multiple lanes.";
    }
    
    if (player.energy > opponent.energy) {
      return "Your superior energy management and strategic positioning secured the victory.";
    }
    
    if (myWins === 2) {
      return "You won by securing two strong lanes with better positioning.";
    }
    
    return "You made strategic decisions that gave you the decisive advantage.";
  };
  
  /**
   * Loss summary - symmetric inverse of win
   */
  const generateLossSummary = (state: GameState, playerId: 'player1' | 'player2'): string => {
    const player = state.players.find(p => p.id === playerId)!;
    const opponent = state.players.find(p => p.id !== playerId)!;
    
    const myBusts = player.lanes.filter(l => l.busted).length;
    const opponent21s = opponent.lanes.filter(l => l.total === 21 && !l.busted).length;
    
    if (myBusts >= 2) {
      return "You lost by overextending and busting multiple lanes.";
    }
    
    if (opponent21s >= 2) {
      return "Your opponent secured victory with precision play, hitting 21 in multiple lanes.";
    }
    
    if (opponent.energy > player.energy) {
      return "Your opponent's superior energy management gave them the advantage.";
    }
    
    return "Your opponent secured two strong lanes with better strategic positioning.";
  };
  
  /**
   * Draw summary - uses analyzeDrawDiagnostics for pressure framing
   */
  const generateDrawSummary = (state: GameState): string => {
    const drawInfo = classifyDraw(state);
    const diagnostics = analyzeDrawDiagnostics(state, 'player1', 'player2', actionHistory.flatMap(turn => 
      turn.playerActions.map(pa => ({ playerId: pa.playerId, action: pa.action }))
    ));
    
    // Calculate pressure indicators
    const avgWinThreats = (diagnostics.p1.winThreats + diagnostics.p2.winThreats) / 2;
    const avgEnergyRemaining = (diagnostics.p1.energyRemaining + diagnostics.p2.energyRemaining) / 2;
    
    const isHighPressure = avgWinThreats >= 2;
    const isLowPressure = avgEnergyRemaining >= 2;
    
    // Build explanation with pressure framing
    let explanation = '';
    
    switch (drawInfo.type) {
      case 'perfect_symmetry':
        explanation = 'Perfect mirror play — both players made identical optimal decisions.';
        break;
      case 'mutual_perfection':
        explanation = 'Rare outcome — both players hit optimal totals. This represents elite-level play.';
        break;
      case 'lane_split':
        explanation = 'This match ended in a draw due to lane split.';
        if (isHighPressure) {
          explanation += ' Both players created strong win threats, resulting in high-pressure competitive play.';
        } else {
          explanation += ' Neither player could force a decisive advantage.';
        }
        break;
      case 'mutual_pass':
        explanation = 'Both players passed with cards remaining, choosing to lock in the current state.';
        break;
      case 'stall_equilibrium':
        explanation = 'Both players reached optimal positions early and locked all lanes.';
        break;
      case 'deck_exhausted':
        explanation = 'The deck was exhausted with lanes in a tied state.';
        break;
      case 'energy_exhaustion':
        explanation = 'Strategic deadlock — both players exhausted their energy in a perfectly balanced exchange.';
        break;
      default:
        explanation = 'Both players reached equilibrium with no clear advantage.';
    }
    
    // Add pressure context
    if (isHighPressure && drawInfo.type === 'lane_split') {
      explanation += ' Elite-level competitive balance.';
    } else if (isLowPressure && drawInfo.type !== 'energy_exhaustion') {
      explanation += ' Both players had remaining resources but chose not to risk their positions.';
    }
    
    return explanation;
  };
  
  // ============================================================================
  // Dynamic Action Rendering Components
  // ============================================================================

  // Auction Controls Component - Day 28: Button-based bidding
  const AuctionControls = ({
    onSubmit,
    activePlayer,
    gameState
  }: {
    bidActions?: BidAction[];
    onSubmit: (action: PlayerAction) => void;
    activePlayer: 'player1' | 'player2';
    gameState: GameState;
  }) => {
    const [bidAmount, setBidAmount] = useState(0);
    const [voidStoneLane, setVoidStoneLane] = useState(0);

    const player = gameState.players.find(p => p.id === activePlayer)!;
    const maxBid = player.energy;

    const handleSubmit = () => {
      const action: BidAction = {
        type: 'bid',
        bidAmount,
        potentialVoidStoneLane: voidStoneLane
      };
      onSubmit(action);
    };

    return (
      <div className="auction-controls">
        <div className="bid-selection-group">
          <label>
            <strong>Your Bid</strong>
          </label>
          <div className="bid-buttons">
            {Array.from({ length: maxBid + 1 }, (_, i) => i).map(bid => (
              <button
                key={bid}
                onClick={() => setBidAmount(bid)}
                className={`bid-btn ${bidAmount === bid ? 'selected' : ''}`}
              >
                {bid}
              </button>
            ))}
          </div>
          <div className="selected-bid-display">
            Selected: <strong>{bidAmount} energy</strong>
          </div>
        </div>

        <div className="void-stone-lane-group">
          <label>
            <strong>Void Stone Target (if you lose)</strong>
            <div className="lane-buttons">
              {[0, 1, 2].map(lane => (
                <button
                  key={lane}
                  onClick={() => setVoidStoneLane(lane)}
                  className={`lane-select-btn ${voidStoneLane === lane ? 'selected' : ''}`}
                >
                  Lane {String.fromCharCode(65 + lane)}
                </button>
              ))}
            </div>
          </label>
        </div>

        <button onClick={handleSubmit} className="submit-bid-btn">
          Submit Bid
        </button>

        <p className="auction-hint">
          💡 Higher bid = more likely to win. Winner pays bid. Loser gets shackled lane.
        </p>
      </div>
    );
  };

  // Helper: Render actions dynamically based on engine truth
  const renderDynamicActions = () => {
    const legalActions = getLegalActions(gameState, activePlayer);

    // Group actions by type
    const takeActions = legalActions.filter(a => a.type === 'take') as { type: 'take'; targetLane: number }[];
    const burnAction = legalActions.find(a => a.type === 'burn');
    const standActions = legalActions.filter(a => a.type === 'stand') as { type: 'stand'; targetLane: number }[];
    const blindHitActions = legalActions.filter(a => a.type === 'blind_hit') as BlindHitAction[];
    const bidActions = legalActions.filter(a => a.type === 'bid') as BidAction[];

    // Auction Turn: Show bid controls
    if (bidActions.length > 0) {
      return <AuctionControls onSubmit={selectAction} activePlayer={activePlayer} gameState={gameState} />;
    }

    return (
      <div className="actions">
        {/* Take Actions */}
        {takeActions.length > 0 && (
          <div className="action-group">
            <h4>Take (add card to lane)</h4>
            <div className="lane-buttons">
              {takeActions.map(action => (
                <button
                  key={action.targetLane}
                  onClick={() => selectAction(action)}
                  className="action-btn"
                >
                  Lane {String.fromCharCode(65 + action.targetLane)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Burn Action */}
        {burnAction && (
          <div className="action-group">
            <h4>Burn (destroy front card)</h4>
            <button
              onClick={() => selectAction(burnAction)}
              className="action-btn burn"
            >
              🔥 Burn (1 energy)
            </button>
          </div>
        )}

        {/* Stand Actions */}
        {standActions.length > 0 && (
          <div className="action-group">
            <h4>Stand (lock lane)</h4>
            <div className="lane-buttons">
              {standActions.map(action => (
                <button
                  key={action.targetLane}
                  onClick={() => selectAction(action)}
                  className="action-btn stand"
                >
                  Lane {String.fromCharCode(65 + action.targetLane)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Blind Hit Actions */}
        {blindHitActions.length > 0 && (
          <div className="action-group">
            <h4>Blind Hit (random card from deck)</h4>
            <p className="blind-hit-warning">⚠️ Desperation move: Draws random card. Causes 2-turn overheat.</p>
            <div className="lane-buttons">
              {blindHitActions.map(action => (
                <button
                  key={action.targetLane}
                  onClick={() => selectAction(action)}
                  className="action-btn blind-hit"
                >
                  Lane {String.fromCharCode(65 + action.targetLane)} (Shackled)
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // Day 27: Turn Resolution Summary & Auction Transparency
  // ============================================================================

  /**
   * Generates a human-readable summary of what happened in a turn
   * Derived from actionLog and current state - no new state fields
   */
  const generateTurnSummary = (turnActions: TurnActions, turnNumber: number, beforeState: GameState, afterState: GameState): {
    myAction: string;
    opponentAction: string;
    result: string;
    isAuction: boolean;
    auctionDetails?: {
      myBid: number;
      opponentBid: number;
      winner: 'player1' | 'player2';
      loserLane: number;
      tiebreak?: string;
    };
  } => {
    const myAction = turnActions.playerActions.find(pa => pa.playerId === myPlayerRole)!;
    const opponentAction = turnActions.playerActions.find(pa => pa.playerId !== myPlayerRole)!;

    // Check if auction turn
    const isAuction = [4, 8].includes(turnNumber);

    if (isAuction && myAction.action.type === 'bid' && opponentAction.action.type === 'bid') {
      const myBid = myAction.action.bidAmount;
      const opponentBid = opponentAction.action.bidAmount;
      
      let winner: 'player1' | 'player2';
      let loserLane: number;
      let tiebreak: string | undefined;

      // Determine winner
      if (myBid > opponentBid) {
        winner = myPlayerRole;
        loserLane = opponentAction.action.potentialVoidStoneLane;
      } else if (opponentBid > myBid) {
        winner = myPlayerRole === 'player1' ? 'player2' : 'player1';
        loserLane = myAction.action.potentialVoidStoneLane;
      } else {
        // Tie - use Leader's Burden
        const myScore = beforeState.players.find(p => p.id === myPlayerRole)!.lanes.reduce((sum, l) => sum + (l.busted ? 0 : l.total), 0);
        const oppScore = beforeState.players.find(p => p.id !== myPlayerRole)!.lanes.reduce((sum, l) => sum + (l.busted ? 0 : l.total), 0);
        
        if (myScore > oppScore) {
          winner = myPlayerRole === 'player1' ? 'player2' : 'player1';
          loserLane = myAction.action.potentialVoidStoneLane;
          tiebreak = `Leader's Burden: higher board score (${myScore}) lost`;
        } else if (oppScore > myScore) {
          winner = myPlayerRole;
          loserLane = opponentAction.action.potentialVoidStoneLane;
          tiebreak = `Leader's Burden: higher board score lost`;
        } else {
          // Deterministic fallback
          winner = 'player2';
          loserLane = myAction.action.potentialVoidStoneLane;
          tiebreak = 'Tie resolved by player order';
        }
      }

      return {
        myAction: `Bid ${myBid} energy`,
        opponentAction: `Bid ${opponentBid} energy`,
        result: winner === myPlayerRole ? 'You won the auction' : 'Opponent won the auction',
        isAuction: true,
        auctionDetails: { myBid, opponentBid, winner, loserLane, tiebreak }
      };
    }

    // Normal turn
    const formatAction = (action: PlayerAction): string => {
      switch (action.type) {
        case 'take':
          return `Take → Lane ${String.fromCharCode(65 + action.targetLane)}`;
        case 'burn':
          return 'Burn';
        case 'stand':
          return `Stand Lane ${String.fromCharCode(65 + action.targetLane)}`;
        case 'blind_hit':
          return `Blind Hit → Lane ${String.fromCharCode(65 + action.targetLane)}`;
        case 'pass':
          return 'Pass';
        default:
          return 'Unknown';
      }
    };

    // Determine result
    let result = '';
    const frontCard = beforeState.queue[0];
    
    if (myAction.action.type === 'take' && opponentAction.action.type === 'take') {
      result = `Both took ${frontCard?.rank}${frontCard?.suit}`;
    } else if (myAction.action.type === 'burn' && opponentAction.action.type === 'burn') {
      result = `Card ${frontCard?.rank}${frontCard?.suit} burned`;
    } else if ((myAction.action.type === 'take' && opponentAction.action.type === 'burn') ||
               (myAction.action.type === 'burn' && opponentAction.action.type === 'take')) {
      result = `Card burned → Ash consolation`;
    } else if (myAction.action.type === 'take') {
      result = `You took ${frontCard?.rank}${frontCard?.suit}`;
    } else if (opponentAction.action.type === 'take') {
      result = `Opponent took ${frontCard?.rank}${frontCard?.suit}`;
    } else if (myAction.action.type === 'burn') {
      result = `You burned ${frontCard?.rank}${frontCard?.suit}`;
    } else if (opponentAction.action.type === 'burn') {
      result = `Opponent burned ${frontCard?.rank}${frontCard?.suit}`;
    }

    // Check for overheat application
    const myAfterState = afterState.players.find(p => p.id === myPlayerRole)!;
    const myBeforeState = beforeState.players.find(p => p.id === myPlayerRole)!;
    if (myAfterState.overheat > myBeforeState.overheat) {
      result += ` → You gained Overheat`;
    }

    return {
      myAction: formatAction(myAction.action),
      opponentAction: formatAction(opponentAction.action),
      result,
      isAuction: false
    };
  };

  // End of inner component definitions
  // ============================================================================
  // Async PvP: Load match from URL if present
  const urlMatch = getMatchFromURL();
  const initialSeed = urlMatch?.seed || Date.now();

  const [gameSeed] = useState<number>(() => initialSeed);
  const [gameState, setGameState] = useState<GameState>(() => {
    if (urlMatch) {
      // Reconstruct state from replay
      const replay = { initialState: createInitialGameState(urlMatch.seed), turns: urlMatch.actions };
      return runReplay(replay);
    }
    return createInitialGameState(initialSeed);
  });
  const [actionHistory, setActionHistory] = useState<TurnActions[]>(() => urlMatch?.actions || []);
  const [pendingActions, setPendingActions] = useState<PendingActions>(() => urlMatch?.pendingActions || {});
  const [activePlayer, setActivePlayer] = useState<'player1' | 'player2'>(() => {
    // In async mode, activePlayer should match who needs to act
    if (urlMatch) {
      return urlMatch.currentPlayer;
    }
    return 'player1';
  });
  const [stats, setStats] = useState<SessionStats>(loadStats);
  const [gameRecorded, setGameRecorded] = useState(false);

  // AI Mode
  const [vsAI, setVsAI] = useState<boolean>(false);
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('medium');
  const [aiThinking, setAIThinking] = useState<boolean>(false);

  // Feedback
  const [feedbackGiven, setFeedbackGiven] = useState<boolean>(false);

  // Async PvP Mode
  const [asyncMode] = useState<boolean>(() => urlMatch !== null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [myPlayerRole] = useState<'player1' | 'player2'>(() => {
    // Determine role from URL match
    if (!urlMatch) return 'player1';
    // currentPlayer indicates whose turn it is
    // Opening the link means you are that player
    return urlMatch.currentPlayer;
  });
  
  // Day 30: Match restoration indicator
  const [matchRestored, setMatchRestored] = useState<boolean>(false);

  const player1 = gameState.players[0];
  const player2 = gameState.players[1];

  // Check if it's my turn in async mode
  const isMyTurn = !asyncMode || (activePlayer === myPlayerRole);

  // Validate URL match on mount
  useEffect(() => {
    if (urlMatch && urlMatch.version !== 1) {
      setUrlError('Invalid match version. Please request a new link.');
    }
    
    // Day 30: Show match restored indicator on load
    if (urlMatch && actionHistory.length > 0) {
      setMatchRestored(true);
      // Hide after 3 seconds
      setTimeout(() => setMatchRestored(false), 3000);
    }
  }, [urlMatch]);

  // Handle feedback submission
  const submitFeedback = (type: FeedbackType) => {
    const feedback: Feedback = {
      type,
      gameId: `${gameSeed}`,
      timestamp: Date.now(),
    };
    saveFeedback(feedback);
    setFeedbackGiven(true);
  };

  // Record game stats and replay when it ends (only once)
  useEffect(() => {
    if (gameState.gameOver && !gameRecorded) {
      // Record stats
      recordGame(gameState);
      setStats(loadStats());

      // Save replay
      const replay: Replay = {
        id: `${gameSeed}-${Date.now()}`,
        seed: gameSeed,
        actions: actionHistory,
        finalState: gameState,
        timestamp: Date.now(),
      };
      saveReplay(replay);

      setGameRecorded(true);

      // DEBUG: Log winner determination details
      console.group('🏁 Game Over - Winner Determination Debug');
      console.log('Winner:', gameState.winner);
      console.log('\nPlayer 1 Lanes:');
      gameState.players[0].lanes.forEach((lane, i) => {
        console.log(`  Lane ${String.fromCharCode(65 + i)}: total=${lane.total}, busted=${lane.busted}, locked=${lane.locked}`);
      });
      console.log('\nPlayer 2 Lanes:');
      gameState.players[1].lanes.forEach((lane, i) => {
        console.log(`  Lane ${String.fromCharCode(65 + i)}: total=${lane.total}, busted=${lane.busted}, locked=${lane.locked}`);
      });

      // Manual lane comparison
      console.log('\nLane-by-Lane Results:');
      for (let i = 0; i < 3; i++) {
        const p1 = gameState.players[0].lanes[i];
        const p2 = gameState.players[1].lanes[i];
        let result = '';

        if (p1.busted && p2.busted) result = 'TIE (both bust)';
        else if (p1.busted) result = 'P2 WINS (P1 bust)';
        else if (p2.busted) result = 'P1 WINS (P2 bust)';
        else if (p1.total > p2.total) result = `P1 WINS (${p1.total} > ${p2.total})`;
        else if (p2.total > p1.total) result = `P2 WINS (${p2.total} > ${p1.total})`;
        else result = `TIE (${p1.total} = ${p2.total})`;

        console.log(`  Lane ${String.fromCharCode(65 + i)}: ${result}`);
      }
      console.groupEnd();
    }
  }, [gameState.gameOver, gameRecorded]);

  // CHECK: If active player's only legal action is PASS, auto-submit it
  useEffect(() => {
    if (gameState.gameOver) return;

    // Use Engine as Source of Truth
    const legalActions = getLegalActions(gameState, activePlayer);

    // Check if we are forced to pass (Engine contract: if no real actions, returns [{type: 'pass'}])
    const mustPass = legalActions.length === 1 && legalActions[0].type === 'pass';

    // If we've already submitted a pending action, don't auto-pass
    if (pendingActions[activePlayer]) return;

    // AI Check: Don't auto-pass for AI (AI handles its own logic)
    if (vsAI && activePlayer === 'player2') return;

    if (mustPass) {
      console.log(`Auto-pass: ${activePlayer} has no legal moves. Submitting PASS.`);

      const passAction: PlayerAction = { type: 'pass' };
      const newPending = { ...pendingActions, [activePlayer]: passAction };
      setPendingActions(newPending);

      // If both actions are now ready, resolve the turn
      // Note: In async mode this might need different handling, but for local play/hotseat this is correct
      if (newPending.player1 && newPending.player2) {
        setTimeout(() => {
          const turnActions: TurnActions = {
            playerActions: [
              { playerId: 'player1', action: newPending.player1! },
              { playerId: 'player2', action: newPending.player2! },
            ],
          };

          const newState = resolveTurn(gameState, turnActions);
          setGameState(newState);
          setActionHistory([...actionHistory, turnActions]);
          setPendingActions({});
          setActivePlayer('player1'); // Reset to player1
        }, 500); // Slight delay for visual clarity
      } else {
        // Switch control if needed
        const otherPlayer = activePlayer === 'player1' ? 'player2' : 'player1';
        if (!newPending[otherPlayer]) {
          setActivePlayer(otherPlayer);
        }
      }
    }
  }, [gameState, activePlayer, pendingActions, actionHistory]);

  // Check if an action is legal for the active player
  const checkLegal = (action: PlayerAction): boolean => {
    return isActionLegal(gameState, activePlayer, action);
  };

  // Handle action selection
  const selectAction = (action: PlayerAction) => {
    console.log('selectAction called:', { action, activePlayer, vsAI, asyncMode });

    // Async mode: enforce turn ownership
    if (asyncMode && !isMyTurn) {
      console.log('Blocked: not your turn in async mode');
      alert('Not your turn!');
      return;
    }

    const isLegal = checkLegal(action);
    console.log('Action legal check:', isLegal);
    if (!isLegal) {
      console.log('Blocked: illegal action');
      alert('Illegal action!');
      return;
    }

    console.log('Passed all checks, continuing...');

    // Async mode: Store action and check if both ready
    if (asyncMode) {
      const newPending = { ...pendingActions, [activePlayer]: action };
      setPendingActions(newPending);

      // If both actions are now ready, resolve the turn
      if (newPending.player1 && newPending.player2) {
        const turnActions: TurnActions = {
          playerActions: [
            { playerId: 'player1', action: newPending.player1 },
            { playerId: 'player2', action: newPending.player2 },
          ],
        };

        const newState = resolveTurn(gameState, turnActions);
        setGameState(newState);
        setActionHistory([...actionHistory, turnActions]);
        setPendingActions({});
        setActivePlayer('player1'); // Reset to player1 for next turn
      }

      return;
    }

    // Hotseat mode (or AI mode for player1): collect both actions before resolving
    const newPending = { ...pendingActions };
    newPending[activePlayer] = action;
    console.log('Setting pending actions:', newPending);
    setPendingActions(newPending);

    // In AI mode, don't switch to AI player - let the useEffect handle it
    if (vsAI && activePlayer === 'player1') {
      console.log('AI mode: switching to player2 and returning');
      // Player 1 submitted action, AI will respond via useEffect
      setActivePlayer('player2');
      return;
    }

    // Switch to other player if this player's action is recorded (hotseat only)
    if (activePlayer === 'player1' && !newPending.player2) {
      setActivePlayer('player2');
    } else if (activePlayer === 'player2' && !newPending.player1) {
      setActivePlayer('player1');
    }

    // If both actions are ready, resolve turn
    if (newPending.player1 && newPending.player2) {
      const turnActions: TurnActions = {
        playerActions: [
          { playerId: 'player1', action: newPending.player1 },
          { playerId: 'player2', action: newPending.player2 },
        ],
      };

      const newState = resolveTurn(gameState, turnActions);
      setGameState(newState);

      // Record action in history for replay
      setActionHistory([...actionHistory, turnActions]);

      setPendingActions({});
      setActivePlayer('player1');
    }
  };

  // AI Turn Handler
  useEffect(() => {
    console.log('AI Effect triggered:', {
      vsAI,
      activePlayer,
      aiThinking,
      hasPlayer2Action: !!pendingActions.player2,
      hasPlayer1Action: !!pendingActions.player1,
      gameOver: gameState.gameOver
    });

    if (!vsAI) {
      console.log('  → Skipping: vsAI is false');
      return;
    }
    if (gameState.gameOver) {
      console.log('  → Skipping: game is over');
      return;
    }
    if (aiThinking) {
      console.log('  → Skipping: AI already thinking');
      return;
    }
    if (activePlayer !== 'player2') {
      console.log('  → Skipping: activePlayer is not player2, it is:', activePlayer);
      return;
    }
    if (pendingActions.player2) {
      console.log('  → Skipping: player2 already has pending action');
      return;
    }

    console.log('✅ AI making move...');

    // AI's turn (Player 2)
    setAIThinking(true);

    // Delay AI decision for UX (feels more natural)
    setTimeout(() => {
      const aiAction = chooseAction(gameState, 'player2', aiDifficulty);
      console.log('AI chose action:', aiAction);

      // Need to read latest pendingActions
      setPendingActions(prev => {
        const newPending = { ...prev, player2: aiAction };

        // If both actions ready, resolve immediately
        if (newPending.player1) {
          console.log('Both actions ready, resolving turn');
          const turnActions: TurnActions = {
            playerActions: [
              { playerId: 'player1', action: newPending.player1 },
              { playerId: 'player2', action: aiAction },
            ],
          };

          const newState = resolveTurn(gameState, turnActions);
          setGameState(newState);
          setActionHistory(prev => [...prev, turnActions]);
          setActivePlayer('player1');
          return {}; // Clear pending actions
        }

        return newPending;
      });

      setAIThinking(false);
    }, 500); // 500ms delay for AI "thinking"
  }, [vsAI, gameState, activePlayer, pendingActions, aiThinking, aiDifficulty]);

  // Reset game
  const resetGame = () => {
    const newSeed = Date.now();
    setGameState(createInitialGameState(newSeed));
    setActionHistory([]);
    setPendingActions({});
    setActivePlayer('player1');
    setGameRecorded(false);
    setAIThinking(false);
    setFeedbackGiven(false);
  };

  // Reset stats
  const handleResetStats = () => {
    if (confirm('Reset all session stats? This cannot be undone.')) {
      resetStats();
      setStats(loadStats());
    }
  };

  // Render a single lane
  const renderLane = (lane: typeof player1.lanes[0], laneIndex: number) => {
    const statusClass = lane.busted ? 'lane-busted' : lane.locked ? 'lane-locked' : '';

    return (
      <div key={laneIndex} className={`lane ${statusClass} ${lane.shackled ? 'lane-shackled' : ''}`}>
        <div className="lane-header">
          Lane {String.fromCharCode(65 + laneIndex)} {/* A, B, C */}
          {/* Day 27: Status Effect Badges */}
          {lane.shackled && (
            <span className="status-badge shackled-badge" title="Shackled: Requires 20+ to Stand">
              ⛓️
            </span>
          )}
          {lane.hasBeenShackled && !lane.shackled && (
            <span className="status-badge history-badge" title="Previously shackled (cannot be shackled again)">
              ⛓
            </span>
          )}
        </div>
        <div className="lane-total">
          {lane.total}
          {lane.locked && ' 🔒'}
          {lane.busted && ' ❌'}
        </div>
        <div className="lane-cards">
          {lane.cards.map((card, idx) => (
            <span key={idx} className={card.rank === 'ASH' ? 'ash-card' : ''}>
              {card.rank === 'ASH' ? '🔥' : `${card.rank}${card.suit}`}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // Render player panel
  const renderPlayer = (
    player: typeof player1,
    playerName: string,
    isActive: boolean
  ) => {
    return (
      <div className={`player-panel ${isActive ? 'active' : ''}`}>
        <div className="player-header">
          <h2>{playerName}</h2>
          <div className="energy">⚡ Energy: {player.energy}</div>
          {/* Day 27: Status Effect Badge - Overheat */}
          {player.overheat > 0 && (
            <div className="overheat status-badge overheat-badge" title={`Overheat blocks Burn and Blind Hit for ${player.overheat} more turn(s)`}>
              🔥 Cooling: {player.overheat} turn{player.overheat > 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="lanes">
          {player.lanes.map((lane, idx) => renderLane(lane, idx))}
        </div>
        {pendingActions[player.id as 'player1' | 'player2'] && (
          <div className="pending-action">
            ✓ Action submitted: {pendingActions[player.id as 'player1' | 'player2']?.type}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app">
      <div className="game-container">
        {/* Day 30: Match Entry Clarity Banner */}
        {asyncMode && !gameState.gameOver && (
          <div className={`match-entry-banner ${isMyTurn ? 'your-turn' : 'waiting'} ${pendingActions[myPlayerRole] ? 'action-submitted' : ''}`}>
            {isMyTurn ? (
              pendingActions[myPlayerRole] ? (
                <div className="banner-content">
                  <span className="banner-icon">✓</span>
                  <span className="banner-text">Action Submitted — Waiting for Opponent</span>
                </div>
              ) : (
                <div className="banner-content">
                  <span className="banner-icon">▶</span>
                  <span className="banner-text">Your Turn</span>
                </div>
              )
            ) : (
              <div className="banner-content">
                <span className="banner-icon">⏳</span>
                <span className="banner-text">Waiting for Opponent</span>
              </div>
            )}
          </div>
        )}

        {/* Day 30: Match Restored Indicator */}
        {asyncMode && matchRestored && (
          <div className="match-restored-indicator">
            <span className="restored-icon">✓</span>
            <span className="restored-text">Match restored from replay</span>
          </div>
        )}

        {/* Day 30: URL Error State */}
        {asyncMode && urlError && (
          <div className="url-error-panel">
            <div className="error-header">⚠️ Invalid Match Link</div>
            <p className="error-message">{urlError}</p>
            <button 
              onClick={() => window.location.href = window.location.origin}
              className="start-new-btn"
            >
              Start New Match
            </button>
          </div>
        )}

        {/* AREA 1: Turn Number */}
        <div className="turn-header">
          <h1>MirrorMatch: Strategic 21</h1>
          <div className="turn-info">
            Turn {gameState.turnNumber}
            {gameState.gameOver && (
              <span className="game-over">
                {' '}GAME OVER - Winner: {gameState.winner || 'DRAW'}
              </span>
            )}
            {aiThinking && (
              <span className="ai-thinking"> 🤖 AI thinking...</span>
            )}
          </div>

          {/* AI Mode Controls */}
          <div className="game-mode-controls">
            <label className="mode-toggle">
              <input
                type="checkbox"
                checked={vsAI}
                onChange={(e) => {
                  setVsAI(e.target.checked);
                  resetGame();
                }}
                disabled={!gameState.gameOver && gameState.turnNumber > 1}
              />
              <span>vs AI</span>
            </label>

            {vsAI && (
              <select
                value={aiDifficulty}
                onChange={(e) => setAIDifficulty(e.target.value as AIDifficulty)}
                disabled={!gameState.gameOver && gameState.turnNumber > 1}
                className="difficulty-select"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            )}

            {/* Create Async Challenge */}
            {!asyncMode && !vsAI && gameState.turnNumber === 1 && (
              <button
                onClick={() => {
                  const match: EncodedMatch = {
                    seed: gameSeed,
                    actions: [],
                    pendingActions: {},
                    currentPlayer: 'player2', // Next player to act
                    version: 1,
                  };
                  const url = createShareableURL(match);
                  navigator.clipboard.writeText(url).then(() => {
                    alert('Challenge created! Link copied to share with opponent.\n\nYou are Player 1. Send the link to Player 2.');
                    // Navigate to Player 1's URL
                    const p1Match: EncodedMatch = {
                      seed: gameSeed,
                      actions: [],
                      pendingActions: {},
                      currentPlayer: 'player1',
                      version: 1,
                    };
                    window.location.href = createShareableURL(p1Match);
                  }).catch(() => {
                    prompt('Copy this link for Player 2:', url);
                  });
                }}
                className="create-challenge-btn"
              >
                🔗 Create Async Challenge
              </button>
            )}
          </div>

          {/* Auction Phase Banner */}
          {!gameState.gameOver && [4, 8].includes(gameState.turnNumber) && (
            <div className="auction-banner">
              <h2>🎯 DARK AUCTION</h2>
              <p>Bid energy for a powerful card. Loser gets Void Stone (shackled lane).</p>
            </div>
          )}
        </div>

        {/* AREA 2: Player Lanes */}
        <div className="players">
          {renderPlayer(player1, 'Player 1 (You)', activePlayer === 'player1')}
          {renderPlayer(player2, vsAI ? 'AI Opponent' : 'Player 2', activePlayer === 'player2')}
        </div>

        {/* AREA 3: Card Queue */}
        <div className="queue-section">
          <h3>Card Queue</h3>
          <div className="queue">
            {gameState.queue.map((card, idx) => (
              <div key={idx} className={`queue-card ${idx === 0 ? 'front' : ''}`}>
                {card.rank}{card.suit}
              </div>
            ))}
            {gameState.queue.length === 0 && <div className="queue-empty">Empty</div>}
          </div>
          <div className="deck-info">Deck: {gameState.deck.length} cards</div>
        </div>

        {/* AREA 4 & 5: Action Controls */}
        {!gameState.gameOver && (
          <div className="controls-section">
            {/* Day 24: Turn & State Clarity */}
            {asyncMode && (
              <div className="async-state-indicator">
                <div className={`turn-status ${isMyTurn ? 'your-turn' : 'opponent-turn'}`}>
                  {isMyTurn ? (
                    <>
                      <span className="status-icon">✓</span>
                      <span className="status-text">Your Turn</span>
                      {pendingActions[myPlayerRole] && (
                        <span className="action-submitted">• Action Submitted</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="status-icon">⏳</span>
                      <span className="status-text">Opponent's Turn</span>
                      <span className="waiting-hint">• Waiting for {activePlayer === 'player1' ? 'Player 1' : 'Player 2'}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Async Mode: Waiting for Opponent */}
            {asyncMode && !isMyTurn && (
              <div className="waiting-for-opponent">
                <h3>⏳ Waiting for Opponent</h3>
                <p>It's {activePlayer === 'player1' ? "Player 1's" : "Player 2's"} turn.</p>
                <p className="hint">Share the link with your opponent to continue.</p>
              </div>
            )}

            {/* Normal/AI Mode or Your Turn in Async */}
            {(!asyncMode || isMyTurn) && (
              <>
                {/* Hide controls when AI is thinking or when it's AI's turn */}
                {vsAI && activePlayer === 'player2' ? (
                  <div className="waiting-for-ai">
                    <h3>🤖 AI's Turn</h3>
                    <p>{aiThinking ? 'AI is thinking...' : 'Waiting for AI...'}</p>
                  </div>
                ) : (
                  <>
                    <div className="active-player-toggle">
                      <strong>Active Player: {activePlayer === 'player1' ? 'Player 1 (You)' : (vsAI ? 'AI' : 'Player 2')}</strong>
                      {!vsAI && !asyncMode && !pendingActions[activePlayer] && (
                        <button
                          onClick={() => setActivePlayer(activePlayer === 'player1' ? 'player2' : 'player1')}
                          className="toggle-btn"
                        >
                          Switch Player
                        </button>
                      )}
                    </div>

                    {/* Dynamic action rendering based on getLegalActions */}
                    {renderDynamicActions()}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Game Over Panel */}
        {gameState.gameOver && (
          <div className="game-container">
            {urlError && <div className="error-banner">{urlError}</div>}
            <div className="turn-header">
              <h2>🏁 Game Over</h2>
              {gameState.winner ? (
                <div className="winner-announcement">
                  {gameState.winner === 'player1' ? 'Player 1' : 'Player 2'} Wins!
                </div>
              ) : (
                <div className="draw-announcement">Draw</div>
              )}
            </div>

            {/* Lane-by-Lane Breakdown */}
            <div className="lane-breakdown">
              <h3>Lane-by-Lane Results</h3>
              <div className="lane-results">
                {[0, 1, 2].map(i => {
                  const outcome = analyzeLane(gameState.players[0].lanes[i], gameState.players[1].lanes[i]);
                  const laneName = String.fromCharCode(65 + i);
                  return (
                    <div key={i} className={`lane-result ${outcome.winner}`}>
                      <div className="lane-result-header">
                        <strong>Lane {laneName}</strong>
                        {outcome.winner === 'player1' && <span className="winner-badge">P1 ✓</span>}
                        {outcome.winner === 'player2' && <span className="winner-badge">P2 ✓</span>}
                        {outcome.winner === 'tie' && <span className="tie-badge">TIE</span>}
                      </div>
                      <div className="lane-result-scores">
                        P1: {outcome.p1Total} | P2: {outcome.p2Total}
                      </div>
                      <div className="lane-result-reason">{outcome.reason}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day 25: Post-Game Explanation Panel */}
            <div className="post-game-explanation">
              <h3>
                {gameState.winner === myPlayerRole && '🎉 You Win!'}
                {gameState.winner && gameState.winner !== myPlayerRole && '💔 You Lost'}
                {!gameState.winner && '🤝 Draw'}
              </h3>
              
              {/* Strategic Summary */}
              <div className="strategic-summary">
                <p>{generateStrategicSummary(gameState, asyncMode ? myPlayerRole : 'player1')}</p>
              </div>
              
              {/* Metrics Badges (Optional, lightweight) */}
              {!gameState.winner && (
                <div className="draw-metrics">
                  {(() => {
                    const diagnostics = analyzeDrawDiagnostics(
                      gameState, 
                      'player1', 
                      'player2', 
                      actionHistory.flatMap(turn => turn.playerActions.map(pa => ({ playerId: pa.playerId, action: pa.action })))
                    );
                    const viewerMetrics = myPlayerRole === 'player1' ? diagnostics.p1 : diagnostics.p2;
                    
                    return (
                      <>
                        {viewerMetrics.winThreats >= 2 && (
                          <span className="metric-badge high-pressure" title="You had multiple lanes close to winning">
                            ⚔️ High Pressure
                          </span>
                        )}
                        {viewerMetrics.energyRemaining >= 2 && (
                          <span className="metric-badge energy-remaining" title="You had energy remaining at game end">
                            ⚡ Energy: {viewerMetrics.energyRemaining}
                          </span>
                        )}
                        {viewerMetrics.forcedPasses > 0 && (
                          <span className="metric-badge forced-passes" title="Number of pass actions taken">
                            🚫 Passes: {viewerMetrics.forcedPasses}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Legacy game summary for non-async modes */}
            {!asyncMode && (
              <div className="game-over-explanation">
                <h3>Game Summary</h3>
                {explainGameEnd(gameState).map((explanation, idx) => (
                  <p key={idx} className="explanation-line">• {explanation}</p>
                ))}
              </div>
            )}

            {/* Skill Badge */}
            {(() => {
              const badge = detectSkillBadge(gameState, 'player1');
              if (badge) {
                return (
                  <div className="skill-badge-section">
                    <div className="skill-badge">{badge}</div>
                    <p className="badge-earned">Badge Earned!</p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Quick Feedback */}
            {!feedbackGiven && (
              <div className="feedback-section">
                <h3>Quick Feedback (Optional)</h3>
                <p className="feedback-prompt">How did this game feel?</p>
                <div className="feedback-buttons">
                  <button onClick={() => submitFeedback('fun')} className="feedback-btn fun">
                    😄 Fun
                  </button>
                  <button onClick={() => submitFeedback('confusing')} className="feedback-btn confusing">
                    🤔 Confusing
                  </button>
                  <button onClick={() => submitFeedback('frustrating')} className="feedback-btn frustrating">
                    😡 Frustrating
                  </button>
                  <button onClick={() => submitFeedback('thinking')} className="feedback-btn thinking">
                    🧠 Made me think
                  </button>
                </div>
              </div>
            )}

            {feedbackGiven && (
              <div className="feedback-thanks">
                ✓ Thanks for your feedback!
              </div>
            )}

            <div className="game-over-actions">
              <button onClick={resetGame} className="reset-btn">
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Day 27: Turn Resolution Summary + Auction Transparency */}
        {asyncMode && actionHistory.length > 0 && (
          <div className="move-history">
            <h3>📜 Turn History</h3>
            <div className="move-history-list">
              {actionHistory.map((turnActions, turnIndex) => {
                // Reconstruct state before and after this turn for summary
                const stateBeforeTurn = turnIndex === 0 
                  ? createInitialGameState(gameSeed)
                  : runReplay({ initialState: createInitialGameState(gameSeed), turns: actionHistory.slice(0, turnIndex) });
                const stateAfterTurn = runReplay({ initialState: createInitialGameState(gameSeed), turns: actionHistory.slice(0, turnIndex + 1) });
                
                const summary = generateTurnSummary(turnActions, turnIndex + 1, stateBeforeTurn, stateAfterTurn);
                
                // Day 30: Highlight latest turn
                const isLatestTurn = turnIndex === actionHistory.length - 1;
                
                return (
                  <div key={turnIndex} className={`history-turn ${summary.isAuction ? 'auction-turn' : ''} ${isLatestTurn ? 'latest-turn' : ''}`}>
                    <div className="history-turn-header">
                      <div className="history-turn-number">Turn {turnIndex + 1}</div>
                      {summary.isAuction && <span className="auction-label">🎯 Auction</span>}
                    </div>
                    
                    {summary.isAuction && summary.auctionDetails ? (
                      <div className="auction-summary">
                        <div className="auction-bids">
                          <div className="bid-line">You: {summary.auctionDetails.myBid} energy</div>
                          <div className="bid-line">Opponent: {summary.auctionDetails.opponentBid} energy</div>
                        </div>
                        <div className="auction-result">
                          {summary.result}
                        </div>
                        {summary.auctionDetails.tiebreak && (
                          <div className="auction-tiebreak">
                            {summary.auctionDetails.tiebreak}
                          </div>
                        )}
                        <div className="auction-effect">
                          Lane {String.fromCharCode(65 + summary.auctionDetails.loserLane)} shackled (Void Stone)
                        </div>
                      </div>
                    ) : (
                      <div className="turn-summary">
                        <div className="action-line">• You: {summary.myAction}</div>
                        <div className="action-line">• Opponent: {summary.opponentAction}</div>
                        {summary.result && (
                          <div className="result-line">→ {summary.result}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legacy Day 24: Move History for non-async (deprecated, keeping for compatibility) */}
        {!asyncMode && actionHistory.length > 0 && (
          <div className="move-history">
            <h3>📜 Move History</h3>
            <div className="move-history-list">
              {actionHistory.map((turnActions, turnIndex) => (
                <div key={turnIndex} className="history-turn">
                  <div className="history-turn-number">Turn {turnIndex + 1}</div>
                  <div className="history-actions">
                    {turnActions.playerActions.map((pa) => {
                      const action = pa.action;
                      let actionDesc = '';
                      
                      if (action.type === 'take') {
                        actionDesc = `Take → Lane ${String.fromCharCode(65 + action.targetLane)}`;
                      } else if (action.type === 'burn') {
                        actionDesc = 'Burn';
                      } else if (action.type === 'stand') {
                        actionDesc = `Stand Lane ${String.fromCharCode(65 + action.targetLane)}`;
                      } else if (action.type === 'pass') {
                        actionDesc = 'Pass';
                      } else if (action.type === 'bid') {
                        actionDesc = `Bid ${action.bidAmount}`;
                      } else if (action.type === 'blind_hit') {
                        actionDesc = `Blind Hit → Lane ${String.fromCharCode(65 + action.targetLane)}`;
                      }
                      
                      return (
                        <div key={pa.playerId} className="history-action">
                          <span className="history-player">{pa.playerId === 'player1' ? 'P1' : 'P2'}:</span>
                          <span className="history-action-desc">{actionDesc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Day 24: Smart Match Hub - Persistent URL display */}
        {asyncMode && (
          <div className="match-hub">
            <h3>📋 {gameState.gameOver ? 'Final Match Result' : 'Your Match Link'}</h3>
            <div className="match-hub-content">
              <div className="match-url-display">
                <input
                  type="text"
                  value={(() => {
                    // Auto-generate current match URL
                    const nextPlayer: 'player1' | 'player2' = activePlayer === 'player1' ? 'player2' : 'player1';
                    const match: EncodedMatch = {
                      seed: gameSeed,
                      actions: actionHistory,
                      pendingActions: pendingActions,
                      currentPlayer: nextPlayer,
                      version: 1,
                    };
                    return createShareableURL(match);
                  })()}
                  readOnly
                  className="match-url-input"
                />
              </div>
              <button
                onClick={() => {
                  const nextPlayer: 'player1' | 'player2' = activePlayer === 'player1' ? 'player2' : 'player1';
                  const match: EncodedMatch = {
                    seed: gameSeed,
                    actions: actionHistory,
                    pendingActions: pendingActions,
                    currentPlayer: nextPlayer,
                    version: 1,
                  };
                  const url = createShareableURL(match);
                  navigator.clipboard.writeText(url).then(() => {
                    alert(gameState.gameOver 
                      ? 'Final match link copied! Share this to show the result.'
                      : 'Match link copied to clipboard!');
                  }).catch(() => {
                    prompt('Copy this link:', url);
                  });
                }}
                className="copy-link-btn"
              >
                📋 {gameState.gameOver ? 'Share Result' : 'Copy Link'}
              </button>
              <p className="match-hub-hint">
                {gameState.gameOver 
                  ? '🏁 Share this link with your opponent to show the final result.'
                  : '💡 This link updates automatically. Share anytime to let your opponent see the current game state.'}
              </p>
            </div>
          </div>
        )}

        {/* Session Stats Panel */}
        <div className="stats-panel">
          <h3>📊 Session Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-label">Games Played</div>
              <div className="stat-value">{stats.games}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Player 1 Wins</div>
              <div className="stat-value">{stats.p1Wins}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Player 2 Wins</div>
              <div className="stat-value">{stats.p2Wins}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Draws</div>
              <div className="stat-value">{stats.draws}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Avg Turns/Game</div>
              <div className="stat-value">
                {stats.games > 0 ? (stats.totalTurns / stats.games).toFixed(1) : '0.0'}
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Draw Rate</div>
              <div className="stat-value">
                {stats.games > 0 ? ((stats.draws / stats.games) * 100).toFixed(1) : '0.0'}%
              </div>
            </div>
          </div>

          {/* Draw Reasons Breakdown */}
          {stats.draws > 0 && (
            <div className="draw-breakdown">
              <h4>Draw Types</h4>
              <div className="draw-reasons">
                {Object.entries(stats.drawReasons)
                  .filter(([_, count]) => count > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([reason, count]) => (
                    <div key={reason} className="draw-reason-item">
                      <span className="draw-reason-label">
                        {reason.replace(/_/g, ' ')}
                      </span>
                      <span className="draw-reason-count">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {stats.games > 0 && (
            <button onClick={handleResetStats} className="reset-stats-btn">
              Reset Stats
            </button>
          )}
        </div>

        {/* Day 27: Desync Confidence Signal */}
        {asyncMode && (
          <div className="replay-confidence-footer">
            <span className="confidence-indicator">
              State verified from replay (deterministic) ✓
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
