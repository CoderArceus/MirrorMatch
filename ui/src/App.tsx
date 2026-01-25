/**
 * MirrorMatch - PvP Alpha
 * Real-time PvP with WebSocket multiplayer
 * Local play and AI modes supported
 */

import { useState, useEffect, useCallback, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import type { GameState, PlayerAction, TurnActions, AIDifficulty } from '../../engine/src';
import { 
  createInitialGameState, 
  resolveTurn, 
  chooseAction, 
  isActionLegal
} from '../../engine/src';

import { WelcomeView } from './views/WelcomeView';
import { GameView } from './views/GameView';
import { ResultsView } from './views/ResultsView';
import { MultiplayerLobbyView } from './views/MultiplayerLobbyView';
import { recordGame } from './utils/storage';
import { useMultiplayer } from './multiplayer/useMultiplayer';

import './App.css';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MirrorMatch Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fatal-error-screen">
          <div className="error-panel">
            <div className="error-icon">💥</div>
            <h1>Unexpected Error</h1>
            <p>Something went wrong. Reload the page or start a new match.</p>
            <div className="error-actions">
              <button className="error-btn" onClick={() => window.location.reload()}>
                Reload Page
              </button>
              <button className="error-btn secondary" onClick={this.handleReset}>
                New Match
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type AppMode = 'welcome' | 'playing' | 'results' | 'multiplayer-lobby' | 'multiplayer-game';
type PlayMode = 'local' | 'ai' | 'multiplayer';

function AppContent() {
  // App State
  const [mode, setMode] = useState<AppMode>('welcome');
  const [playMode, setPlayMode] = useState<PlayMode>('local');
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('medium');
  
  // Multiplayer hook
  const multiplayer = useMultiplayer();

  // Game State
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState(Date.now()));
  
  // History - resolved turns only
  const [resolvedHistory, setResolvedHistory] = useState<TurnActions[]>([]);

  // Turn State
  const [pendingP1, setPendingP1] = useState<PlayerAction | null>(null);
  const [pendingP2, setPendingP2] = useState<PlayerAction | null>(null);
  const [aiThinking, setAiThinking] = useState(false);

  // Start new game
  const startGame = useCallback((newPlayMode: PlayMode, difficulty?: AIDifficulty) => {
    // Handle multiplayer mode separately
    if (newPlayMode === 'multiplayer') {
      setPlayMode('multiplayer');
      setMode('multiplayer-lobby');
      return;
    }
    
    const newSeed = Date.now();
    setGameState(createInitialGameState(newSeed));
    setResolvedHistory([]);
    setPendingP1(null);
    setPendingP2(null);
    setPlayMode(newPlayMode);
    
    if (difficulty) {
      setAIDifficulty(difficulty);
    }
    
    setMode('playing');
  }, []);

  // Handle action
  const handleAction = useCallback((player: 'player1' | 'player2', action: PlayerAction) => {
    if (!isActionLegal(gameState, player, action)) {
      return;
    }

    if (player === 'player1') {
      setPendingP1(action);

      if (playMode === 'ai') {
        setAiThinking(true);
        setTimeout(() => {
          const aiAction = chooseAction(gameState, 'player2', aiDifficulty);
          resolveBothActions(action, aiAction);
          setAiThinking(false);
        }, 600 + Math.random() * 400);
      }
    } else {
      setPendingP2(action);
    }

    if (playMode === 'local') {
      if (player === 'player1' && pendingP2) {
        resolveBothActions(action, pendingP2);
      } else if (player === 'player2' && pendingP1) {
        resolveBothActions(pendingP1, action);
      }
    }
  }, [gameState, playMode, aiDifficulty, pendingP1, pendingP2]);

  // Resolve turn - ONLY place where history grows
  const resolveBothActions = useCallback((p1Action: PlayerAction, p2Action: PlayerAction) => {
    const turnActions: TurnActions = {
      playerActions: [
        { playerId: 'player1', action: p1Action },
        { playerId: 'player2', action: p2Action }
      ]
    };

    const newState = resolveTurn(gameState, turnActions);
    setGameState(newState);
    setResolvedHistory(prev => [...prev, turnActions]);
    setPendingP1(null);
    setPendingP2(null);

    if (newState.gameOver) {
      recordGame(newState);
      setTimeout(() => setMode('results'), 500);
    }
  }, [gameState]);

  // Reset
  const resetGame = useCallback(() => {
    setMode('welcome');
    const newSeed = Date.now();
    setGameState(createInitialGameState(newSeed));
    setResolvedHistory([]);
    setPendingP1(null);
    setPendingP2(null);
    
    // Also reset multiplayer state
    multiplayer.reset();
  }, [multiplayer]);

  const playAgain = useCallback(() => {
    startGame(playMode, aiDifficulty);
  }, [playMode, aiDifficulty, startGame]);

  // GAME OVER SAFETY: If gameOver, ONLY show results
  if (mode === 'playing' && gameState.gameOver) {
    recordGame(gameState);
    setMode('results');
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MULTIPLAYER: Transition from lobby to game when GAME_START received
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (mode === 'multiplayer-lobby' && multiplayer.state.gameState && multiplayer.state.phase === 'starting') {
      setMode('multiplayer-game');
    }
  }, [mode, multiplayer.state.gameState, multiplayer.state.phase]);

  // ══════════════════════════════════════════════════════════════════════════
  // MULTIPLAYER: Handle game over
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (mode === 'multiplayer-game' && multiplayer.state.gameState?.gameOver) {
      recordGame(multiplayer.state.gameState);
    }
  }, [mode, multiplayer.state.gameState?.gameOver]);

  return (
    <>
      {mode === 'welcome' && (
        <WelcomeView onStart={startGame} />
      )}

      {mode === 'multiplayer-lobby' && (
        <MultiplayerLobbyView 
          multiplayer={multiplayer}
          onBack={resetGame}
        />
      )}

      {mode === 'multiplayer-game' && multiplayer.state.gameState && (
        <GameView
          gameState={multiplayer.state.gameState}
          playMode="multiplayer"
          aiDifficulty="medium"
          aiThinking={false}
          pendingP1={multiplayer.state.myRole === 'player1' && multiplayer.state.actionSubmitted ? { type: 'pass' } : null}
          pendingP2={multiplayer.state.myRole === 'player2' && multiplayer.state.actionSubmitted ? { type: 'pass' } : null}
          history={[]}
          onAction={(_player, action) => multiplayer.submitAction(action)}
          onQuit={() => {
            multiplayer.disconnect();
            resetGame();
          }}
          // Multiplayer-specific props
          multiplayerState={multiplayer.state}
          timeRemaining={multiplayer.timeRemaining}
          canAct={multiplayer.canAct}
          submittingStatus={multiplayer.submittingStatus}
        />
      )}

      {mode === 'multiplayer-game' && multiplayer.state.gameState?.gameOver && (
        <ResultsView
          gameState={multiplayer.state.gameState}
          history={[]}
          playMode="multiplayer"
          onPlayAgain={() => {
            multiplayer.reset();
            setMode('multiplayer-lobby');
          }}
          onQuit={() => {
            multiplayer.disconnect();
            resetGame();
          }}
        />
      )}

      {/* Multiplayer Safety Warning Banner */}
      {multiplayer.safetyWarning && (
        <div className="safety-warning-banner" onClick={multiplayer.clearSafetyWarning}>
          <span>⚠️ {multiplayer.safetyWarning}</span>
          {multiplayer.safetyWarning.includes('refresh') && (
            <button className="reload-btn" onClick={() => window.location.reload()}>
              Refresh Page
            </button>
          )}
          <button className="close-btn">×</button>
        </div>
      )}

      {mode === 'playing' && !gameState.gameOver && (
        <GameView
          gameState={gameState}
          playMode={playMode}
          aiDifficulty={aiDifficulty}
          aiThinking={aiThinking}
          pendingP1={pendingP1}
          pendingP2={pendingP2}
          history={resolvedHistory}
          onAction={handleAction}
          onQuit={resetGame}
        />
      )}

      {mode === 'results' && (
        <ResultsView
          gameState={gameState}
          history={resolvedHistory}
          playMode={playMode}
          onPlayAgain={playAgain}
          onQuit={resetGame}
        />
      )}
    </>
  );
}

function App() {
  const handleReset = () => {
    window.location.href = window.location.pathname;
  };

  return (
    <div className="app">
      <ErrorBoundary onReset={handleReset}>
        <AppContent />
      </ErrorBoundary>
    </div>
  );
}

export default App;
