/**
 * MirrorMatch UI - Minimal Local Play
 * Engine is treated as a BLACK BOX - no modifications
 */

import { useState, useEffect } from 'react';
import { 
  createInitialGameState, 
  isActionLegal,
  resolveTurn 
} from '../../engine/src';

import type { 
  GameState, 
  PlayerAction, 
  TurnActions 
} from '../../engine/src';

import { chooseAIAction } from './ai';
import type { AIDifficulty } from './ai';

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
      return JSON.parse(stored);
    } catch {
      // Invalid data, reset
    }
  }
  return { games: 0, p1Wins: 0, p2Wins: 0, draws: 0, totalTurns: 0 };
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

function getEndReason(state: GameState): string {
  // Check if all lanes are locked
  const allLanesLocked = state.players.every(p => p.lanes.every(l => l.locked));
  if (allLanesLocked) {
    return 'All lanes are locked. No legal actions remain.';
  }

  // Check if deck and queue are exhausted
  if (state.deck.length === 0 && state.queue.length === 0) {
    return 'Deck and queue are exhausted. No cards remain.';
  }

  return 'Victory condition reached.';
}

function getWinnerExplanation(state: GameState): string {
  if (!state.winner) {
    return 'Both players achieved equal scores across all lanes.';
  }

  const winnerName = state.winner === 'player1' ? 'Player 1' : 'Player 2';
  return `${winnerName} won 2 out of 3 lanes.`;
}

// ============================================================================
// Lane Outcome Analysis
// ============================================================================

type LaneOutcome = {
  winner: 'player1' | 'player2' | 'tie';
  reason: string;
  p1Total: number;
  p2Total: number;
};

function analyzeLane(p1Lane: typeof player1.lanes[0], p2Lane: typeof player2.lanes[0]): LaneOutcome {
  const p1Total = p1Lane.total;
  const p2Total = p2Lane.total;
  
  // Both bust = tie
  if (p1Lane.busted && p2Lane.busted) {
    return {
      winner: 'tie',
      reason: 'Both players busted',
      p1Total,
      p2Total,
    };
  }
  
  // P1 busted = P2 wins
  if (p1Lane.busted) {
    return {
      winner: 'player2',
      reason: 'Player 1 busted',
      p1Total,
      p2Total,
    };
  }
  
  // P2 busted = P1 wins
  if (p2Lane.busted) {
    return {
      winner: 'player1',
      reason: 'Player 2 busted',
      p1Total,
      p2Total,
    };
  }
  
  // Check for exact 21
  if (p1Total === 21 && p2Total !== 21) {
    return {
      winner: 'player1',
      reason: 'Player 1 hit exact 21',
      p1Total,
      p2Total,
    };
  }
  
  if (p2Total === 21 && p1Total !== 21) {
    return {
      winner: 'player2',
      reason: 'Player 2 hit exact 21',
      p1Total,
      p2Total,
    };
  }
  
  if (p1Total === 21 && p2Total === 21) {
    return {
      winner: 'tie',
      reason: 'Both hit exact 21',
      p1Total,
      p2Total,
    };
  }
  
  // Neither busted - compare totals
  if (p1Total > p2Total) {
    return {
      winner: 'player1',
      reason: `Player 1 closer to 21 (${p1Total} > ${p2Total})`,
      p1Total,
      p2Total,
    };
  }
  
  if (p2Total > p1Total) {
    return {
      winner: 'player2',
      reason: `Player 2 closer to 21 (${p2Total} > ${p1Total})`,
      p1Total,
      p2Total,
    };
  }
  
  // Equal totals = tie
  return {
    winner: 'tie',
    reason: `Tied at ${p1Total}`,
    p1Total,
    p2Total,
  };
}

// ============================================================================
// Draw Classification
// ============================================================================

type DrawReason =
  | 'equal_lanes'
  | 'tiebreaker_equal'
  | 'all_locked'
  | 'deck_exhausted';

function classifyDraw(state: GameState): { type: DrawReason; explanation: string } {
  if (!state.winner && state.gameOver) {
    const p1 = state.players[0];
    const p2 = state.players[1];
    
    // Analyze all lanes
    const outcomes = [
      analyzeLane(p1.lanes[0], p2.lanes[0]),
      analyzeLane(p1.lanes[1], p2.lanes[1]),
      analyzeLane(p1.lanes[2], p2.lanes[2]),
    ];
    
    const p1Wins = outcomes.filter(o => o.winner === 'player1').length;
    const p2Wins = outcomes.filter(o => o.winner === 'player2').length;
    const ties = outcomes.filter(o => o.winner === 'tie').length;
    
    // Case 1: Each won 1 lane, 1 tie
    if (p1Wins === 1 && p2Wins === 1 && ties === 1) {
      return {
        type: 'equal_lanes',
        explanation: 'Each player won 1 lane, with 1 lane tied. This is a perfect equilibrium.',
      };
    }
    
    // Case 2: Each won 1 lane, tiebreaker equal
    if (p1Wins === 1 && p2Wins === 1 && ties === 0) {
      return {
        type: 'tiebreaker_equal',
        explanation: 'Each player won 1 lane. Tiebreaker compared winning lane values, which were equal.',
      };
    }
    
    // Case 3: All lanes tied
    if (ties === 3) {
      return {
        type: 'equal_lanes',
        explanation: 'All three lanes ended in ties. Perfect symmetry.',
      };
    }
    
    // Case 4: Game ended due to conditions
    if (state.deck.length === 0 && state.queue.length === 0) {
      return {
        type: 'deck_exhausted',
        explanation: 'Deck exhausted with lanes in tied state.',
      };
    }
    
    if (p1.lanes.every(l => l.locked) && p2.lanes.every(l => l.locked)) {
      return {
        type: 'all_locked',
        explanation: 'All lanes locked with equal outcomes.',
      };
    }
  }
  
  return {
    type: 'equal_lanes',
    explanation: 'Game reached a solved terminal state with equal scores.',
  };
}

