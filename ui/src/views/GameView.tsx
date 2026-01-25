/**
 * GameView - Unified controls, modern design matching welcome page
 */

import React, { useState, useEffect } from 'react';
import type { GameState, PlayerAction, TurnActions, AIDifficulty } from '../../../engine/src';
import { getLegalActions } from '../../../engine/src';
import type { MultiplayerState } from '../multiplayer/types';
import './GameView.css';

import type { SubmittingStatus } from '../multiplayer/useMultiplayer';

interface GameViewProps {
  gameState: GameState;
  playMode: 'local' | 'ai' | 'multiplayer';
  aiDifficulty: AIDifficulty;
  aiThinking: boolean;
  pendingP1: PlayerAction | null;
  pendingP2: PlayerAction | null;
  history: TurnActions[];
  onAction: (player: 'player1' | 'player2', action: PlayerAction) => void;
  onQuit: () => void;
  // Multiplayer-specific props (optional)
  multiplayerState?: MultiplayerState;
  timeRemaining?: number | null;
  canAct?: boolean;
  submittingStatus?: SubmittingStatus;
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
  // Multiplayer props
  multiplayerState,
  timeRemaining,
  canAct: multiplayerCanAct,
  submittingStatus = 'idle',
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
  // In multiplayer: use myRole from state
  const activePlayer: 'player1' | 'player2' = 
    playMode === 'multiplayer' ? (multiplayerState?.myRole || 'player1') :
    playMode === 'ai' ? 'player1' :
    !pendingP1 ? 'player1' : 'player2';
  
  // In multiplayer, actions are disabled when already submitted
  const isMultiplayerDisabled = playMode === 'multiplayer' && !multiplayerCanAct;
  
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

  // Format time remaining for display
  const formatTime = (ms: number | null | undefined): string => {
    if (ms === null || ms === undefined) return '--';
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  // Render unified controls
  const renderControls = () => {
    // Multiplayer: currently submitting action (awaiting ACK)
    if (playMode === 'multiplayer' && submittingStatus !== 'idle' && !multiplayerState?.actionSubmitted) {
      return (
        <div className={`controls-status submitting ${submittingStatus}`}>
          <span className="spinner"></span>
          {submittingStatus === 'submitting' && (
            <span>Submitting...</span>
          )}
          {submittingStatus === 'slow' && (
            <>
              <span>Connection slow — please wait...</span>
              <span className="sub-status warning">Your action is being sent</span>
            </>
          )}
          {submittingStatus === 'retrying' && (
            <>
              <span>Connection issues — retrying...</span>
              <span className="sub-status warning">Reconnecting to server</span>
            </>
          )}
        </div>
      );
    }
    
    // Multiplayer: action already submitted (ACK received)
    if (playMode === 'multiplayer' && multiplayerState?.actionSubmitted) {
      const opponentName = multiplayerState?.opponent?.displayName || 'Opponent';
      const isAuction = isAuctionTurn;
      
      // Calculate time remaining for opponent display
      const opponentTimeDisplay = timeRemaining !== null && timeRemaining !== undefined
        ? Math.ceil(timeRemaining / 1000)
        : null;
      
      return (
        <div className={`controls-status ready ${isAuction ? 'auction' : ''}`}>
          <span className="status-icon">{isAuction ? '🎯' : '✓'}</span>
          <span>{isAuction ? 'Bid locked in' : 'Action submitted'}</span>
          {multiplayerState?.opponentSubmittedThisTurn ? (
            <span className="sub-status">
              {isAuction ? 'Revealing bids...' : 'Resolving turn...'}
            </span>
          ) : (
            <span className="sub-status">
              {isAuction && opponentTimeDisplay !== null
                ? `${opponentName} has ${opponentTimeDisplay}s remaining`
                : `Waiting for ${opponentName}...`
              }
            </span>
          )}
          {/* Opponent status indicator */}
          <div className={`opponent-status ${multiplayerState?.opponentSubmittedThisTurn ? 'submitted' : ''}`}>
            <span className="status-dot"></span>
            {multiplayerState?.opponentSubmittedThisTurn 
              ? `${opponentName} has ${isAuction ? 'bid' : 'submitted'}`
              : `${opponentName} is ${isAuction ? 'bidding' : 'choosing'}...`
            }
          </div>
        </div>
      );
    }

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
    
    // Determine if actions should be disabled
    const actionsDisabled = isMultiplayerDisabled;

    return (
      <div className="controls-actions">
        <div className="controls-player">
          {playMode === 'multiplayer' 
            ? `Your Turn (${multiplayerState?.myDisplayName || (activePlayer === 'player1' ? 'P1' : 'P2')})`
            : `${activePlayer === 'player1' ? 'Player 1' : 'Player 2'}'s Turn`
          }
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
                    disabled={actionsDisabled}
                  >
                    {String.fromCharCode(65 + a.targetLane)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {burn && (
            <div 
              className={`action-group burn ${actionsDisabled ? 'disabled' : ''}`} 
              onClick={() => !actionsDisabled && onAction(activePlayer, burn)} 
              style={{ cursor: actionsDisabled ? 'not-allowed' : 'pointer' }}
            >
              <div className="burn-btn-inner">
                <div className="burn-icon">🔥</div>
                <div className="burn-text">
                  <span className="burn-label">Burn Card</span>
                  <span className="burn-cost">−1 ⚡ Energy</span>
                </div>
              </div>
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
                    disabled={actionsDisabled}
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
                    disabled={actionsDisabled}
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
          {playMode === 'multiplayer' && timeRemaining !== null && timeRemaining !== undefined && (
            <span className={`timer-display ${timeRemaining < 5000 ? 'urgent' : ''}`}>
              ⏱️ {formatTime(timeRemaining)}
            </span>
          )}
          {/* Connection health indicator */}
          {playMode === 'multiplayer' && (
            <span className={`connection-indicator ${multiplayerState?.connectionState || 'disconnected'}`} title={
              multiplayerState?.connectionState === 'connected' ? 'Connected' :
              multiplayerState?.connectionState === 'connecting' ? 'Reconnecting...' : 'Disconnected'
            }>
              {multiplayerState?.connectionState === 'connected' && '🟢'}
              {multiplayerState?.connectionState === 'connecting' && '🟡'}
              {multiplayerState?.connectionState === 'disconnected' && '🔴'}
            </span>
          )}
        </div>
        <div className="mode-display">
          {playMode === 'ai' && `🤖 ${aiDifficulty}`}
          {playMode === 'local' && '👥 Local'}
          {playMode === 'multiplayer' && (
            <span className="multiplayer-info">
              🎮 {multiplayerState?.myRole === 'player1' ? 'P1' : 'P2'}
              {multiplayerState?.opponent && ` vs ${multiplayerState.opponent.displayName}`}
            </span>
          )}
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
