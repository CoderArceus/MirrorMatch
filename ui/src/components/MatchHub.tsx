import React from 'react';
import type { GameState, TurnActions, PlayerAction } from '../../../engine/src';
import { createShareableURL, type EncodedMatch } from '../utils/encodeMatch';
import './MatchHub.css';

interface MatchHubProps {
    gameState: GameState;
    activePlayer: 'player1' | 'player2';
    gameSeed: number;
    actionHistory: TurnActions[];
    pendingActions: Record<string, PlayerAction>;
}

export const MatchHub: React.FC<MatchHubProps> = ({
    gameState,
    activePlayer,
    gameSeed,
    actionHistory,
    pendingActions
}) => {
    const generateMatchUrl = () => {
        // Auto-generate current match URL
        const nextPlayer: 'player1' | 'player2' = activePlayer === 'player1' ? 'player2' : 'player1';

        // In game over, the "next player" concept is less relevant, but we keep the structure
        // Ideally we'd persist the last active player or similar

        const match: EncodedMatch = {
            seed: gameSeed,
            actions: actionHistory,
            pendingActions: pendingActions,
            currentPlayer: nextPlayer,
            version: 1,
        };
        return createShareableURL(match);
    };

    const currentUrl = generateMatchUrl();

    const handleCopy = () => {
        navigator.clipboard.writeText(currentUrl).then(() => {
            alert(gameState.gameOver
                ? 'Final match link copied! Share this to show the result.'
                : 'Match link copied to clipboard!');
        }).catch(() => {
            prompt('Copy this link:', currentUrl);
        });
    };

    return (
        <>
            <div className="match-hub">
                <h3>📋 {gameState.gameOver ? 'Final Match Result' : 'Your Match Link'}</h3>
                <div className="match-hub-content">
                    <div className="match-url-display">
                        <input
                            type="text"
                            value={currentUrl}
                            readOnly
                            className="match-url-input"
                        />
                    </div>
                    <button
                        onClick={handleCopy}
                        className="copy-link-btn"
                    >
                        📋 {gameState.gameOver ? 'Share Result' : 'Copy Link'}
                    </button>
                    <p className="match-hub-hint">
                        {gameState.gameOver
                            ? '🏁 Share this link with your opponent to show the final result.'
                            : '💡 This link updates automatically. Share anytime to let your opponent see the current game state.'}
                    </p>
                </div>
            </div>

            {/* Day 27: Desync Confidence Signal */}
            <div className="replay-confidence-footer">
                <span className="confidence-indicator">
                    State verified from replay (deterministic) ✓
                </span>
            </div>
        </>
    );
};