function App() {
  const [gameSeed] = useState<number>(() => Date.now());
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState(gameSeed));
  const [actionHistory, setActionHistory] = useState<TurnActions[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingActions>({});
  const [activePlayer, setActivePlayer] = useState<'player1' | 'player2'>('player1');
  const [stats, setStats] = useState<SessionStats>(loadStats);
  const [gameRecorded, setGameRecorded] = useState(false);
  
  // AI Mode
  const [vsAI, setVsAI] = useState<boolean>(false);
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('normal');
  const [aiThinking, setAIThinking] = useState<boolean>(false);
  
  // Feedback
  const [feedbackGiven, setFeedbackGiven] = useState<boolean>(false);

  const player1 = gameState.players[0];
  const player2 = gameState.players[1];
  
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

  // Check if active player has any legal actions
  const hasLegalActions = (playerId: string): boolean => {
    if (gameState.gameOver) return false;

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    // Check if any Take action is legal
    for (let lane = 0; lane < player.lanes.length; lane++) {
      if (isActionLegal(gameState, playerId, { type: 'take', targetLane: lane })) {
        return true;
      }
    }

    // Check if Burn is legal
    if (isActionLegal(gameState, playerId, { type: 'burn' })) {
      return true;
    }

    // Check if any Stand action is legal
    for (let lane = 0; lane < player.lanes.length; lane++) {
      if (isActionLegal(gameState, playerId, { type: 'stand', targetLane: lane })) {
        return true;
      }
    }

    return false;
  };

  // Auto-pass if active player has no legal actions and resolve turn when both actions ready
  useEffect(() => {
    if (gameState.gameOver) return;

    const activeHasActions = hasLegalActions(activePlayer);
    const otherPlayer = activePlayer === 'player1' ? 'player2' : 'player1';

    // If active player has no actions but hasn't submitted yet
    if (!activeHasActions && !pendingActions[activePlayer]) {
      // Auto-submit a Stand action on first available lane (will be validated and may fail)
      const player = gameState.players.find(p => p.id === activePlayer);
      if (player) {
        const firstUnlockedLane = player.lanes.findIndex(l => !l.locked);
        if (firstUnlockedLane >= 0) {
          // Try to stand on first unlocked lane
          const standAction: PlayerAction = { type: 'stand', targetLane: firstUnlockedLane };
          const newPending = { ...pendingActions, [activePlayer]: standAction };
          setPendingActions(newPending);
          
          // If both actions are now ready, resolve the turn
          if (newPending.player1 && newPending.player2) {
            // Delay slightly to allow state to update
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
              setActivePlayer('player1');
            }, 0);
          } else {
            // Switch to other player if they haven't submitted yet
            if (!newPending[otherPlayer]) {
              setActivePlayer(otherPlayer);
            }
          }
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
    if (!checkLegal(action)) {
      alert('Illegal action!');
      return;
    }

    const newPending = { ...pendingActions };
    newPending[activePlayer] = action;
    setPendingActions(newPending);

    // Switch to other player if this player's action is recorded
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
    if (!vsAI || gameState.gameOver || aiThinking) return;
    if (activePlayer !== 'player2' || pendingActions.player2) return;
    
    // AI's turn (Player 2)
    setAIThinking(true);
    
    // Delay AI decision for UX (feels more natural)
    setTimeout(() => {
      const aiAction = chooseAIAction(gameState, 'player2', aiDifficulty);
      const newPending = { ...pendingActions, player2: aiAction };
      setPendingActions(newPending);
      
      // If both actions ready, resolve immediately
      if (newPending.player1) {
        const turnActions: TurnActions = {
          playerActions: [
            { playerId: 'player1', action: newPending.player1 },
            { playerId: 'player2', action: aiAction },
          ],
        };
        
        const newState = resolveTurn(gameState, turnActions);
        setGameState(newState);
        setActionHistory([...actionHistory, turnActions]);
        setPendingActions({});
        setActivePlayer('player1');
      }
      
      setAIThinking(false);
    }, 500); // 500ms delay for AI "thinking"
  }, [vsAI, gameState, activePlayer, pendingActions, aiThinking, aiDifficulty, actionHistory]);

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
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
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
            <div className="active-player-toggle">
              <strong>Active Player: {activePlayer === 'player1' ? 'Player 1 (You)' : (vsAI ? 'AI' : 'Player 2')}</strong>
              {!vsAI && !pendingActions[activePlayer] && (
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
              <h3>Why did the game end?</h3>
              <p className="end-reason">{getEndReason(gameState)}</p>
              <p className="turn-count">Game lasted {gameState.turnNumber - 1} turns.</p>
            </div>

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
