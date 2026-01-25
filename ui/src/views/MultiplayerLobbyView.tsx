/**
 * MultiplayerLobbyView - Lobby UI for real-time PvP
 * Handles: Create Room, Join Room, Waiting, Ready states
 */

import React, { useState, useEffect } from 'react';
import type { UseMultiplayerReturn } from '../multiplayer/useMultiplayer';
import './MultiplayerLobbyView.css';

interface MultiplayerLobbyViewProps {
  multiplayer: UseMultiplayerReturn;
  onBack: () => void;
}

export const MultiplayerLobbyView: React.FC<MultiplayerLobbyViewProps> = ({
  multiplayer,
  onBack,
}) => {
  const { state, connect, createRoom, joinRoom, ready, cancelRoom, setPhase, clearError } = multiplayer;
  
  // Local form state
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Auto-connect on mount
  useEffect(() => {
    if (state.connectionState === 'disconnected' && !isConnecting) {
      setIsConnecting(true);
      connect()
        .then(() => {
          console.log('[Lobby] Connected successfully');
          setIsConnecting(false);
        })
        .catch((err) => {
          console.error('[Lobby] Failed to connect:', err);
          setIsConnecting(false);
        });
    }
  }, [state.connectionState, isConnecting, connect]);
  
  // ══════════════════════════════════════════════════════════════════════════
  // Handlers
  // ══════════════════════════════════════════════════════════════════════════
  
  const handleCreateRoom = () => {
    if (!displayName.trim()) return;
    createRoom(displayName.trim(), timerSeconds);
  };
  
  const handleJoinRoom = () => {
    if (!displayName.trim() || !roomCode.trim()) return;
    joinRoom(roomCode.trim(), displayName.trim());
  };
  
  const handleBack = () => {
    if (state.phase === 'creating' || state.phase === 'joining') {
      setPhase('menu');
    } else if (state.phase === 'waiting' || state.phase === 'lobby') {
      cancelRoom();
    } else {
      onBack();
    }
  };
  
  const copyRoomCode = () => {
    if (state.roomCode) {
      navigator.clipboard.writeText(state.roomCode);
    }
  };
  
  // ══════════════════════════════════════════════════════════════════════════
  // Render: Connection State
  // ══════════════════════════════════════════════════════════════════════════
  
  if (isConnecting || state.connectionState === 'connecting') {
    return (
      <div className="lobby-view">
        <div className="lobby-container">
          <div className="lobby-connecting">
            <div className="spinner-large"></div>
            <h2>Connecting to server...</h2>
            <p>Please wait</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (state.connectionState === 'disconnected') {
    return (
      <div className="lobby-view">
        <div className="lobby-container">
          <div className="lobby-error">
            <div className="error-icon">⚠️</div>
            <h2>Connection Failed</h2>
            <p>Could not connect to game server.</p>
            <div className="lobby-actions">
              <button className="btn primary" onClick={() => connect()}>
                Retry Connection
              </button>
              <button className="btn secondary" onClick={onBack}>
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // Render: Menu Phase
  // ══════════════════════════════════════════════════════════════════════════
  
  if (state.phase === 'menu') {
    return (
      <div className="lobby-view">
        <div className="lobby-bg">
          <div className="bg-orb orb-1"></div>
          <div className="bg-orb orb-2"></div>
        </div>
        
        <div className="lobby-container">
          <header className="lobby-header">
            <button className="back-btn" onClick={onBack}>← Back</button>
            <h1>🎮 Play PvP</h1>
            <div className="connection-status connected">
              <span className="status-dot"></span>
              Connected
            </div>
          </header>
          
          <div className="lobby-menu">
            <button 
              className="menu-card create"
              onClick={() => setPhase('creating')}
            >
              <div className="card-icon">🏠</div>
              <div className="card-content">
                <h3>Create Room</h3>
                <p>Start a new game and invite a friend</p>
              </div>
              <div className="card-arrow">→</div>
            </button>
            
            <button 
              className="menu-card join"
              onClick={() => setPhase('joining')}
            >
              <div className="card-icon">🚪</div>
              <div className="card-content">
                <h3>Join Room</h3>
                <p>Enter a room code to join a friend</p>
              </div>
              <div className="card-arrow">→</div>
            </button>
          </div>
          
          {state.error && (
            <div className="error-toast" onClick={clearError}>
              <span>⚠️ {state.error.message}</span>
              <button className="close-btn">×</button>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // Render: Create Room Phase
  // ══════════════════════════════════════════════════════════════════════════
  
  if (state.phase === 'creating') {
    return (
      <div className="lobby-view">
        <div className="lobby-bg">
          <div className="bg-orb orb-1"></div>
          <div className="bg-orb orb-2"></div>
        </div>
        
        <div className="lobby-container">
          <header className="lobby-header">
            <button className="back-btn" onClick={handleBack}>← Back</button>
            <h1>🏠 Create Room</h1>
            <div></div>
          </header>
          
          <div className="lobby-form">
            <div className="form-group">
              <label htmlFor="displayName">Your Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                maxLength={20}
                autoFocus
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="timerSeconds">Turn Timer</label>
              <div className="timer-options">
                {[15, 30, 45, 60].map((seconds) => (
                  <button
                    key={seconds}
                    className={`timer-btn ${timerSeconds === seconds ? 'selected' : ''}`}
                    onClick={() => setTimerSeconds(seconds)}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              className="btn primary large"
              onClick={handleCreateRoom}
              disabled={!displayName.trim()}
            >
              Create Room
            </button>
          </div>
          
          {state.error && (
            <div className="error-toast" onClick={clearError}>
              <span>⚠️ {state.error.message}</span>
              <button className="close-btn">×</button>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // Render: Join Room Phase
  // ══════════════════════════════════════════════════════════════════════════
  
  if (state.phase === 'joining') {
    return (
      <div className="lobby-view">
        <div className="lobby-bg">
          <div className="bg-orb orb-1"></div>
          <div className="bg-orb orb-2"></div>
        </div>
        
        <div className="lobby-container">
          <header className="lobby-header">
            <button className="back-btn" onClick={handleBack}>← Back</button>
            <h1>🚪 Join Room</h1>
            <div></div>
          </header>
          
          <div className="lobby-form">
            <div className="form-group">
              <label htmlFor="roomCode">Room Code</label>
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                maxLength={8}
                className="room-code-input"
                autoFocus
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="displayName2">Your Name</label>
              <input
                id="displayName2"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                maxLength={20}
              />
            </div>
            
            <button 
              className="btn primary large"
              onClick={handleJoinRoom}
              disabled={!displayName.trim() || roomCode.length < 8}
            >
              Join Room
            </button>
          </div>
          
          {state.error && (
            <div className="error-toast" onClick={clearError}>
              <span>⚠️ {state.error.message}</span>
              <button className="close-btn">×</button>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // Render: Waiting for Opponent Phase
  // ══════════════════════════════════════════════════════════════════════════
  
  if (state.phase === 'waiting') {
    return (
      <div className="lobby-view">
        <div className="lobby-bg">
          <div className="bg-orb orb-1"></div>
          <div className="bg-orb orb-2"></div>
        </div>
        
        <div className="lobby-container">
          <header className="lobby-header">
            <button className="back-btn" onClick={handleBack}>← Cancel</button>
            <h1>⏳ Waiting</h1>
            <div></div>
          </header>
          
          <div className="waiting-content">
            <div className="room-code-display">
              <label>Room Code</label>
              <div className="code-box" onClick={copyRoomCode}>
                <span className="code">{state.roomCode}</span>
                <button className="copy-btn" title="Copy code">📋</button>
              </div>
              <p className="hint">Share this code with your opponent</p>
            </div>
            
            <div className="waiting-animation">
              <div className="pulse-ring"></div>
              <div className="pulse-ring delay-1"></div>
              <div className="pulse-ring delay-2"></div>
              <span className="waiting-icon">👤</span>
            </div>
            
            <p className="waiting-text">Waiting for opponent to join...</p>
            
            <div className="room-settings">
              <span>⏱️ {state.timerSeconds}s turn timer</span>
            </div>
          </div>
          
          {state.error && (
            <div className="error-toast" onClick={clearError}>
              <span>⚠️ {state.error.message}</span>
              <button className="close-btn">×</button>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // Render: Lobby Phase (Both Players Present)
  // ══════════════════════════════════════════════════════════════════════════
  
  if (state.phase === 'lobby' || state.phase === 'starting') {
    const bothReady = state.myReady && state.opponentReady;
    
    return (
      <div className="lobby-view">
        <div className="lobby-bg">
          <div className="bg-orb orb-1"></div>
          <div className="bg-orb orb-2"></div>
        </div>
        
        <div className="lobby-container">
          <header className="lobby-header">
            <button className="back-btn" onClick={handleBack}>← Leave</button>
            <h1>🎮 Game Lobby</h1>
            <div className="room-info">
              <span className="room-badge">{state.roomCode}</span>
            </div>
          </header>
          
          <div className="lobby-players">
            {/* Player 1 (Host) */}
            <div className={`player-card ${state.myRole === 'player1' ? 'me' : 'opponent'}`}>
              <div className="player-avatar">
                {state.myRole === 'player1' ? '👤' : '👥'}
              </div>
              <div className="player-info">
                <span className="player-name">
                  {state.myRole === 'player1' ? state.myDisplayName : state.opponent?.displayName}
                  {state.myRole === 'player1' && <span className="you-badge">You</span>}
                </span>
                <span className="player-role">Player 1 (Host)</span>
              </div>
              <div className={`ready-status ${state.myRole === 'player1' ? (state.myReady ? 'ready' : '') : (state.opponentReady ? 'ready' : '')}`}>
                {(state.myRole === 'player1' ? state.myReady : state.opponentReady) ? '✓ Ready' : 'Not Ready'}
              </div>
            </div>
            
            <div className="vs-divider">VS</div>
            
            {/* Player 2 (Joiner) */}
            <div className={`player-card ${state.myRole === 'player2' ? 'me' : 'opponent'}`}>
              <div className="player-avatar">
                {state.myRole === 'player2' ? '👤' : '👥'}
              </div>
              <div className="player-info">
                <span className="player-name">
                  {state.myRole === 'player2' ? state.myDisplayName : state.opponent?.displayName}
                  {state.myRole === 'player2' && <span className="you-badge">You</span>}
                </span>
                <span className="player-role">Player 2</span>
              </div>
              <div className={`ready-status ${state.myRole === 'player2' ? (state.myReady ? 'ready' : '') : (state.opponentReady ? 'ready' : '')}`}>
                {(state.myRole === 'player2' ? state.myReady : state.opponentReady) ? '✓ Ready' : 'Not Ready'}
              </div>
            </div>
          </div>
          
          <div className="lobby-actions">
            {!state.myReady ? (
              <button className="btn primary large" onClick={ready}>
                Ready Up
              </button>
            ) : bothReady ? (
              <div className="starting-message">
                <div className="spinner"></div>
                <span>Starting game...</span>
              </div>
            ) : (
              <div className="waiting-ready">
                <span>✓ You're ready!</span>
                <span className="sub">Waiting for opponent...</span>
              </div>
            )}
          </div>
          
          <div className="room-settings">
            <span>⏱️ {state.timerSeconds}s turn timer</span>
          </div>
          
          {state.error && (
            <div className="error-toast" onClick={clearError}>
              <span>⚠️ {state.error.message}</span>
              <button className="close-btn">×</button>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Fallback
  return null;
};
