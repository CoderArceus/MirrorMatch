import React from 'react';
import type { GameState, TurnActions } from '../../../engine/src';
import {
    analyzeLane,
    explainGameEnd,
    detectSkillBadge,
    analyzeDrawDiagnostics
} from '../../../engine/src/analytics';
import './GameOverScreen.css';

interface GameAnalytics {
    playerMetrics: {
        energyRemaining: number;
        winThreats: number;
        forcedPasses: number;
        contestableLanes: number;
    };
    opponentMetrics: {
        energyRemaining: number;
        winThreats: number;
        forcedPasses: number;
        contestableLanes: number;
    };
    contestableLanes: number;
}

interface GameOverScreenProps {
    gameState: GameState;
    myPlayerRole: 'player1' | 'player2';
    asyncMode: boolean;
    frozenAnalytics: GameAnalytics | null;
    actionHistory: TurnActions[];
    resetGame: () => void;
    feedbackGiven: boolean;
    submitFeedback: (type: 'fun' | 'confusing' | 'frustrating' | 'thinking') => void;
    shareMatch: () => void;
    scrollToHistory: () => void;
}

// Helper functions (moved from App.tsx)
const generateWinSummary = (state: GameState, playerId: 'player1' | 'player2'): string => {
    const player = state.players.find(p => p.id === playerId)!;
    const opponent = state.players.find(p => p.id !== playerId)!;

    // Analyze lanes
    const p1Lanes = state.players[0].lanes;
    const p2Lanes = state.players[1].lanes;
    const outcomes = [
        analyzeLane(p1Lanes[0], p2Lanes[0]),
        analyzeLane(p1Lanes[1], p2Lanes[1]),
        analyzeLane(p1Lanes[2], p2Lanes[2]),
    ];

    const myWins = outcomes.filter(o => o.winner === playerId).length;
    const opponentBusts = opponent.lanes.filter(l => l.busted).length;
    const my21s = player.lanes.filter(l => l.total === 21 && !l.busted).length;

    if (opponentBusts >= 2) return "You won because your opponent overextended and busted multiple lanes.";
    if (my21s >= 2) return "You secured victory with precision play, hitting 21 in multiple lanes.";
    if (player.energy > opponent.energy) return "Your superior energy management and strategic positioning secured the victory.";
    if (myWins === 2) return "You won by securing two strong lanes with better positioning.";

    return "You made strategic decisions that gave you the decisive advantage.";
};

const generateLossSummary = (state: GameState, playerId: 'player1' | 'player2'): string => {
    const player = state.players.find(p => p.id === playerId)!;
    const opponent = state.players.find(p => p.id !== playerId)!;

    const myBusts = player.lanes.filter(l => l.busted).length;
    const opponent21s = opponent.lanes.filter(l => l.total === 21 && !l.busted).length;

    if (myBusts >= 2) return "You lost by overextending and busting multiple lanes.";
    if (opponent21s >= 2) return "Your opponent secured victory with precision play, hitting 21 in multiple lanes.";
    if (opponent.energy > player.energy) return "Your opponent's superior energy management gave them the advantage.";

    return "Your opponent secured two strong lanes with better strategic positioning.";
};

const getPerformanceBadges = (analytics: GameAnalytics, gameState: GameState, myPlayerRole: string) => {
    const badges: Array<{ icon: string; label: string }> = [];

    const p1LanesWon = gameState.players[0].lanes.filter((l, i) => analyzeLane(l, gameState.players[1].lanes[i]).winner === 'player1').length;
    const p2LanesWon = gameState.players[1].lanes.filter((l, i) => analyzeLane(gameState.players[0].lanes[i], l).winner === 'player2').length;
    const myLanesWon = myPlayerRole === 'player1' ? p1LanesWon : p2LanesWon;
    const oppLanesWon = myPlayerRole === 'player1' ? p2LanesWon : p1LanesWon;

    if (analytics.playerMetrics.energyRemaining <= 1) badges.push({ icon: '🧠', label: 'Efficient Energy Use' });
    if (analytics.playerMetrics.winThreats >= 2) badges.push({ icon: '🎯', label: 'Perfect Pressure' });
    if (analytics.contestableLanes === 0) badges.push({ icon: '🔥', label: 'High-Stakes Finish' });
    if (gameState.winner === myPlayerRole && myLanesWon === 2 && oppLanesWon === 1) {
        badges.push({ icon: '⚖️', label: 'Balanced Victory' });
    }
    if (gameState.winner === null && analytics.playerMetrics.winThreats >= 1 && analytics.opponentMetrics.winThreats >= 1) {
        badges.push({ icon: '♟️', label: 'Elite Draw' });
    }

    return badges.slice(0, 3);
};

