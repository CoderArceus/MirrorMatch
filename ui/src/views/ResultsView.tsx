/**
 * ResultsView - Modern design with comprehensive game analytics
 */

import React from 'react';
import type { GameState, TurnActions } from '../../../engine/src';
import { 
  explainGameEnd, 
  detectSkillBadge, 
  classifyDraw,
  getDecisivenessScore 
} from '../../../engine/src';
import './ResultsView.css';

interface ResultsViewProps {
  gameState: GameState;
  history: TurnActions[];
  playMode: 'local' | 'ai' | 'async';
  onPlayAgain: () => void;
  onQuit: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  gameState,
  history,
  playMode,
  onPlayAgain,
  onQuit,
}) => {
  const p1 = gameState.players[0];
  const p2 = gameState.players[1];

  // Calculate lane wins
  const laneResults = [0, 1, 2].map(i => {
    const p1Lane = p1.lanes[i];
    const p2Lane = p2.lanes[i];
    
    let winner: 'p1' | 'p2' | 'draw' = 'draw';
    if (p1Lane.busted && !p2Lane.busted) winner = 'p2';
    else if (!p1Lane.busted && p2Lane.busted) winner = 'p1';
    else if (!p1Lane.busted && !p2Lane.busted) {
      if (p1Lane.total > p2Lane.total) winner = 'p1';
      else if (p2Lane.total > p1Lane.total) winner = 'p2';
    }

    return {
      index: i,
      p1Total: p1Lane.busted ? -1 : p1Lane.total,
      p2Total: p2Lane.busted ? -1 : p2Lane.total,
      p1Busted: p1Lane.busted,
      p2Busted: p2Lane.busted,
      winner
    };
  });

  const p1Score = laneResults.filter(r => r.winner === 'p1').length;
  const p2Score = laneResults.filter(r => r.winner === 'p2').length;
  
  const isDraw = p1Score === p2Score;
  const overallWinner = isDraw ? null : (p1Score > p2Score ? 'player1' : 'player2');

  // Get analytics
  const gameExplanation = explainGameEnd(gameState);
  const p1Badge = detectSkillBadge(gameState, 'player1');
  const p2Badge = detectSkillBadge(gameState, 'player2');
  const p1Decisiveness = getDecisivenessScore(gameState, 'player1');
  const p2Decisiveness = getDecisivenessScore(gameState, 'player2');
  
  // Draw analysis if applicable
  const drawAnalysis = isDraw ? classifyDraw(gameState) : null;

  // Get badge emoji (badges already include emoji)
  const formatBadge = (badge: string | null) => {
    if (!badge) return null;
    return badge;
  };

  return (
    <div className="results-view">
      <div className="results-container">
        {/* Result Header */}
        <div className={`result-header ${isDraw ? 'draw' : overallWinner === 'player1' ? 'p1-win' : 'p2-win'}`}>
          <div className="result-icon">
            {isDraw ? '🤝' : '🏆'}
          </div>
          <h1 className="result-title">
            {isDraw ? 'Draw!' : `${overallWinner === 'player1' ? 'Player 1' : (playMode === 'ai' ? 'AI' : 'Player 2')} Wins!`}
          </h1>
          <p className="result-subtitle">
            {Array.isArray(gameExplanation) ? gameExplanation[0] : gameExplanation}
          </p>
        </div>

        {/* Score Display */}
        <div className="score-display">
          <div className={`score-player ${overallWinner === 'player1' ? 'winner' : ''}`}>
            <span className="score-name">Player 1</span>
            <span className="score-value">{p1Score}</span>
            {p1Badge && (
              <span className="score-badge" title={p1Badge}>
                {formatBadge(p1Badge)}
              </span>
            )}
          </div>
          <div className="score-divider">
            <span className="vs">VS</span>
          </div>
          <div className={`score-player ${overallWinner === 'player2' ? 'winner' : ''}`}>
            <span className="score-name">{playMode === 'ai' ? 'AI' : 'Player 2'}</span>
            <span className="score-value">{p2Score}</span>
            {p2Badge && (
              <span className="score-badge" title={p2Badge}>
                {formatBadge(p2Badge)}
              </span>
            )}
          </div>
        </div>

        {/* Lane Breakdown */}
        <div className="lane-breakdown">
          <h3 className="section-title">Lane Results</h3>
          <div className="lane-results">
            {laneResults.map(lane => (
              <div key={lane.index} className={`lane-result ${lane.winner}`}>
                <div className={`lane-score left ${lane.winner === 'p1' ? 'winner' : ''}`}>
                  {lane.p1Busted ? '💀' : lane.p1Total}
                </div>
                <div className="lane-info">
                  <span className="lane-name">Lane {String.fromCharCode(65 + lane.index)}</span>
                  <span className="lane-indicator">
                    {lane.winner === 'p1' && '◀'}
                    {lane.winner === 'draw' && '—'}
                    {lane.winner === 'p2' && '▶'}
                  </span>
                </div>
                <div className={`lane-score right ${lane.winner === 'p2' ? 'winner' : ''}`}>
                  {lane.p2Busted ? '💀' : lane.p2Total}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Draw Analysis (if draw) */}
        {drawAnalysis && (
          <div className="draw-analysis">
            <h3 className="section-title">Draw Analysis</h3>
            <div className="analysis-content">
              <div className="analysis-type">
                <span className="analysis-label">Type</span>
                <span className="analysis-value">{drawAnalysis.type.replace(/_/g, ' ')}</span>
              </div>
              <div className="analysis-type">
                <span className="analysis-label">Details</span>
                <span className="analysis-value" style={{ fontSize: '0.8rem' }}>{drawAnalysis.explanation}</span>
              </div>
            </div>
          </div>
        )}

        {/* Game Stats */}
        <div className="game-stats">
          <h3 className="section-title">Match Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{history.length}</span>
              <span className="stat-label">Turns</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{p1.energy}</span>
              <span className="stat-label">P1 Energy</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{p2.energy}</span>
              <span className="stat-label">P2 Energy</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{Math.round((p1Decisiveness + p2Decisiveness) / 2)}%</span>
              <span className="stat-label">Decisive</span>
            </div>
          </div>
        </div>

        {/* Action History Summary */}
        <div className="history-summary">
          <h3 className="section-title">Action Summary</h3>
          <div className="history-actions">
            {(() => {
              const p1Actions: Record<string, number> = {};
              const p2Actions: Record<string, number> = {};
              
              history.forEach(turn => {
                const p1a = turn.playerActions[0].action.type;
                const p2a = turn.playerActions[1].action.type;
                p1Actions[p1a] = (p1Actions[p1a] || 0) + 1;
                p2Actions[p2a] = (p2Actions[p2a] || 0) + 1;
              });

              const allActionTypes = [...new Set([...Object.keys(p1Actions), ...Object.keys(p2Actions)])];
              
              return allActionTypes.map(type => (
                <div key={type} className="action-row">
                  <span className="action-count p1">{p1Actions[type] || 0}</span>
                  <span className="action-type">{type}</span>
                  <span className="action-count p2">{p2Actions[type] || 0}</span>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Actions */}
        <div className="result-actions">
          <button className="btn primary" onClick={onPlayAgain}>
            <span>🔄</span> Play Again
          </button>
          <button className="btn secondary" onClick={onQuit}>
            <span>🏠</span> Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
