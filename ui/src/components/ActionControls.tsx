import React from 'react';
import type { GameState, PlayerAction, BidAction, BlindHitAction } from '../../../engine/src/types';
import * as Engine from '../../../engine/src';
import { AuctionControls } from './AuctionControls';
import './ActionControls.css';

interface ActionControlsProps {
    gameState: GameState;
    activePlayer: 'player1' | 'player2';
    onActionSelected: (action: PlayerAction) => void;
    actionsDisabled: boolean;
    asyncMode: boolean;
    isMyTurn: boolean;
    pendingAction?: PlayerAction;
    vsAI: boolean;
    aiThinking: boolean;
    onSwitchPlayer: () => void;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
    gameState,
    activePlayer,
    onActionSelected,
    actionsDisabled,
    asyncMode,
    isMyTurn,
    pendingAction,
    vsAI,
    aiThinking,
    onSwitchPlayer
}) => {
    // Helper: Render actions dynamically based on engine truth
    const renderDynamicActions = () => {
        // We need to access getLegalActions from the engine exports
        // Since we can't import it directly as a value if we only imported types, ensure we import it from index
        // Assuming 'getLegalActions' is exported from index.ts

        // We can use the imported Engine object
        const legalActions = Engine.getLegalActions(gameState, activePlayer);

        // Group actions by type
        const takeActions = legalActions.filter(a => a.type === 'take') as { type: 'take'; targetLane: number }[];
        const burnAction = legalActions.find(a => a.type === 'burn');
        const standActions = legalActions.filter(a => a.type === 'stand') as { type: 'stand'; targetLane: number }[];
        const blindHitActions = legalActions.filter(a => a.type === 'blind_hit') as BlindHitAction[];
        const bidActions = legalActions.filter(a => a.type === 'bid') as BidAction[];

        // Auction Turn: Show bid controls
        if (bidActions.length > 0) {
            return (
                <AuctionControls
                    onSubmit={onActionSelected}
                    activePlayer={activePlayer}
                    gameState={gameState}
                    actionsDisabled={actionsDisabled}
                />
            );
        }

        return (
            <div className="actions">
                {/* Take Actions */}
                {takeActions.length > 0 && (
                    <div className="action-group">
                        <h4>Take (add card to lane)</h4>
                        <div className="lane-buttons">
                            {takeActions.map(action => (
                                <button
                                    key={action.targetLane}
                                    onClick={() => onActionSelected(action)}
                                    className="action-btn"
                                    disabled={actionsDisabled}
                                >
                                    Lane {String.fromCharCode(65 + action.targetLane)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Burn Action */}
                {burnAction && (
                    <div className="action-group">
                        <h4>Burn (destroy front card)</h4>
                        <button
                            onClick={() => onActionSelected(burnAction)}
                            className="action-btn burn"
                            disabled={actionsDisabled}
                        >
                            🔥 Burn (1 energy)
                        </button>
                    </div>
                )}

                {/* Stand Actions */}
                {standActions.length > 0 && (
                    <div className="action-group">
                        <h4>Stand (lock lane)</h4>
                        <div className="lane-buttons">
                            {standActions.map(action => (
                                <button
                                    key={action.targetLane}
                                    onClick={() => onActionSelected(action)}
                                    className="action-btn stand"
                                    disabled={actionsDisabled}
                                >
                                    Lane {String.fromCharCode(65 + action.targetLane)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Blind Hit Actions */}
                {blindHitActions.length > 0 && (
                    <div className="action-group">
                        <h4>Blind Hit (random card from deck)</h4>
                        <p className="blind-hit-warning">⚠️ Desperation move: Draws random card. Causes 2-turn overheat.</p>
                        <div className="lane-buttons">
                            {blindHitActions.map(action => (
                                <button
                                    key={action.targetLane}
                                    onClick={() => onActionSelected(action)}
                                    className="action-btn blind-hit"
                                    disabled={actionsDisabled}
                                >
                                    Lane {String.fromCharCode(65 + action.targetLane)} (Shackled)
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="controls-section">
            {/* Day 24: Turn & State Clarity */}
            {asyncMode && (
                <div className="async-state-indicator">
                    <div className={`turn-status ${isMyTurn ? 'your-turn' : 'opponent-turn'}`}>
                        {isMyTurn ? (
                            <>
                                <span className="status-icon">✓</span>
                                <span className="status-text">Your Turn</span>
                                {pendingAction && (
                                    <span className="action-submitted">• Action Submitted</span>
                                )}
                            </>
                        ) : (
                            <>
                                <span className="status-icon">⏳</span>
                                <span className="status-text">Opponent's Turn</span>
                                <span className="waiting-hint opponent-waiting">
                                    • Waiting for opponent to play<span className="animated-dots">...</span>
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Async Mode: Waiting for Opponent */}
            {asyncMode && !isMyTurn && (
                <div className="waiting-for-opponent">
                    <h3>⏳ Waiting for Opponent</h3>
                    <p>It's {activePlayer === 'player1' ? "Player 1's" : "Player 2's"} turn.</p>
                    <p className="hint">Share the link with your opponent to continue.</p>
                </div>
            )}

            {/* Normal/AI Mode or Your Turn in Async */}
            {(!asyncMode || isMyTurn) && (
                <>
                    {/* Hide controls when AI is thinking or when it's AI's turn */}
                    {vsAI && activePlayer === 'player2' ? (
                        <div className="waiting-for-ai">
                            <h3>🤖 AI's Turn</h3>
                            <p>{aiThinking ? 'AI is thinking...' : 'Waiting for AI...'}</p>
                        </div>
                    ) : (
                        <>
                            <div className="active-player-toggle">
                                <strong>Active Player: {activePlayer === 'player1' ? 'Player 1 (You)' : (vsAI ? 'AI' : 'Player 2')}</strong>
                                {!vsAI && !asyncMode && !pendingAction && (
                                    <button
                                        onClick={onSwitchPlayer}
                                        className="toggle-btn"
                                    >
                                        Switch Player
                                    </button>
                                )}
                            </div>

                            {/* Dynamic action rendering based on getLegalActions */}
                            {renderDynamicActions()}
                        </>
                    )}
                </>
            )}
        </div>
    );
};
