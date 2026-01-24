/**
 * GameOverScreen - Completely redesigned
 * Clean, modern, fixed-size result display
 */

import React from 'react';
import type { GameState, TurnActions } from '../../../engine/src';
import type { FeedbackType } from '../utils/storage';
import './GameOverScreen.css';

interface GameOverScreenProps {
  gameState: GameState;
  myPlayerRole: 'player1' | 'player2';
  asyncMode: boolean;
  frozenAnalytics: any; // eslint-disable-line @typescript-eslint/no-unused-vars
  actionHistory: TurnActions[];
  resetGame: () => void;
  feedbackGiven: boolean;
  submitFeedback: (type: FeedbackType) => void;
  shareMatch: () => void;
  scrollToHistory: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  gameState,
  myPlayerRole,
  asyncMode,
  actionHistory,
  resetGame,
  feedbackGiven,
  submitFeedback,
  shareMatch,
  scrollToHistory,
}) => {
  const player1 = gameState.players[0];
  const player2 = gameState.players[1];

  // Calculate winner
  const p1Won = player1.lanes.filter((lane, i) => {
    const p2Lane = player2.lanes[i];
    if (lane.busted && p2Lane.busted) return false;
    if (lane.busted) return false;
    if (p2Lane.busted) return true;
    return lane.total > p2Lane.total;
  }).length;

  const p2Won = player2.lanes.filter((lane, i) => {
    const p1Lane = player1.lanes[i];
    if (lane.busted && p1Lane.busted) return false;
    if (lane.busted) return false;
    if (p1Lane.busted) return true;
    return lane.total > p1Lane.total;
  }).length;

  const isDraw = p1Won === p2Won;
  const winner = isDraw ? null : (p1Won > p2Won ? 'player1' : 'player2');
  
  const myResult = winner === myPlayerRole ? 'victory' : (winner === null ? 'draw' : 'defeat');

  return (
    <div className="game-over-screen">
      <div className="result-card">
        
        {/* Result Header */}
        <div className={`result-header ${myResult}`}>
          {myResult === 'victory' && (
            <>
              <div className="result-icon">🏆</div>
              <h1 className="result-title">Victory</h1>
              <p className="result-subtitle">You outplayed your opponent</p>
            </>
          )}
          {myResult === 'defeat' && (
            <>
              <div className="result-icon">💔</div>
              <h1 className="result-title">Defeat</h1>
              <p className="result-subtitle">Your opponent prevailed</p>
            </>
          )}
          {myResult === 'draw' && (
            <>
              <div className="result-icon">🤝</div>
              <h1 className="result-title">Draw</h1>
              <p className="result-subtitle">Perfectly matched</p>
            </>
          )}
        </div>

        {/* Lane Breakdown */}
        <div className="lane-breakdown">
          <div className="breakdown-header">Final Lanes</div>
          <div className="lanes-comparison">
            {[0, 1, 2].map(i => {
              const p1Lane = player1.lanes[i];
              const p2Lane = player2.lanes[i];
              
              let laneWinner = 'draw';
              if (p1Lane.busted && !p2Lane.busted) laneWinner = 'p2';
              else if (!p1Lane.busted && p2Lane.busted) laneWinner = 'p1';
              else if (!p1Lane.busted && !p2Lane.busted) {
                if (p1Lane.total > p2Lane.total) laneWinner = 'p1';
                else if (p2Lane.total > p1Lane.total) laneWinner = 'p2';
              }

              return (
                <div key={i} className="lane-row">
                  <div className={`lane-cell p1 ${laneWinner === 'p1' ? 'winner' : ''}`}>
                    <span className="lane-total">{p1Lane.busted ? '❌' : p1Lane.total}</span>
                  </div>
                  <div className="lane-label">Lane {String.fromCharCode(65 + i)}</div>
                  <div className={`lane-cell p2 ${laneWinner === 'p2' ? 'winner' : ''}`}>
                    <span className="lane-total">{p2Lane.busted ? '❌' : p2Lane.total}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="score-summary">
            <div className="score-item">
              <span className="score-label">Player 1</span>
              <span className="score-value">{p1Won} lanes won</span>
            </div>
            <div className="score-divider">vs</div>
            <div className="score-item">
              <span className="score-label">Player 2</span>
              <span className="score-value">{p2Won} lanes won</span>
            </div>
          </div>
        </div>

        {/* Match Stats */}
        <div className="match-stats">
          <div className="stat-item">
            <span className="stat-label">Turns Played</span>
            <span className="stat-value">{actionHistory.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">P1 Energy Left</span>
            <span className="stat-value">{player1.energy}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">P2 Energy Left</span>
            <span className="stat-value">{player2.energy}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="result-actions">
          <button onClick={resetGame} className="action-btn primary">
            Play Again
          </button>
          
          {asyncMode && (
            <button onClick={shareMatch} className="action-btn secondary">
              📤 Share Result
            </button>
          )}
          
          <button onClick={scrollToHistory} className="action-btn secondary">
            📜 View History
          </button>
        </div>

        {/* Feedback */}
        {!feedbackGiven && (
          <div className="feedback-section">
            <p className="feedback-prompt">How was this match?</p>
            <div className="feedback-buttons">
              <button onClick={() => submitFeedback('fun')} className="feedback-btn">
                😊 Fun
              </button>
              <button onClick={() => submitFeedback('confusing')} className="feedback-btn">
                😕 Confusing
              </button>
              <button onClick={() => submitFeedback('frustrating')} className="feedback-btn">
                😤 Frustrating
              </button>
            </div>
          </div>
        )}
        {feedbackGiven && (
          <div className="feedback-thanks">
            ✓ Thanks for your feedback!
          </div>
        )}

      </div>
    </div>
  );
};
