import React from 'react';
import type { DrawReason } from '../../../engine/src';
import './SessionStats.css';

interface SessionStatsData {
    games: number;
    p1Wins: number;
    p2Wins: number;
    draws: number;
    totalTurns: number;
    drawReasons: Record<DrawReason, number>;
}

interface SessionStatsProps {
    stats: SessionStatsData;
    onReset: () => void;
}

export const SessionStats: React.FC<SessionStatsProps> = ({ stats, onReset }) => {
    return (
        <div className="stats-panel">
            <h3>📊 Session Statistics</h3>
            <div className="stats-grid">
                <div className="stat-item">
                    <div className="stat-label">Games Played</div>
                    <div className="stat-value">{stats.games}</div>
                </div>
                <div className="stat-item">
                    <div className="stat-label">Player 1 Wins</div>
                    <div className="stat-value">{stats.p1Wins}</div>
                </div>
                <div className="stat-item">
                    <div className="stat-label">Player 2 Wins</div>
                    <div className="stat-value">{stats.p2Wins}</div>
                </div>
                <div className="stat-item">
                    <div className="stat-label">Draws</div>
                    <div className="stat-value">{stats.draws}</div>
                </div>
                <div className="stat-item">
                    <div className="stat-label">Avg Turns/Game</div>
                    <div className="stat-value">
                        {stats.games > 0 ? (stats.totalTurns / stats.games).toFixed(1) : '0.0'}
                    </div>
                </div>
                <div className="stat-item">
                    <div className="stat-label">Draw Rate</div>
                    <div className="stat-value">
                        {stats.games > 0 ? ((stats.draws / stats.games) * 100).toFixed(1) : '0.0'}%
                    </div>
                </div>
            </div>

            {/* Draw Reasons Breakdown */}
            {stats.draws > 0 && (
                <div className="draw-breakdown">
                    <h4>Draw Types</h4>
                    <div className="draw-reasons">
                        {Object.entries(stats.drawReasons)
                            .filter(([_, count]) => count > 0)
                            .sort((a, b) => b[1] - a[1])
                            .map(([reason, count]) => (
                                <div key={reason} className="draw-reason-item">
                                    <span className="draw-reason-label">
                                        {reason.replace(/_/g, ' ')}
                                    </span>
                                    <span className="draw-reason-count">{count}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}
            {stats.games > 0 && (
                <button onClick={onReset} className="reset-stats-btn">
                    Reset Stats
                </button>
            )}
        </div>
    );
};
