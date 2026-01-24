/**
 * MirrorMatch UI - Minimal Local Play
 * Engine is treated as a BLACK BOX - no modifications
 */

import { useState, useEffect } from 'react';
import {
  createInitialGameState,
  isActionLegal,
  resolveTurn,
  analyzeDrawDiagnostics,
  // AI
  chooseAction
} from '../../engine/src';

import type {
  GameState,
  PlayerAction,
  TurnActions,
  AIDifficulty
} from '../../engine/src';

import { getMatchFromURL, createShareableURL } from './utils/encodeMatch';
import { runReplay } from '../../engine/src';
import {
  recordGame,
  saveReplay,
  saveFeedback,
} from './utils/storage';
import type { FeedbackType } from './utils/storage';

// Components
import { TurnHeader } from './components/TurnHeader';
import { PlayerPanel } from './components/PlayerPanel';
import { GameQueue } from './components/GameQueue';
import { ActionControls } from './components/ActionControls';
import { GameOverScreen } from './components/GameOverScreen';
// import { SessionStats } from './components/SessionStats';
import { MatchHub } from './components/MatchHub';
import { WelcomeScreen } from './components/WelcomeScreen';

import './App.css';

// Day 32: Dev visual verification mode (UI-only)
const SHOW_DEBUG_REPLAY_INFO = false;

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

