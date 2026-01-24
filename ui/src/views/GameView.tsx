/**
 * GameView - Unified controls, modern design matching welcome page
 */

import React, { useState, useEffect } from 'react';
import type { GameState, PlayerAction, TurnActions, AIDifficulty } from '../../../engine/src';
import { getLegalActions } from '../../../engine/src';
import './GameView.css';

interface GameViewProps {
  gameState: GameState;
  playMode: 'local' | 'ai' | 'async';
  aiDifficulty: AIDifficulty;
  aiThinking: boolean;
  pendingP1: PlayerAction | null;
  pendingP2: PlayerAction | null;
  history: TurnActions[];
  onAction: (player: 'player1' | 'player2', action: PlayerAction) => void;
  onQuit: () => void;
}

export const GameView: React.FC<GameViewProps> = ({
  gameState,
  playMode,
  aiDifficulty,
  aiThinking,
  pendingP1,
  pendingP2,
  history,
  onAction,
  onQuit,
}) => {
  // Auction state
  const [bid, setBid] = useState(0);
  const [voidLane, setVoidLane] = useState(0);

  const p1 = gameState.players[0];
  const p2 = gameState.players[1];
  const p1Actions = getLegalActions(gameState, 'player1');
  const p2Actions = getLegalActions(gameState, 'player2');
  
  // Check if auction phase
  const isAuctionTurn = p1Actions.some(a => a.type === 'bid');

  // Determine active player for unified controls
  // In local mode: P1 goes first, then P2
  // In AI mode: only P1
  const activePlayer: 'player1' | 'player2' = 
    playMode === 'ai' ? 'player1' :
    !pendingP1 ? 'player1' : 'player2';
  
  const activePlayerState = activePlayer === 'player1' ? p1 : p2;
  const activeActions = activePlayer === 'player1' ? p1Actions : p2Actions;
  const activePending = activePlayer === 'player1' ? pendingP1 : pendingP2;

  // Reset auction state when active player changes
  useEffect(() => {
    setBid(0);
    const validLane = activePlayerState.lanes.findIndex(l => !l.hasBeenShackled);
    setVoidLane(validLane >= 0 ? validLane : 0);
  }, [activePlayer, activePlayerState.lanes]);

  // Auto-pass
  useEffect(() => {
    if (gameState.gameOver) return;
    
    if (!pendingP1 && p1Actions.length === 1 && p1Actions[0].type === 'pass') {
      onAction('player1', { type: 'pass' });
    }
    
    if (playMode === 'local' && pendingP1 && !pendingP2 && p2Actions.length === 1 && p2Actions[0].type === 'pass') {
      onAction('player2', { type: 'pass' });
    }
  }, [gameState, p1Actions, p2Actions, pendingP1, pendingP2, playMode, onAction]);

  const getSuitColor = (suit: string) => suit === '♥' || suit === '♦' ? 'red' : 'black';

  const getValidVoidLanes = () => {
    return activePlayerState.lanes.map((l, i) => ({ index: i, valid: !l.hasBeenShackled }));
  };

  const submitBid = () => {
    onAction(activePlayer, { type: 'bid', bidAmount: bid, potentialVoidStoneLane: voidLane });
  };

  const filterActions = (actions: PlayerAction[]) => actions.filter(a => a.type !== 'pass');

  // Render lane
  const renderLane = (lane: typeof p1.lanes[0], index: number) => {
    const classes = ['lane', lane.busted && 'busted', lane.locked && 'locked', lane.shackled && 'shackled'].filter(Boolean).join(' ');

    return (
      <div key={index} className={classes}>
        <div className="lane-header">
          <span className="lane-label">{String.fromCharCode(65 + index)}</span>
          {(lane.shackled || lane.locked || lane.busted) && (
            <span className="lane-badge">
              {lane.busted ? '💥' : lane.shackled ? '⛓️' : '🔒'}
            </span>
          )}
        </div>
        <div className={`lane-total ${lane.busted ? 'bust' : lane.total === 21 ? 'blackjack' : ''}`}>
          {lane.busted ? '💀' : lane.total}
        </div>
        <div className="lane-cards">
          {lane.cards.length === 0 ? (
            <span className="empty-lane">—</span>
          ) : (
            lane.cards.map((card, ci) => (
              <span key={ci} className={`card-chip ${card.rank === 'ASH' ? 'ash' : getSuitColor(card.suit)}`}>
                {card.rank === 'ASH' ? '🔥' : `${card.rank}${card.suit}`}
              </span>
            ))
          )}
        </div>
      </div>
    );
  };

  // Render unified controls
  const renderControls = () => {
    // Both players ready - waiting for turn resolution
    if (playMode === 'local' && pendingP1 && pendingP2) {
      return (
        <div className="controls-status">
          <span className="status-icon">⏳</span>
          <span>Resolving turn...</span>
        </div>
      );
    }

    // AI thinking
    if (aiThinking) {
      return (
        <div className="controls-status ai">
          <span className="spinner"></span>
          <span>AI is thinking...</span>
        </div>
      );
    }

    // Game over
    if (gameState.gameOver) {
      return null;
    }

    // Active player already submitted (waiting for other in local)
    if (activePending) {
      return (
        <div className="controls-status ready">
          <span className="status-icon">✓</span>
          <span>{activePlayer === 'player1' ? 'Player 1' : 'Player 2'} ready - waiting...</span>
        </div>
      );
    }

    const filteredActions = filterActions(activeActions);

    // No actions (auto-pass will handle)
    if (filteredActions.length === 0) {
      return (
        <div className="controls-status">
          <span className="status-icon">⏳</span>
          <span>No actions available...</span>
        </div>
      );
    }

    // Auction controls
    if (isAuctionTurn) {
      const validLanes = getValidVoidLanes();
      return (
        <div className="controls-auction">
          <div className="auction-header">
            <span className="auction-badge">🎯 Dark Auction</span>
            <span className="auction-player">{activePlayer === 'player1' ? 'Player 1' : 'Player 2'}</span>
          </div>

          <div className="auction-fields">
            <div className="auction-field">
              <label>Energy Bid</label>
              <div className="chip-group">
                {Array.from({ length: activePlayerState.energy + 1 }, (_, i) => (
                  <button
                    key={i}
                    className={`chip ${bid === i ? 'selected' : ''}`}
                    onClick={() => setBid(i)}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div className="auction-field">
              <label>Void Lane (if lose)</label>
              <div className="chip-group">
                {validLanes.map(({ index, valid }) => (
                  <button
                    key={index}
                    className={`chip ${voidLane === index ? 'selected' : ''} ${!valid ? 'invalid' : ''}`}
                    onClick={() => valid && setVoidLane(index)}
                    disabled={!valid}
                  >
                    {String.fromCharCode(65 + index)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button className="submit-btn" onClick={submitBid}>
            Submit Bid ({bid} ⚡)
          </button>
        </div>
      );
    }

    // Regular controls
    const takes = filteredActions.filter(a => a.type === 'take') as Array<{ type: 'take'; targetLane: number }>;
    const burn = filteredActions.find(a => a.type === 'burn');
    const stands = filteredActions.filter(a => a.type === 'stand') as Array<{ type: 'stand'; targetLane: number }>;
    const blindHits = filteredActions.filter(a => a.type === 'blind_hit') as Array<{ type: 'blind_hit'; targetLane: number }>;

    return (
      <div className="controls-actions">
        <div className="controls-player">
          {activePlayer === 'player1' ? 'Player 1' : 'Player 2'}'s Turn
        </div>

        <div className="action-groups">
          {takes.length > 0 && (
            <div className="action-group take">
              <div className="group-header">
                <span className="group-icon">📥</span>
                <span className="group-name">Take</span>
              </div>
              <div className="group-buttons">
                {takes.map(a => (
                  <button
                    key={a.targetLane}
                    className="action-btn"
                    onClick={() => onAction(activePlayer, a)}
                  >
                    {String.fromCharCode(65 + a.targetLane)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {burn && (
            <div className="action-group burn">
              <button className="action-btn wide" onClick={() => onAction(activePlayer, burn)}>
                <span className="group-icon">🔥</span>
                <span className="group-name">Burn</span>
                <span className="cost">-1⚡</span>
              </button>
            </div>
          )}

          {stands.length > 0 && (
            <div className="action-group stand">
              <div className="group-header">
                <span className="group-icon">🔒</span>
                <span className="group-name">Stand</span>
              </div>
              <div className="group-buttons">
                {stands.map(a => (
                  <button
                    key={a.targetLane}
                    className="action-btn"
                    onClick={() => onAction(activePlayer, a)}
                  >
                    {String.fromCharCode(65 + a.targetLane)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {blindHits.length > 0 && (
            <div className="action-group blind">
              <div className="group-header">
                <span className="group-icon">🎲</span>
                <span className="group-name">Blind Hit</span>
              </div>
              <div className="group-buttons">
                {blindHits.map(a => (
                  <button
                    key={a.targetLane}
                    className="action-btn"
                    onClick={() => onAction(activePlayer, a)}
                  >
                    {String.fromCharCode(65 + a.targetLane)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="game-view">
      {/* Background */}
      <div className="game-bg">
        <div className="bg-orb orb-1"></div>
        <div className="bg-orb orb-2"></div>
      </div>

      {/* Header */}
      <header className="game-header">
        <button className="header-btn" onClick={onQuit}>← Exit</button>
        <div className="turn-display">
          <span className="turn-label">Turn</span>
          <span className="turn-number">{gameState.turnNumber}</span>
          {isAuctionTurn && <span className="auction-tag">🎯</span>}
        </div>
        <div className="mode-display">
          {playMode === 'ai' && `🤖 ${aiDifficulty}`}
          {playMode === 'local' && '👥 Local'}
          {playMode === 'async' && '🔗 Async'}
        </div>
      </header>

      {/* Main Content */}
      <main className="game-content">
        {/* Player 1 Board */}
        <section className={`player-board ${activePlayer === 'player1' && !activePending ? 'active' : ''} ${pendingP1 ? 'ready' : ''}`}>
          <div className="board-header">
            <h2>Player 1</h2>
            <div className="player-stats">
              <span className="stat energy">⚡ {p1.energy}</span>
              {p1.overheat > 0 && <span className="stat overheat">🌡️ {p1.overheat}</span>}
            </div>
          </div>
          <div className="lanes">
            {p1.lanes.map((lane, i) => renderLane(lane, i))}
          </div>
        </section>

        {/* Queue */}
        <section className="queue-panel">
          <div className="queue-header">Queue</div>
          <div className="queue-cards">
            {gameState.queue.map((card, i) => (
              <div key={card.id} className={`queue-card ${i === 0 ? 'active' : ''} ${getSuitColor(card.suit)}`}>
                <span className="rank">{card.rank}</span>
                <span className="suit">{card.suit}</span>
              </div>
            ))}
          </div>
          <div className="deck-info">🃏 {gameState.deck.length}</div>
        </section>

        {/* Player 2 Board */}
        <section className={`player-board ${activePlayer === 'player2' && !activePending ? 'active' : ''} ${pendingP2 ? 'ready' : ''}`}>
          <div className="board-header">
            <h2>{playMode === 'ai' ? 'AI' : 'Player 2'}</h2>
            <div className="player-stats">
              <span className="stat energy">⚡ {p2.energy}</span>
              {p2.overheat > 0 && <span className="stat overheat">🌡️ {p2.overheat}</span>}
            </div>
          </div>
          <div className="lanes">
            {p2.lanes.map((lane, i) => renderLane(lane, i))}
          </div>
        </section>
      </main>

      {/* Controls Dock */}
      <section className="controls-dock">
        {renderControls()}
      </section>

      {/* History */}
      {history.length > 0 && (
        <footer className="history-bar">
          {history.map((t, i) => (
            <span key={i} className="history-chip">
              {t.playerActions[0].action.type[0]}/{t.playerActions[1].action.type[0]}
            </span>
          ))}
        </footer>
      )}
    </div>
  );
};
