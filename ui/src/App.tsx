/**
 * MirrorMatch - Production Ready
 * Static frontend with replay-first determinism
 */

import { useState, useEffect, useCallback } from 'react';
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
const APP_VERSION = '2.5';
const MAX_REPLAY_TURNS = 100; // Safety cap for replay

type AppMode = 'welcome' | 'playing' | 'results' | 'error';
type PlayMode = 'local' | 'ai' | 'async';

function App() {
  // App State
  const [mode, setMode] = useState<AppMode>('welcome');
  const [playMode, setPlayMode] = useState<PlayMode>('local');
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('medium');

  // Game State
  const [gameSeed, setGameSeed] = useState(Date.now());
  const [gameState, setGameState] = useState<GameState>(() => createInitialGameState(Date.now()));
  const [history, setHistory] = useState<TurnActions[]>([]);

  // Turn State (for simultaneous play)
  const [pendingP1, setPendingP1] = useState<PlayerAction | null>(null);
  const [pendingP2, setPendingP2] = useState<PlayerAction | null>(null);
  const [aiThinking, setAiThinking] = useState(false);

  // Async PvP State
  const [myRole, setMyRole] = useState<'player1' | 'player2'>('player1');
  const [asyncError, setAsyncError] = useState<string | null>(null);
  const [showShareHint, setShowShareHint] = useState(false);
  const [replayVerified, setReplayVerified] = useState(false);
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
      // Safety: Cap replay turns
      if (encodedMatch.actions.length > MAX_REPLAY_TURNS) {
        setFatalError('This match link is invalid or corrupted');
        setMode('error');
        return;
      }

      // Validate seed
      if (typeof encodedMatch.seed !== 'number' || !isFinite(encodedMatch.seed)) {
        setFatalError('This match link is invalid or corrupted');
        setMode('error');
        return;
      }

      // Recreate game state from seed and replay actions
      let state = createInitialGameState(encodedMatch.seed);
      
      // Replay all completed turns with validation
      for (let i = 0; i < encodedMatch.actions.length; i++) {
        const turnAction = encodedMatch.actions[i];
        
        // Validate turn structure
        if (!turnAction.playerActions || turnAction.playerActions.length !== 2) {
          setFatalError('This match link is invalid or corrupted');
          setMode('error');
          return;
        }
        
        state = resolveTurn(state, turnAction);
        
        // Safety: Check for unexpected game over during replay
        if (state.gameOver && i < encodedMatch.actions.length - 1) {
          setFatalError('This match link is invalid or corrupted');
          setMode('error');
          return;
        }
      }

      setGameSeed(encodedMatch.seed);
      setMyRole(encodedMatch.currentPlayer);
      setPlayMode('async');
      setGameState(state);
      setHistory(encodedMatch.actions);
      setReplayVerified(true);
      
      // Set pending actions if any
      if (encodedMatch.pendingActions.player1) {
        setPendingP1(encodedMatch.pendingActions.player1);
      }
      if (encodedMatch.pendingActions.player2) {
        setPendingP2(encodedMatch.pendingActions.player2);
      }
      
      setMode('playing');
      
      // Clear URL params
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
    setFatalError(null);
    
    if (difficulty) {
      setAIDifficulty(difficulty);
    }
    
    if (newPlayMode === 'async') {
      setMyRole('player1');
      // Show share hint after a short delay
      setTimeout(() => setShowShareHint(true), 1000);
    }
    
    setMode('playing');
  }, []);

  // Handle player action
  const handleAction = useCallback((player: 'player1' | 'player2', action: PlayerAction) => {
    // Validate
    if (!isActionLegal(gameState, player, action)) {
      console.warn('Illegal action attempted:', action);
      return;
    }

    // Store pending action
    if (player === 'player1') {
      setPendingP1(action);

      // If AI mode, trigger AI response
      if (playMode === 'ai') {
        setAiThinking(true);
        setTimeout(() => {
          const aiAction = chooseAction(gameState, 'player2', aiDifficulty);
          resolveBothActions(action, aiAction);
          setAiThinking(false);
        }, 600 + Math.random() * 400);
      }
      
      // If async mode, generate share URL
      if (playMode === 'async') {
        generateShareURL(action, null);
      }
    } else {
      setPendingP2(action);
      
      // If async mode, generate share URL
      if (playMode === 'async') {
        generateShareURL(pendingP1, action);
      }
    }

    // If both pending (local mode), resolve
    if (playMode === 'local') {
      if (player === 'player1' && pendingP2) {
        resolveBothActions(action, pendingP2);
      } else if (player === 'player2' && pendingP1) {
        resolveBothActions(pendingP1, action);
      }
    }
  }, [gameState, playMode, aiDifficulty, pendingP1, pendingP2]);

  // Generate shareable URL for async mode
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
    
    // Copy to clipboard with fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setShowShareHint(true);
        setTimeout(() => setShowShareHint(false), 3000);
      }).catch(() => {
        // Fallback: show URL in prompt
        prompt('Copy this link to share:', url);
      });
    } else {
      // Fallback for older browsers
      prompt('Copy this link to share:', url);
    }
  }, [gameSeed, history, myRole]);

  // Resolve turn with both actions
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

    // Check game over
    if (newState.gameOver) {
      recordGame(newState);
      setTimeout(() => setMode('results'), 500);
    }
  }, [gameState]);

  // Reset to welcome
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
    setFatalError(null);
  }, []);

  // Play again with same settings
  const playAgain = useCallback(() => {
    startGame(playMode, aiDifficulty);
  }, [playMode, aiDifficulty, startGame]);

  // Fatal error screen
  if (mode === 'error' && fatalError) {
    return (
      <div className="app">
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
        <footer className="app-footer">
          <span>MirrorMatch v{APP_VERSION} — Replay-Verified</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="app">
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

      {/* Async Error Toast */}
      {asyncError && (
        <div className="error-toast">
          <span>⚠️ {asyncError}</span>
          <button onClick={() => setAsyncError(null)}>×</button>
        </div>
      )}

      {/* Async Share Reminder */}
      {showShareHint && playMode === 'async' && mode === 'playing' && (
        <div className="async-hint">
          <span>🔗 Share URL copied! Send to opponent.</span>
        </div>
      )}

      {/* Version Footer */}
      <footer className="app-footer">
        <span>MirrorMatch v{APP_VERSION} — Replay-Verified</span>
      </footer>
    </div>
  );
}

export default App;