function App() {
  // Navigation State
  const [gameStarted, setGameStarted] = useState(false);

  // Game State
  const [gameSeed, setGameSeed] = useState<number>(Date.now());
  const [gameState, setGameState] = useState<GameState>(createInitialGameState(gameSeed));
  const [activePlayer, setActivePlayer] = useState<'player1' | 'player2'>('player1');

  // Pending actions (for Async/Simultaneous play)
  const [pendingActions, setPendingActions] = useState<Record<string, PlayerAction>>({});

  // History (Source of Truth for Replay)
  const [actionHistory, setActionHistory] = useState<TurnActions[]>([]);

  // AI State
  const [vsAI, setVsAI] = useState(false);
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('medium');
  const [aiThinking, setAiThinking] = useState(false);

  // Stats State - Temporarily unused in compact view, but load to init
  // const [stats, setStats] = useState<SessionStatsType>(loadStats());

  // Feedback State
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  // Async PvP Mode State
  const [asyncMode, setAsyncMode] = useState(false);
  const [myPlayerRole, setMyPlayerRole] = useState<'player1' | 'player2'>('player1'); // Who am I?
  const [matchId, setMatchId] = useState<string>(crypto.randomUUID());

  // Analytics State (Game Over)
  const [frozenAnalytics, setFrozenAnalytics] = useState<GameAnalytics | null>(null);

  // Initialize from URL if present
  useEffect(() => {
    const decoded = getMatchFromURL();
    if (decoded) {
      setAsyncMode(true);
      setGameStarted(true); // Skip welcome screen
      setGameSeed(decoded.seed);

      // Replay history to get current state
      let currentState = createInitialGameState(decoded.seed);
      if (decoded.actions.length > 0) {
        currentState = runReplay({
          initialState: currentState,
          turns: decoded.actions
        });
      }

      setGameState(currentState);
      setActionHistory(decoded.actions);
      setPendingActions(decoded.pendingActions);
      setMyPlayerRole(decoded.currentPlayer);
      setActivePlayer(decoded.currentPlayer);

      // Clear URL to prevent refresh issues (optional, but clean)
      // window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Update Stats UI when handling storage updates
  const refreshStats = () => {
    // setStats(loadStats());
  };

  const handleResetGame = () => {
    const newSeed = Date.now();
    setGameSeed(newSeed);
    setGameState(createInitialGameState(newSeed));
    setActivePlayer('player1');
    setPendingActions({});
    setActionHistory([]);
    setFeedbackGiven(false);
    setAiThinking(false);
    setFrozenAnalytics(null);

    // In async mode, reset creates a new match ID for analytics
    if (asyncMode) {
      setMatchId(crypto.randomUUID());
      // Optionally exit async mode on reset? Or stay in it?
      // Staying allows easy rematch if we update URL.
      // But usually "Play Again" in async means "Create New Challenge"
    } else {
      setMatchId(crypto.randomUUID());
    }

    // Keep gameStarted true to stay in game view
    refreshStats();
  };

  const handleStartLocal = () => {
    setVsAI(false);
    setAsyncMode(false);
    handleResetGame();
    setGameStarted(true);
  };

  const handleStartAI = (difficulty: AIDifficulty) => {
    setVsAI(true);
    setAIDifficulty(difficulty);
    setAsyncMode(false);
    handleResetGame();
    setGameStarted(true);
  };

  const handleCreateAsync = () => {
    setAsyncMode(true); // Will show creation UI inside game or specialized view
    // For now, jump to game view turn 1 which has "Create Challenge" button
    handleResetGame();
    setGameStarted(true);
  };

  const createAsyncChallenge = () => {
    const matchData = {
      seed: gameSeed,
      actions: actionHistory,
      pendingActions: {}, // Fresh start
      currentPlayer: 'player1' as const,
      version: 1
    };
    const url = createShareableURL(matchData);
    navigator.clipboard.writeText(url);
    alert('Match link copied to clipboard! Send it to a friend.');
  };

  const handleShareMatch = () => {
    createAsyncChallenge();
  };

  // Turn Resolution Logic
  const handleAction = async (action: PlayerAction) => {
    // Determine active player's ID
    const actingPlayerId = activePlayer;

    // AI Guard
    if (vsAI && actingPlayerId === 'player2' && !aiThinking) return;

    // 1. Validate Action
    if (!isActionLegal(gameState, actingPlayerId, action)) {
      console.warn('Illegal action:', action);
      return;
    }

    // SPECIAL LOGIC: Auction Phase (Bid Actions)
    // Requires BOTH players to bid before detecting resolution
    if (action.type === 'bid') {
      const otherPlayerId = actingPlayerId === 'player1' ? 'player2' : 'player1';

      // 1. If vsAI: Human bids, AI immediately bids, then resolve
      if (vsAI && actingPlayerId === 'player1') {
        // Human bid recorded, now generate AI bid
        // AI Logic for bidding: Random or simple heuristic
        const aiPlayer = gameState.players[1];
        const aiBidAmount = Math.floor(Math.random() * (aiPlayer.energy + 1)); // Simple random bid

        // In a real implementation, use `chooseAction` if it supports bidding
        // Assuming chooseAction handles it or we do simple logic
        // Let's rely on chooseAction if it supports it, OR fallback
        let aiAction: PlayerAction = { type: 'bid', bidAmount: aiBidAmount, potentialVoidStoneLane: 0 };
        try {
          // If chooseAction is robust it returns a bid during auction
          aiAction = chooseAction(gameState, 'player2', aiDifficulty);
        } catch (e) {
          // Fallback if AI doesn't support bidding yet
        }

        const turnActions: TurnActions = {
          playerActions: [
            { playerId: 'player1', action: action },
            { playerId: 'player2', action: aiAction }
          ]
        };

        // Resolve immediately
        const newState = resolveTurn(gameState, turnActions);
        finalizeTurn(newState, turnActions);
        setAiThinking(false);
        return;
      }

      // 2. If Local PvP: Store bid, switch player, wait for second bid
      if (!asyncMode) {
        const currentPending = pendingActions[otherPlayerId];
        if (!currentPending) {
          // First player bid: Store and switch
          setPendingActions({
            ...pendingActions,
            [actingPlayerId]: action
          });
          setActivePlayer(otherPlayerId);
          return; // WAIT for second player
        } else {
          // Second player bid: We have both! Resolve.
          // Note: currentPending is the *other* player's bid
          const p1Action = actingPlayerId === 'player1' ? action : currentPending;
          const p2Action = actingPlayerId === 'player2' ? action : currentPending;

          const turnActions: TurnActions = {
            playerActions: [
              { playerId: 'player1', action: p1Action },
              { playerId: 'player2', action: p2Action }
            ]
          };

          const newState = resolveTurn(gameState, turnActions);
          finalizeTurn(newState, turnActions);
          return;
        }
      }
    }

    // Async / Simultaneous Logic
    // If we are in "Async Mode" and it's My Turn, or Normal Mode
    let newPending = { ...pendingActions };

    if (asyncMode) {
      // Just record my action locally in pending
      newPending[actingPlayerId] = action;
      setPendingActions(newPending);

      // Allow immediate partial resolution for visual "pending" state?
      // No, for async we typically wait or just show "Action Submitted"
      // But for the sake of this UI, let's treat it as "Local Validated" 
      // and wait for opponent (which is mocked or handled via link).
      return;
    }

    // Standard Turn Resolution (Sequential/One-at-a-time where other passes)
    // Structure TurnActions
    let p1Action = actingPlayerId === 'player1' ? action : { type: 'pass' };
    let p2Action = actingPlayerId === 'player2' ? action : { type: 'pass' };

    const turnActions: TurnActions = {
      playerActions: [
        { playerId: 'player1', action: p1Action as any },
        { playerId: 'player2', action: p2Action as any }
      ]
    };

    const newState = resolveTurn(gameState, turnActions);
    finalizeTurn(newState, turnActions);
  };

  // Helper to finalize state updates after resolution
  const finalizeTurn = (newState: GameState, turnActions: TurnActions) => {
    // Update State
    setGameState(newState);
    const newHistory = [...actionHistory, turnActions];
    setActionHistory(newHistory);
    setPendingActions({}); // Clear pending

    // Check Game Over
    if (newState.gameOver) {
      recordGame(newState);

      // Analyze immediately for results
      const diagnostics = analyzeDrawDiagnostics(
        newState,
        'player1',
        'player2',
        newHistory.flatMap(turn => turn.playerActions.map(pa => ({ playerId: pa.playerId, action: pa.action })))
      );

      setFrozenAnalytics({
        playerMetrics: diagnostics.p1,
        opponentMetrics: diagnostics.p2,
        contestableLanes: diagnostics.p1.contestableLanes
      });

      // Save Replay
      saveReplay({
        id: matchId,
        seed: gameSeed,
        actions: newHistory,
        finalState: newState,
        timestamp: Date.now()
      });

      refreshStats();
      return;
    }

    // Switch Player (if game not over)
    const nextPlayer = activePlayer === 'player1' ? 'player2' : 'player1';
    setActivePlayer(nextPlayer);

    // AI Logic Trigger (Standard Moves)
    // Only trigger if it wasn't an auction (which handles itself) 
    // AND if it's now AI's turn
    if (vsAI && nextPlayer === 'player2') {
      setAiThinking(true);
      setTimeout(() => {
        const aiAction = chooseAction(newState, 'player2', aiDifficulty);

        const aiTurnActions: TurnActions = {
          playerActions: [
            { playerId: 'player1', action: { type: 'pass' } },
            { playerId: 'player2', action: aiAction }
          ]
        };
        const afterAiState = resolveTurn(newState, aiTurnActions);
        finalizeTurn(afterAiState, aiTurnActions);
        setAiThinking(false);

      }, 800 + Math.random() * 500); // 0.8s - 1.3s delay
    }
  };

  // Helper for submitting UI action
  const submitAction = (action: PlayerAction) => {
    handleAction(action);
  };

  const manuallySwitchPlayer = () => {
    setActivePlayer(p => p === 'player1' ? 'player2' : 'player1');
  };

  const submitFeedback = (type: FeedbackType) => {
    saveFeedback({
      gameId: matchId,
      type,
      timestamp: Date.now()
    });
    setFeedbackGiven(true);
  };

  const scrollToHistory = () => {
    const el = document.getElementById('history-strip');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  if (!gameStarted && !asyncMode) {
    return (
      <WelcomeScreen
        onStartLocal={handleStartLocal}
        onStartAI={handleStartAI}
        onCreateAsync={handleCreateAsync}
      />
    );
  }

  // Determine if it's "My Turn" (for UI state)
  const isMyTurn = activePlayer === myPlayerRole;
  // In local mode, I am always the active player (hotseat)
  const effectiveIsMyTurn = asyncMode ? isMyTurn : true;
  // Actions disabled if AI thinking OR (Async AND Not My Turn)
  const actionsDisabled = (vsAI && aiThinking) || (asyncMode && !isMyTurn) || gameState.gameOver;

  return (
    <div className="app">
      <div className="game-container compact-layout">

        {/* Top Section (Header + Hub) */}
        <div className="top-section">
          <header className="game-header">
            <TurnHeader
              turnNumber={gameState.turnNumber}
              gameOver={gameState.gameOver}
              winner={gameState.winner}
              aiThinking={aiThinking}
              vsAI={vsAI}
              aiDifficulty={aiDifficulty}
              asyncMode={asyncMode}
              onToggleVsAI={setVsAI}
              onSetAIDifficulty={setAIDifficulty}
              onCreateAsyncChallenge={createAsyncChallenge}
            />
            {SHOW_DEBUG_REPLAY_INFO && <div className="debug-info">Seed: {gameSeed} | Turns: {actionHistory.length}</div>}
          </header>

          {/* Match Hub (History in Async) */}
          {asyncMode && !gameState.gameOver && (
            <MatchHub
              gameState={gameState}
              activePlayer={activePlayer}
              gameSeed={gameSeed}
              actionHistory={actionHistory}
              pendingActions={pendingActions}
            />
          )}
        </div>

        {/* Main Battlefield (Split View) */}
        <div className="battlefield">
          {/* Player 2 (Opponent/AI) - Top or Right */}
          <div className={`player-zone opponent-zone ${activePlayer === 'player2' ? 'active-turn' : ''}`}>
            <PlayerPanel
              player={gameState.players[1]}
              playerName={vsAI ? `AI (${aiDifficulty})` : "Player 2"}
              isActive={activePlayer === 'player2'}
            />
          </div>

          {/* Middle Info / Queue */}
          <div className="battlefield-center">
            <GameQueue queue={gameState.queue} deckSize={gameState.deck.length} />
          </div>

          {/* Player 1 (You) - Bottom or Left */}
          <div className={`player-zone player-zone ${activePlayer === 'player1' ? 'active-turn' : ''}`}>
            <PlayerPanel
              player={gameState.players[0]}
              playerName="Player 1"
              isActive={activePlayer === 'player1'}
              pendingAction={pendingActions['player1']}
            />
          </div>
        </div>

        {/* Controls (Fixed Bottom) */}
        <div className="controls-area">
          <ActionControls
            gameState={gameState}
            activePlayer={activePlayer}
            onActionSelected={submitAction}
            actionsDisabled={actionsDisabled}
            asyncMode={asyncMode}
            isMyTurn={effectiveIsMyTurn}
            pendingAction={pendingActions[activePlayer]}
            vsAI={vsAI}
            aiThinking={aiThinking}
            onSwitchPlayer={manuallySwitchPlayer}
          />
        </div>

        {/* History Strip (Horizontal) */}
        <div id="history-strip" className="history-strip">
          {actionHistory.map((turn, i) => (
            <div key={i} className="history-card">
              <div className="turn-label">T{i + 1}</div>
              <div className="history-actions">
                <span className="p1-act">P1: {turn.playerActions[0].action.type}</span>
                <span className="p2-act">P2: {turn.playerActions[1].action.type}</span>
              </div>
            </div>
          ))}
          <div className="history-shim"></div>
        </div>

        {/* Overlays */}
        {gameState.gameOver && (
          <div className="overlay-backdrop">
            <GameOverScreen
              gameState={gameState}
              myPlayerRole={asyncMode ? myPlayerRole : 'player1'}
              asyncMode={asyncMode}
              frozenAnalytics={frozenAnalytics}
              actionHistory={actionHistory}
              resetGame={handleResetGame}
              feedbackGiven={feedbackGiven}
              submitFeedback={submitFeedback}
              shareMatch={handleShareMatch}
              scrollToHistory={scrollToHistory}
            />
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
