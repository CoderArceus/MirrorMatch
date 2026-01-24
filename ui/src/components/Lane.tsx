import React from 'react';
import type { LaneState } from '../../../engine/src/types';
import './Lane.css';

interface LaneProps {
    lane: LaneState;
    index: number;
}

export const Lane: React.FC<LaneProps> = ({ lane, index }) => {
    const statusClass = lane.busted ? 'lane-busted' : lane.locked ? 'lane-locked' : '';

    return (
        <div className={`lane ${statusClass} ${lane.shackled ? 'lane-shackled' : ''}`}>
            <div className="lane-header">
                Lane {String.fromCharCode(65 + index)} {/* A, B, C */}
                {/* Day 27: Status Effect Badges */}
                {lane.shackled && (
                    <span className="status-badge shackled-badge" title="Shackled: Requires 20+ to Stand">
                        ⛓️
                    </span>
                )}
                {lane.hasBeenShackled && !lane.shackled && (
                    <span className="status-badge history-badge" title="Previously shackled (cannot be shackled again)">
                        ⛓
                    </span>
                )}
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
