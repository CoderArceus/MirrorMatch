/**
 * MirrorMatch UI - Minimal Local Play
 * Engine is treated as a BLACK BOX - no modifications
 */

import { useState } from 'react';
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

function App() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState(Date.now()));
  const [pendingActions, setPendingActions] = useState<PendingActions>({});
  const [activePlayer, setActivePlayer] = useState<'player1' | 'player2'>('player1');

  const player1 = gameState.players[0];
  const player2 = gameState.players[1];

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

        {gameState.gameOver && (
          <div className="game-over-controls">
            <button onClick={resetGame} className="reset-btn">
              New Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
