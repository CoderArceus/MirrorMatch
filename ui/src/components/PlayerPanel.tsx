import React from 'react';
import type { PlayerState, PlayerAction } from '../../../engine/src/types';
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
    isActive,
    pendingAction
}) => {
    return (
        <div className={`player-panel ${isActive ? 'active' : ''}`}>
            <div className="player-header">
                <h2>{playerName}</h2>
                <div className="energy">⚡ Energy: {player.energy}</div>
                {/* Day 27: Status Effect Badge - Overheat */}
                {player.overheat > 0 && (
                    <div className="overheat status-badge overheat-badge" title={`Overheat blocks Burn and Blind Hit for ${player.overheat} more turn(s)`}>
                        🔥 Cooling: {player.overheat} turn{player.overheat > 1 ? 's' : ''}
                    </div>
                )}
            </div>
            <div className="lanes">
                {player.lanes.map((lane, idx) => (
                    <Lane key={idx} lane={lane} index={idx} />
                ))}
            </div>
            {pendingAction && (
                <div className="pending-action">
                    ✓ Action submitted: {pendingAction.type}
                </div>
            )}
        </div>
    );
};
