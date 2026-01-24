/**
 * TurnHeader - Minimal compact design
 */

import React from 'react';
import type { AIDifficulty } from '../../../engine/src';
import './TurnHeader.css';

interface TurnHeaderProps {
  turnNumber: number;
  gameOver: boolean;
  winner: string | null;
  aiThinking: boolean;
  vsAI: boolean;
  aiDifficulty: AIDifficulty;
  asyncMode: boolean;
  onToggleVsAI: (val: boolean) => void;
  onSetAIDifficulty: (diff: AIDifficulty) => void;
  onCreateAsyncChallenge: () => void;
}

export const TurnHeader: React.FC<TurnHeaderProps> = ({
  turnNumber,
  gameOver,
  winner,
  aiThinking,
  vsAI,
  aiDifficulty,
  asyncMode,
}) => {
  return (
    <div className="turn-header-compact">
      <div className="turn-info">
        <span className="turn-label">Turn {turnNumber}</span>
        {gameOver && (
          <span className="game-status">
            {winner ? `Winner: ${winner}` : 'Draw'}
          </span>
        )}
        {aiThinking && <span className="ai-status">AI thinking...</span>}
      </div>
      <div className="game-mode">
        {vsAI && <span className="mode-badge">vs AI ({aiDifficulty})</span>}
        {asyncMode && <span className="mode-badge async">Async PvP</span>}
      </div>
    </div>
  );
};
