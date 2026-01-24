import React from 'react';
import type { GameState, PlayerAction } from '../../../engine/src';
import './AsyncMatchStatus.css';

interface AsyncMatchStatusProps {
  gameState: GameState;
  myPlayerRole: 'player1' | 'player2';
  pendingActions: Record<string, PlayerAction>;
  isRestoring: boolean;
  matchRestored: boolean;
  urlError: string | null;
  staleTurn: boolean;
  asyncError: string | null;
  submissionStatus: 'none' | 'submitting' | 'success' | 'failed';
  onRetry?: () => void;
  onRefresh?: () => void;
  onReload?: () => void;
  onStartNew?: () => void;
}

export const AsyncMatchStatus: React.FC<AsyncMatchStatusProps> = ({
  gameState,
  myPlayerRole,
  pendingActions,
  isRestoring,
  matchRestored,
  urlError,
  staleTurn,
  asyncError,
  submissionStatus,
  onRetry,
  onRefresh,
  onReload,
  onStartNew,
}) => {
  const activePlayer = gameState.turnNumber % 2 === 1 ? 'player1' : 'player2';
  const isMyTurn = activePlayer === myPlayerRole;
  const actionSubmitted = pendingActions[myPlayerRole] !== undefined;
  const isAuctionTurn = [4, 8].includes(gameState.turnNumber);

  return (
    <div className="async-match-status">
      {/* Restoring Banner */}
      {isRestoring && (
        <div className="status-banner restoring-banner">
          <div className="banner-icon spin">⏳</div>
          <span>Restoring match from replay…</span>
        </div>
      )}

      {/* Match Restored */}
      {matchRestored && (
        <div className="status-toast match-restored-toast">
          <span className="toast-icon">✓</span>
          <span>Match restored from replay</span>
        </div>
      )}

      {/* URL Error */}
      {urlError && (
        <div className="status-panel error-panel">
          <div className="panel-icon">⚠️</div>
          <div className="panel-content">
            <h3>Invalid Match Link</h3>
            <p>{urlError}</p>
            <button onClick={onStartNew} className="panel-btn primary">
              Start New Match
            </button>
          </div>
        </div>
      )}

      {/* Stale Tab */}
      {staleTurn && (
        <div className="status-panel warning-panel">
          <div className="panel-icon">⚠️</div>
          <div className="panel-content">
            <h3>Match Progressed in Another Tab</h3>
            <p>The game state is out of sync. Please refresh to continue.</p>
            <button onClick={onRefresh} className="panel-btn warning">
              Refresh State
            </button>
          </div>
        </div>
      )}

      {/* Async Error */}
      {asyncError && (
        <div className="status-panel error-panel">
          <div className="panel-icon">⚠️</div>
          <div className="panel-content">
            <h3>Action Failed</h3>
            <p>{asyncError}</p>
            <button onClick={onReload} className="panel-btn error">
              Reload Match
            </button>
          </div>
        </div>
      )}

      {/* Submission Status */}
      {submissionStatus === 'success' && (
        <div className="status-toast success-toast">
          <span className="toast-icon">✓</span>
          <span>Action submitted and synced</span>
        </div>
      )}

      {submissionStatus === 'failed' && (
        <div className="status-toast error-toast">
          <span className="toast-icon">⚠</span>
          <span>Action failed to sync</span>
          <button onClick={onRetry} className="toast-btn">
            Retry
          </button>
        </div>
      )}

      {/* Match Entry Banner - Only when game active */}
      {!gameState.gameOver && (
        <div
          className={`match-entry-banner ${
            isMyTurn ? (actionSubmitted ? 'action-submitted' : 'your-turn') : 'waiting'
          }`}
        >
          {isMyTurn ? (
            actionSubmitted ? (
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
              <span className="banner-text">
                Waiting for opponent to play<span className="animated-dots">...</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Auction Clarity Banner */}
      {!gameState.gameOver && isAuctionTurn && !actionSubmitted && isMyTurn && (
        <div className="auction-banner">
          <div className="banner-icon">🎯</div>
          <div className="banner-message">
            <strong>Dark Auction — Energy Bid Required</strong>
            <p>Place your bid and select a Void Stone target lane</p>
          </div>
        </div>
      )}
    </div>
  );
};
