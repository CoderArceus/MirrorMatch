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
  // AI
  chooseAction
} from '../../engine/src';

import type {
  GameState,
  PlayerAction,
  TurnActions,
  LaneState,
  DrawReason,
  SkillBadge,
  AIDifficulty
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

function clearReplays(): void {
  localStorage.removeItem(REPLAYS_KEY);
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

function loadFeedback(): Feedback[] {
  const stored = localStorage.getItem(FEEDBACK_KEY);
  return stored ? JSON.parse(stored) : [];
}

function clearFeedback(): void {
  localStorage.removeItem(FEEDBACK_KEY);
}

// ============================================================================
// Replay Engine: Deterministic State Reconstruction
// ============================================================================

function replayGame(seed: number, actions: TurnActions[]): GameState {
  let state = createInitialGameState(seed);

  for (const turnActions of actions) {
    state = resolveTurn(state, turnActions);

    if (state.gameOver) {
      break;
    }
  }

  return state;
}

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

  const player1 = gameState.players[0];
  const player2 = gameState.players[1];

  // Check if it's my turn in async mode
  const isMyTurn = !asyncMode || (activePlayer === myPlayerRole);

  // Validate URL match on mount
  useEffect(() => {
    if (urlMatch && urlMatch.version !== 1) {
      setUrlError('Invalid match version. Please request a new link.');
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
  const renderLane = (lane: typeof player1.lanes[0], laneIndex: number, playerName: string) => {
    const statusClass = lane.busted ? 'lane-busted' : lane.locked ? 'lane-locked' : '';

    return (
      <div key={laneIndex} className={`lane ${statusClass}`}>
        <div className="lane-header">
          Lane {String.fromCharCode(65 + laneIndex)} {/* A, B, C */}
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
        </div>
        <div className="lanes">
          {player.lanes.map((lane, idx) => renderLane(lane, idx, playerName))}
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

                    <div className="actions">
                      <div className="action-group">
                        <h4>Take (add card to lane)</h4>
                        <div className="lane-buttons">
                          {[0, 1, 2].map(lane => (
                            <button
                              key={lane}
                              onClick={() => selectAction({ type: 'take', targetLane: lane })}
                              disabled={!checkLegal({ type: 'take', targetLane: lane })}
                              className="action-btn"
                            >
                              Lane {String.fromCharCode(65 + lane)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="action-group">
                        <h4>Burn (destroy front card)</h4>
                        <button
                          onClick={() => selectAction({ type: 'burn' })}
                          disabled={!checkLegal({ type: 'burn' })}
                          className="action-btn burn"
                        >
                          🔥 Burn (1 energy)
                        </button>
                      </div>

                      <div className="action-group">
                        <h4>Stand (lock lane)</h4>
                        <div className="lane-buttons">
                          {[0, 1, 2].map(lane => (
                            <button
                              key={lane}
                              onClick={() => selectAction({ type: 'stand', targetLane: lane })}
                              disabled={!checkLegal({ type: 'stand', targetLane: lane })}
                              className="action-btn stand"
                            >
                              Lane {String.fromCharCode(65 + lane)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Game Over Panel */}
        {gameState.gameOver && (
          <div className="game-over-panel">
            <div className="game-over-header">
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

            {/* Draw Diagnostics */}
            {!gameState.winner && (
              <div className="draw-diagnostics">
                <h3>🤝 Draw Analysis</h3>
                <p className="draw-classification">{classifyDraw(gameState).explanation}</p>
                <p className="draw-note">
                  This represents a <strong>solved equilibrium</strong> state where neither player could force an advantage.
                </p>
              </div>
            )}

            <div className="game-over-explanation">
              <h3>Game Summary</h3>
              {explainGameEnd(gameState).map((explanation, idx) => (
                <p key={idx} className="explanation-line">• {explanation}</p>
              ))}
            </div>

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

        {/* Async PvP: Share Challenge Link */}
        {asyncMode && !gameState.gameOver && isMyTurn && (
          <div className="share-challenge">
            <button
              onClick={() => {
                // Determine next player
                const nextPlayer: 'player1' | 'player2' = activePlayer === 'player1' ? 'player2' : 'player1';
                const match: EncodedMatch = {
                  seed: gameSeed,
                  actions: actionHistory,
                  pendingActions: pendingActions, // Include pending actions
                  currentPlayer: nextPlayer,
                  version: 1,
                };
                const url = createShareableURL(match);
                navigator.clipboard.writeText(url).then(() => {
                  alert(`Challenge link copied! Send it to ${nextPlayer === 'player1' ? 'Player 1' : 'Player 2'}.`);
                }).catch(() => {
                  prompt('Copy this link:', url);
                });
              }}
              className="share-btn"
            >
              📋 Copy Challenge Link
            </button>
            <p className="share-hint">Share this link after making your move</p>
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
      </div>
    </div>
  );
}

export default App;
