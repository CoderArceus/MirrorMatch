import React, { useState } from 'react';
import type { AIDifficulty } from '../../../engine/src';
import './WelcomeScreen.css';

interface WelcomeScreenProps {
    onStartLocal: () => void;
    onStartAI: (difficulty: AIDifficulty) => void;
    onCreateAsync: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    onStartLocal,
    onStartAI,
    onCreateAsync
}) => {
    const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');

    return (
        <div className="welcome-screen">
            <div className="welcome-content">
                <h1 className="game-title">MirrorMatch <span className="subtitle">Strategic 21</span></h1>
                <p className="game-description">
                    A tactical card battler where you and your opponent share the same deck.
                    Manage energy, control lanes, and outsmart your mirror image.
                </p>

                <div className="game-modes">
                    {/* Local PvP */}
                    <div className="mode-card">
                        <h2>👥 Local PvP</h2>
                        <p>Play against a friend on the same device.</p>
                        <button onClick={onStartLocal} className="start-btn primary">
                            Start Local Game
                        </button>
                    </div>

                    {/* Vs AI */}
                    <div className="mode-card">
                        <h2>🤖 Vs AI</h2>
                        <p>Challenge the machine.</p>
                        <div className="ai-options">
                            <label>Difficulty:</label>
                            <select
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value as AIDifficulty)}
                                className="difficulty-select"
                            >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                        </div>
                        <button onClick={() => onStartAI(difficulty)} className="start-btn ai-btn">
                            Start vs AI
                        </button>
                    </div>

                    {/* Async PvP */}
                    <div className="mode-card">
                        <h2>🔗 Async PvP</h2>
                        <p>Create a link to challenge a friend remotely.</p>
                        <button onClick={onCreateAsync} className="start-btn async-btn">
                            Create Challenge Link
                        </button>
                    </div>
                </div>

                <div className="footer-credits">
                    v2.5 • Dark Auction • Blind Hit • Overheat
                </div>
            </div>
        </div>
    );
};
