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
    onToggleVsAI: (checked: boolean) => void;
    onSetAIDifficulty: (difficulty: AIDifficulty) => void;
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
    onToggleVsAI,
    onSetAIDifficulty,
    onCreateAsyncChallenge
}) => {
    return (
        <div className="turn-header">
            <h1>MirrorMatch: Strategic 21</h1>
            <div className="turn-info">
                Turn {turnNumber}
                {gameOver && (
                    <span className="game-over">
                        {' '}GAME OVER - Winner: {winner || 'DRAW'}
                    </span>
                )}
                {aiThinking && (
                    <span className="ai-thinking"> 🤖 AI thinking...</span>
                )}
            </div>

            {/* AI Mode Controls */}
            <div className="game-mode-controls">
                <label className="mode-toggle">
                    <input
                        type="checkbox"
                        checked={vsAI}
                        onChange={(e) => onToggleVsAI(e.target.checked)}
                        disabled={!gameOver && turnNumber > 1}
                    />
                    <span>vs AI</span>
                </label>

                {vsAI && (
                    <select
                        value={aiDifficulty}
                        onChange={(e) => onSetAIDifficulty(e.target.value as AIDifficulty)}
                        disabled={!gameOver && turnNumber > 1}
                        className="difficulty-select"
                    >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                )}

                {/* Create Async Challenge */}
                {!asyncMode && !vsAI && turnNumber === 1 && (
                    <button
                        onClick={onCreateAsyncChallenge}
                        className="create-challenge-btn"
                    >
                        🔗 Create Async Challenge
                    </button>
                )}
            </div>

            {/* Auction Phase Banner */}
            {!gameOver && [4, 8].includes(turnNumber) && (
                <div className="auction-banner">
                    <h2>🎯 DARK AUCTION</h2>
                    <p>Bid energy for a powerful card. Loser gets Void Stone (shackled lane).</p>
                </div>
            )}
        </div>
    );
};
