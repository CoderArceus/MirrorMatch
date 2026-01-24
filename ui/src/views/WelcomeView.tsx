/**
 * WelcomeView - Modern redesign with all game modes
 */

import React, { useState } from 'react';
import type { AIDifficulty } from '../../../engine/src';
import './WelcomeView.css';

interface WelcomeViewProps {
  onStart: (mode: 'local' | 'ai' | 'async', difficulty?: AIDifficulty) => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onStart }) => {
  const [selectedMode, setSelectedMode] = useState<'local' | 'ai' | 'async' | null>(null);
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('medium');
  const [showRules, setShowRules] = useState(false);

  const handleStart = () => {
    if (selectedMode === 'ai') {
      onStart('ai', aiDifficulty);
    } else if (selectedMode) {
      onStart(selectedMode);
    }
  };

  return (
    <div className={`welcome-view ${showRules ? 'scrollable' : ''}`}>
      {/* Background decoration */}
      <div className="welcome-bg">
        <div className="bg-orb orb-1"></div>
        <div className="bg-orb orb-2"></div>
        <div className="bg-orb orb-3"></div>
      </div>

      <div className="welcome-container">
        {/* Logo & Title */}
        <header className="welcome-header">
          <div className="logo-icon">🎴</div>
          <h1 className="game-title">Seque</h1>
          <p className="game-subtitle">Strategic 21</p>
          <p className="game-tagline">
            A tactical card battler where you and your opponent share the same deck.
            Manage energy, control lanes, and outsmart your mirror image.
          </p>
        </header>

        {/* Game Mode Selection */}
        <div className="mode-selection">
          <h2 className="section-title">Choose Game Mode</h2>
          
          <div className="mode-grid">
            {/* Local PvP */}
            <button 
              className={`mode-card ${selectedMode === 'local' ? 'selected' : ''}`}
              onClick={() => setSelectedMode('local')}
            >
              <div className="mode-icon">👥</div>
              <div className="mode-info">
                <h3>Local PvP</h3>
                <p>Play against a friend on the same device</p>
              </div>
              <div className="mode-check">
                {selectedMode === 'local' && <span>✓</span>}
              </div>
            </button>

            {/* vs AI */}
            <button 
              className={`mode-card ${selectedMode === 'ai' ? 'selected' : ''}`}
              onClick={() => setSelectedMode('ai')}
            >
              <div className="mode-icon">🤖</div>
              <div className="mode-info">
                <h3>vs AI</h3>
                <p>Challenge the machine at your skill level</p>
              </div>
              <div className="mode-check">
                {selectedMode === 'ai' && <span>✓</span>}
              </div>
            </button>

            {/* Async PvP */}
            <button 
              className={`mode-card ${selectedMode === 'async' ? 'selected' : ''}`}
              onClick={() => setSelectedMode('async')}
            >
              <div className="mode-icon">🔗</div>
              <div className="mode-info">
                <h3>Async PvP</h3>
                <p>Create a shareable link to play remotely</p>
              </div>
              <div className="mode-check">
                {selectedMode === 'async' && <span>✓</span>}
              </div>
            </button>
          </div>

          {/* AI Difficulty Selection */}
          {selectedMode === 'ai' && (
            <div className="difficulty-section animate-slideUp">
              <h3 className="difficulty-title">AI Difficulty</h3>
              <div className="difficulty-options">
                {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((diff) => (
                  <button
                    key={diff}
                    className={`difficulty-btn ${aiDifficulty === diff ? 'active' : ''}`}
                    onClick={() => setAIDifficulty(diff)}
                  >
                    <span className="diff-icon">
                      {diff === 'easy' ? '😊' : diff === 'medium' ? '🧠' : '🔥'}
                    </span>
                    <span className="diff-label">{diff.charAt(0).toUpperCase() + diff.slice(1)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start Button */}
          <button 
            className="start-btn"
            onClick={handleStart}
            disabled={!selectedMode}
          >
            {selectedMode === 'async' ? 'Create Challenge Link' : 'Start Game'}
            <span className="btn-arrow">→</span>
          </button>
        </div>

        {/* Quick Rules Toggle */}
        <button className="rules-toggle" onClick={() => setShowRules(!showRules)}>
          {showRules ? '▲ Hide Rules' : '▼ Quick Rules'}
        </button>

        {showRules && (
          <div className="rules-panel animate-slideUp">
            <div className="rules-grid">
              <div className="rule-item">
                <span className="rule-icon">🎯</span>
                <div>
                  <strong>Goal</strong>
                  <p>Win 2 of 3 lanes by getting closest to 21 without busting</p>
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-icon">📥</span>
                <div>
                  <strong>Take</strong>
                  <p>Add the front card to any unlocked lane</p>
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-icon">🔥</span>
                <div>
                  <strong>Burn</strong>
                  <p>Spend 1 energy to destroy the front card</p>
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-icon">🔒</span>
                <div>
                  <strong>Stand</strong>
                  <p>Lock a lane to prevent further changes</p>
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-icon">🎰</span>
                <div>
                  <strong>Dark Auction</strong>
                  <p>On turns 4 & 8, bid energy - loser gets shackled</p>
                </div>
              </div>
              <div className="rule-item">
                <span className="rule-icon">🎲</span>
                <div>
                  <strong>Blind Hit</strong>
                  <p>Draw from deck to shackled lanes</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="welcome-footer">
          <span className="version">v2.5</span>
          <span className="separator">•</span>
          <span>Dark Auction</span>
          <span className="separator">•</span>
          <span>Blind Hit</span>
          <span className="separator">•</span>
          <span>Overheat</span>
        </footer>
      </div>
    </div>
  );
};