const getDrawExplanation = (analytics: GameAnalytics) => {
    const totalPressure = analytics.playerMetrics.winThreats + analytics.opponentMetrics.winThreats;
    if (totalPressure >= 3) return 'Elite-level draw — neither player yielded ground';
    else if (totalPressure >= 2) return 'Perfectly balanced confrontation';
    else return 'Both players won an equal number of lanes';
};

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
    gameState,
    myPlayerRole,
    asyncMode,
    frozenAnalytics,
    actionHistory,
    resetGame,
    feedbackGiven,
    submitFeedback,
    shareMatch,
    scrollToHistory
}) => {
    // Logic for summaries
    const generateStrategicSummary = (state: GameState, viewerPlayerId: 'player1' | 'player2'): string => {
        const isWin = state.winner === viewerPlayerId;
        const isDraw = state.winner === null;

        if (isWin) return generateWinSummary(state, viewerPlayerId);
        else if (isDraw) return 'Match ended in a draw.'; // Simplified for now, or use complex logic
        else return generateLossSummary(state, viewerPlayerId);
    };

    return (
        <div className="game-container">
            {/* Async Closure Panel */}
            {asyncMode && (
                <div className="match-closure-panel dark-panel">
                    <div className="closure-header">
                        <h2>🏁 Match Complete</h2>
                    </div>
                    <div className="closure-content">
                        <div className="outcome-section">
                            {gameState.winner === myPlayerRole ? (
                                <div className="outcome-label win">Victory</div>
                            ) : gameState.winner === null ? (
                                <div className="outcome-label draw">Draw</div>
                            ) : (
                                <div className="outcome-label loss">Defeat</div>
                            )}
                            <div className="outcome-explanation">
                                {gameState.winner === myPlayerRole
                                    ? 'You won more lanes than your opponent'
                                    : gameState.winner === null && frozenAnalytics
                                        ? getDrawExplanation(frozenAnalytics)
                                        : gameState.winner === null
                                            ? 'Both players won an equal number of lanes'
                                            : 'Your opponent won more lanes'}
                            </div>

                            {/* Performance Badges */}
                            {frozenAnalytics && (() => {
                                const badges = getPerformanceBadges(frozenAnalytics, gameState, myPlayerRole);
                                if (badges.length === 0) return null;
                                return (
                                    <div className="performance-badges">
                                        {badges.map((badge, i) => (
                                            <div key={i} className="badge">
                                                <span className="badge-icon">{badge.icon}</span>
                                                <span className="badge-label">{badge.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            <div className="final-stats">
                                Final turn: {gameState.turnNumber - 1}
                            </div>
                        </div>

                        <div className="closure-actions">
                            <button onClick={shareMatch} className="share-btn">
                                📤 Share Match
                            </button>
                            <button onClick={scrollToHistory} className="view-history-btn">
                                📜 View Full History
                            </button>
                            <button
                                onClick={() => window.location.href = window.location.origin}
                                className="new-match-btn"
                            >
                                ✨ Start New Match
                            </button>
                        </div>

                        <div className="share-subtext">
                            Anyone with the match link can replay the full game
                        </div>
                    </div>
                </div>
            )}



            {/* Standard Game Over View (shown below closure panel if async) */}
            <div className="turn-header">
                <h2>🏁 Game Over</h2>
                {gameState.winner ? (
                    <div className="winner-announcement">
                        {gameState.winner === 'player1' ? 'Player 1' : 'Player 2'} Wins!
                    </div>
                ) : (
                    <div className="draw-announcement">Draw</div>
                )}
            </div>

            {/* Lane-by-Lane Breakdown */}
            <div className="lane-breakdown">
                <h3>Lane-by-Lane Results</h3>
                <div className="lane-results">
                    {[0, 1, 2].map(i => {
                        const outcome = analyzeLane(gameState.players[0].lanes[i], gameState.players[1].lanes[i]);
                        const laneName = String.fromCharCode(65 + i);
                        return (
                            <div key={i} className={`lane-result ${outcome.winner}`}>
                                <div className="lane-result-header">
                                    <strong>Lane {laneName}</strong>
                                    {outcome.winner === 'player1' && <span className="winner-badge">P1 ✓</span>}
                                    {outcome.winner === 'player2' && <span className="winner-badge">P2 ✓</span>}
                                    {outcome.winner === 'tie' && <span className="tie-badge">TIE</span>}
                                </div>
                                <div className="lane-result-scores">
                                    P1: {outcome.p1Total} | P2: {outcome.p2Total}
                                </div>
                                <div className="lane-result-reason">{outcome.reason}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Post-Game Explanation Panel */}
            <div className="post-game-explanation">
                <h3>
                    {gameState.winner === myPlayerRole && '🎉 You Win!'}
                    {gameState.winner && gameState.winner !== myPlayerRole && '💔 You Lost'}
                    {!gameState.winner && '🤝 Draw'}
                </h3>

                {/* Strategic Summary */}
                <div className="strategic-summary">
                    <p>{generateStrategicSummary(gameState, asyncMode ? myPlayerRole : 'player1')}</p>
                </div>

                {/* Metrics Badges for Draw */}
                {!gameState.winner && (
                    <div className="draw-metrics">
                        {(() => {
                            const diagnostics = analyzeDrawDiagnostics(
                                gameState,
                                'player1',
                                'player2',
                                actionHistory.flatMap(turn => turn.playerActions.map(pa => ({ playerId: pa.playerId, action: pa.action })))
                            );
                            const viewerMetrics = myPlayerRole === 'player1' ? diagnostics.p1 : diagnostics.p2;

                            return (
                                <>
                                    {viewerMetrics.winThreats >= 2 && (
                                        <span className="metric-badge high-pressure" title="You had multiple lanes close to winning">
                                            ⚔️ High Pressure
                                        </span>
                                    )}
                                    {viewerMetrics.energyRemaining >= 2 && (
                                        <span className="metric-badge energy-remaining" title="You had energy remaining at game end">
                                            ⚡ Energy: {viewerMetrics.energyRemaining}
                                        </span>
                                    )}
                                    {viewerMetrics.forcedPasses > 0 && (
                                        <span className="metric-badge forced-passes" title="Number of pass actions taken">
                                            🚫 Passes: {viewerMetrics.forcedPasses}
                                        </span>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Legacy game summary for non-async modes */}
            {!asyncMode && (
                <div className="game-over-explanation">
                    <h3>Game Summary</h3>
                    {explainGameEnd(gameState).map((explanation, idx) => (
                        <p key={idx} className="explanation-line">• {explanation}</p>
                    ))}
                </div>
            )}

            {/* Skill Badge */}
            {(() => {
                const badge = detectSkillBadge(gameState, 'player1');
                if (badge) {
                    return (
                        <div className="skill-badge-section">
                            <div className="skill-badge">{badge}</div>
                            <p className="badge-earned">Badge Earned!</p>
                        </div>
                    );
                }
                return null;
            })()}

            {/* Quick Feedback */}
            {!feedbackGiven && (
                <div className="feedback-section">
                    <h3>Quick Feedback (Optional)</h3>
                    <p className="feedback-prompt">How did this game feel?</p>
                    <div className="feedback-buttons">
                        <button onClick={() => submitFeedback('fun')} className="feedback-btn fun">
                            😄 Fun
                        </button>
                        <button onClick={() => submitFeedback('confusing')} className="feedback-btn confusing">
                            🤔 Confusing
                        </button>
                        <button onClick={() => submitFeedback('frustrating')} className="feedback-btn frustrating">
                            😡 Frustrating
                        </button>
                        <button onClick={() => submitFeedback('thinking')} className="feedback-btn thinking">
                            🧠 Made me think
                        </button>
                    </div>
                </div>
            )}

            {feedbackGiven && (
                <div className="feedback-thanks">
                    ✓ Thanks for your feedback!
                </div>
            )}

            <div className="game-over-actions">
                <button onClick={resetGame} className="reset-btn">
                    Play Again
                </button>
            </div>
        </div>
    );
};
