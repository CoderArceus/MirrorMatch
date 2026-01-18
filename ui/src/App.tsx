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

function App() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState(Date.now()));
  const [pendingActions, setPendingActions] = useState<PendingActions>({});
  const [activePlayer, setActivePlayer] = useState<'player1' | 'player2'>('player1');
  const [stats, setStats] = useState<SessionStats>(loadStats);
  const [gameRecorded, setGameRecorded] = useState(false);

  const player1 = gameState.players[0];
  const player2 = gameState.players[1];

  // Record game stats when it ends (only once)
  useEffect(() => {
    if (gameState.gameOver && !gameRecorded) {
      recordGame(gameState);
      setStats(loadStats());
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

  // Auto-pass if active player has no legal actions
  useEffect(() => {
    if (gameState.gameOver) return;

    const activeHasActions = hasLegalActions(activePlayer);
    const otherPlayer = activePlayer === 'player1' ? 'player2' : 'player1';
    const otherHasActions = hasLegalActions(otherPlayer);

    // If active player has no actions but hasn't submitted yet
    if (!activeHasActions && !pendingActions[activePlayer]) {
      // Auto-submit a Stand action on first available lane (will be validated and may fail)
      const player = gameState.players.find(p => p.id === activePlayer);
      if (player) {
        const firstUnlockedLane = player.lanes.findIndex(l => !l.locked);
        if (firstUnlockedLane >= 0) {
          // Try to stand on first unlocked lane
          const standAction: PlayerAction = { type: 'stand', targetLane: firstUnlockedLane };
          setPendingActions({ ...pendingActions, [activePlayer]: standAction });
          
          // Switch to other player
          if (!pendingActions[otherPlayer]) {
            setActivePlayer(otherPlayer);
          }
        }
      }
    }

    // If both players have no actions and the game isn't over, force resolution
    if (!activeHasActions && !otherHasActions && (!pendingActions.player1 || !pendingActions.player2)) {
      // Both players stuck - this shouldn't happen with proper validators, but handle it
      console.warn('Both players have no legal actions - game should have ended');
    }
  }, [gameState, activePlayer, pendingActions]);

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
      setPendingActions({});
      setActivePlayer('player1');
    }
  };

  // Reset game
  const resetGame = () => {
    setGameState(createInitialGameState(Date.now()));
    setPendingActions({});
    setActivePlayer('player1');
    setGameRecorded(false);
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
          </div>
        </div>

        {/* AREA 2: Player Lanes */}
        <div className="players">
          {renderPlayer(player1, 'Player 1', activePlayer === 'player1')}
          {renderPlayer(player2, 'Player 2', activePlayer === 'player2')}
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
              <strong>Active Player: {activePlayer === 'player1' ? 'Player 1' : 'Player 2'}</strong>
              {!pendingActions[activePlayer] && (
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

            <div className="game-over-explanation">
              <h3>Why did the game end?</h3>
              <p className="end-reason">{getEndReason(gameState)}</p>
              <p className="winner-reason">{getWinnerExplanation(gameState)}</p>
              <p className="turn-count">Game lasted {gameState.turnNumber - 1} turns.</p>
            </div>

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
