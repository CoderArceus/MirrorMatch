/**
 * Seque - Production Ready (Day 38)
 * Static frontend with replay-first determinism
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
import { getMatchFromURL, createShareableURL, type EncodedMatch } from './utils/encodeMatch';
import { recordGame } from './utils/storage';

import './App.css';

// Production constants
const MAX_REPLAY_TURNS = 100;

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
    console.error('Seque Error:', error, errorInfo);
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

type AppMode = 'welcome' | 'playing' | 'results' | 'error';
type PlayMode = 'local' | 'ai' | 'async';

function AppContent() {
  // App State
  const [mode, setMode] = useState<AppMode>('welcome');
  const [playMode, setPlayMode] = useState<PlayMode>('local');
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('medium');

  // Game State
  const [gameSeed, setGameSeed] = useState(Date.now());
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState(Date.now()));
  const [history, setHistory] = useState<TurnActions[]>([]);

  // Turn State
  const [pendingP1, setPendingP1] = useState<PlayerAction | null>(null);
  const [pendingP2, setPendingP2] = useState<PlayerAction | null>(null);
  const [aiThinking, setAiThinking] = useState(false);

  // Async PvP State
  const [myRole, setMyRole] = useState<'player1' | 'player2'>('player1');
  const [asyncError, setAsyncError] = useState<string | null>(null);
  const [showShareHint, setShowShareHint] = useState(false);
  const [replayVerified, setReplayVerified] = useState(false);
  const [replayTruncated, setReplayTruncated] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // Check URL for async match on load
  useEffect(() => {
    const matchFromURL = getMatchFromURL();
    if (matchFromURL) {
      loadAsyncMatch(matchFromURL);
    }
  }, []);

  // Load async match from URL data with safety checks
  const loadAsyncMatch = useCallback((encodedMatch: EncodedMatch) => {
    try {
      // Validate seed
      if (typeof encodedMatch.seed !== 'number' || !isFinite(encodedMatch.seed)) {
        setFatalError('This match link is invalid or corrupted');
        setMode('error');
        return;
      }

      // Safety: Cap replay turns
      let actions = encodedMatch.actions;
      let truncated = false;
      if (actions.length > MAX_REPLAY_TURNS) {
        actions = actions.slice(0, MAX_REPLAY_TURNS);
        truncated = true;
      }

      // Recreate game state from seed and replay actions
      let state = createInitialGameState(encodedMatch.seed);
      
      // Replay all completed turns with validation
      for (let i = 0; i < actions.length; i++) {
        const turnAction = actions[i];
        
        if (!turnAction.playerActions || turnAction.playerActions.length !== 2) {
          setFatalError('This match link is invalid or corrupted');
          setMode('error');
          return;
        }
        
        state = resolveTurn(state, turnAction);
        
        if (state.gameOver && i < actions.length - 1) {
          setFatalError('This match link is invalid or corrupted');
          setMode('error');
          return;
        }
      }

      setGameSeed(encodedMatch.seed);
      setMyRole(encodedMatch.currentPlayer);
      setPlayMode('async');
      setGameState(state);
      setHistory(actions);
      setReplayVerified(true);
      setReplayTruncated(truncated);
      
      if (encodedMatch.pendingActions.player1) {
        setPendingP1(encodedMatch.pendingActions.player1);
      }
      if (encodedMatch.pendingActions.player2) {
        setPendingP2(encodedMatch.pendingActions.player2);
      }
      
      setMode('playing');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      console.error('Async match load error:', err);
      setFatalError('This match link is invalid or corrupted');
      setMode('error');
    }
  }, []);

  // Start new game
  const startGame = useCallback((newPlayMode: PlayMode, difficulty?: AIDifficulty) => {
    const newSeed = Date.now();
    setGameSeed(newSeed);
    setGameState(createInitialGameState(newSeed));
    setHistory([]);
    setPendingP1(null);
    setPendingP2(null);
    setPlayMode(newPlayMode);
    setAsyncError(null);
    setShowShareHint(false);
    setReplayVerified(false);
    setReplayTruncated(false);
    setFatalError(null);
    
    if (difficulty) {
      setAIDifficulty(difficulty);
    }
    
    if (newPlayMode === 'async') {
      setMyRole('player1');
      setTimeout(() => setShowShareHint(true), 1000);
    }
    
    setMode('playing');
  }, []);

  // Handle player action
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
      
      if (playMode === 'async') {
        generateShareURL(action, null);
      }
    } else {
      setPendingP2(action);
      
      if (playMode === 'async') {
        generateShareURL(pendingP1, action);
      }
    }

    if (playMode === 'local') {
      if (player === 'player1' && pendingP2) {
        resolveBothActions(action, pendingP2);
      } else if (player === 'player2' && pendingP1) {
        resolveBothActions(pendingP1, action);
      }
    }
  }, [gameState, playMode, aiDifficulty, pendingP1, pendingP2]);

  // Generate shareable URL
  const generateShareURL = useCallback((p1Action: PlayerAction | null, p2Action: PlayerAction | null) => {
    const pendingActions: Record<string, PlayerAction> = {};
    if (p1Action) pendingActions['player1'] = p1Action;
    if (p2Action) pendingActions['player2'] = p2Action;

    const encoded: EncodedMatch = {
      seed: gameSeed,
      actions: history,
      pendingActions,
      currentPlayer: myRole === 'player1' ? 'player2' : 'player1',
      version: 1
    };

    const url = createShareableURL(encoded);
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setShowShareHint(true);
        setTimeout(() => setShowShareHint(false), 3000);
      }).catch(() => {
        prompt('Copy this link to share:', url);
      });
    } else {
      prompt('Copy this link to share:', url);
    }
  }, [gameSeed, history, myRole]);

  // Resolve turn
  const resolveBothActions = useCallback((p1Action: PlayerAction, p2Action: PlayerAction) => {
    const turnActions: TurnActions = {
      playerActions: [
        { playerId: 'player1', action: p1Action },
        { playerId: 'player2', action: p2Action }
      ]
    };

    const newState = resolveTurn(gameState, turnActions);
    setGameState(newState);
    setHistory(prev => [...prev, turnActions]);
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
    setGameSeed(newSeed);
    setGameState(createInitialGameState(newSeed));
    setHistory([]);
    setPendingP1(null);
    setPendingP2(null);
    setAsyncError(null);
    setShowShareHint(false);
    setReplayVerified(false);
    setReplayTruncated(false);
    setFatalError(null);
  }, []);

  const playAgain = useCallback(() => {
    startGame(playMode, aiDifficulty);
  }, [playMode, aiDifficulty, startGame]);

  // Fatal error screen
  if (mode === 'error' && fatalError) {
    return (
      <div className="fatal-error-screen">
        <div className="error-panel">
          <div className="error-icon">⚠️</div>
          <h1>Match Load Failed</h1>
          <p>{fatalError}</p>
          <button className="error-btn" onClick={resetGame}>
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {mode === 'welcome' && (
        <WelcomeView onStart={startGame} />
      )}

      {mode === 'playing' && (
        <GameView
          gameState={gameState}
          playMode={playMode}
          aiDifficulty={aiDifficulty}
          aiThinking={aiThinking}
          pendingP1={pendingP1}
          pendingP2={pendingP2}
          history={history}
          onAction={handleAction}
          onQuit={resetGame}
        />
      )}

      {mode === 'results' && (
        <ResultsView
          gameState={gameState}
          history={history}
          playMode={playMode}
          onPlayAgain={playAgain}
          onQuit={resetGame}
        />
      )}

      {/* Replay Verified Banner */}
      {replayVerified && mode === 'playing' && (
        <div className="replay-verified">
          <span>✓ State reconstructed from replay</span>
        </div>
      )}

      {/* Replay Truncated Warning */}
      {replayTruncated && mode === 'playing' && (
        <div className="replay-truncated">
          <span>⚠️ Replay truncated for safety</span>
        </div>
      )}

      {/* Async Error Toast */}
      {asyncError && (
        <div className="error-toast">
          <span>⚠️ {asyncError}</span>
          <button onClick={() => setAsyncError(null)}>×</button>
        </div>
      )}

      {/* Async Share Hint */}
      {showShareHint && playMode === 'async' && mode === 'playing' && (
        <div className="async-hint">
          <span>🔗 Share URL copied! Send to opponent.</span>
        </div>
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
