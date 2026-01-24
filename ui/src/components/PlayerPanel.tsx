/**
 * PlayerPanel - Compact redesign
 */

import React from 'react';
import type { PlayerState, PlayerAction } from '../../../engine/src';
import { Lane } from './Lane';
import './PlayerPanel.css';

interface PlayerPanelProps {
  player: PlayerState;
  playerName: string;
  isActive: boolean;
  pendingAction?: PlayerAction;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  player,
  playerName,
  pendingAction,
}) => {
  return (
    <div className="player-panel-compact">
      {/* Player Info Bar */}
      <div className="player-info-bar">
        <span className="player-name">{playerName}</span>
        <div className="player-stats">
          <span className="stat">⚡{player.energy}</span>
          {player.overheat > 0 && <span className="stat heat">🔥{player.overheat}</span>}
        </div>
      </div>

      {/* Lanes */}
      <div className="lanes-compact">
        {player.lanes.map((lane, idx) => (
          <Lane key={idx} lane={lane} index={idx} />
        ))}
      </div>

      {/* Pending Action Indicator */}
      {pendingAction && (
        <div className="pending-indicator">
          ✓ {pendingAction.type}
        </div>
      )}
    </div>
  );
};
