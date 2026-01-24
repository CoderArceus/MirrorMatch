/**
 * Seque UI - Redesigned from scratch
 * Proper simultaneous turn logic - both players act on the same card
 */

import { useState, useEffect } from 'react';
import {
  createInitialGameState,
  isActionLegal,
  resolveTurn,
  analyzeDrawDiagnostics,
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
import { MatchHub } from './components/MatchHub';
import { WelcomeScreen } from './components/WelcomeScreen';
import { AuctionModal } from './components/AuctionModal';

import './App.css';

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

  // CRITICAL: Pending actions for BOTH players - turn resolves when BOTH are submitted
  const [pendingActions, setPendingActions] = useState<{
    player1?: PlayerAction;
    player2?: PlayerAction;
  }>({});

  // History
  const [actionHistory, setActionHistory] = useState<TurnActions[]>([]);

  // AI State
  const [vsAI, setVsAI] = useState(false);
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('medium');
  const [aiThinking, setAiThinking] = useState(false);

  // Feedback State
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  // Async PvP Mode State
  const [asyncMode, setAsyncMode] = useState(false);
  const [myPlayerRole, setMyPlayerRole] = useState<'player1' | 'player2'>('player1');
  const [matchId, setMatchId] = useState<string>(crypto.randomUUID());

  // Analytics State
  const [frozenAnalytics, setFrozenAnalytics] = useState<GameAnalytics | null>(null);

  // Auction Modal State
  const [auctionModalOpen, setAuctionModalOpen] = useState(false);
  const [auctionModalPlayer, setAuctionModalPlayer] = useState<'player1' | 'player2'>('player1');

  // Listen for auction modal events
  useEffect(() => {
    const handleOpenAuction = (e: Event) => {
      const customEvent = e as CustomEvent;
      setAuctionModalPlayer(customEvent.detail.activePlayer);
      setAuctionModalOpen(true);
    };

    window.addEventListener('open-auction-modal', handleOpenAuction);
    return () => window.removeEventListener('open-auction-modal', handleOpenAuction);
  }, []);

  // Initialize from URL if present
  useEffect(() => {
    const decoded = getMatchFromURL();
    if (decoded) {
      setAsyncMode(true);
      setGameStarted(true);
      setGameSeed(decoded.seed);

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
    }
  }, []);

  const handleResetGame = () => {
    const newSeed = Date.now();
    setGameSeed(newSeed);
    setGameState(createInitialGameState(newSeed));
    setPendingActions({});
    setActionHistory([]);
    setFeedbackGiven(false);
    setAiThinking(false);
    setFrozenAnalytics(null);
    setMatchId(crypto.randomUUID());
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
    setAsyncMode(true);
    handleResetGame();
    setGameStarted(true);
  };

  const createAsyncChallenge = () => {
    const matchData = {
      seed: gameSeed,
      actions: actionHistory,
      pendingActions: {},
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

  // CORE GAME LOGIC: Handle player action submission
  const handleAction = async (playerId: 'player1' | 'player2', action: PlayerAction) => {
    console.log(`${playerId} submitted:`, action);

    // Validate action
    if (!isActionLegal(gameState, playerId, action)) {
      console.warn('Illegal action:', action);
      alert('That action is not legal!');
      return;
    }

    // Store pending action
    const newPending = {
      ...pendingActions,
      [playerId]: action
    };
    setPendingActions(newPending);

    // Check if we need to wait for other player or resolve immediately
    const otherPlayer = playerId === 'player1' ? 'player2' : 'player1';

    // AI Mode: If player1 acts, immediately generate AI action and resolve
    if (vsAI && playerId === 'player1') {
      setAiThinking(true);
      setTimeout(() => {
        const aiAction = chooseAction(gameState, 'player2', aiDifficulty);
        const turnActions: TurnActions = {
          playerActions: [
            { playerId: 'player1', action: action },
            { playerId: 'player2', action: aiAction }
          ]
        };
        resolveTurnNow(turnActions);
        setAiThinking(false);
      }, 600 + Math.random() * 400);
      return;
    }

    // Async Mode: Just store action and wait for opponent via URL
    if (asyncMode) {
      // In async, we don't auto-resolve - opponent will load URL with this pending action
      return;
    }

    // Local PvP: Check if other player has submitted
    if (newPending[otherPlayer]) {
      // Both players have submitted! Resolve turn
      const turnActions: TurnActions = {
        playerActions: [
          { playerId: 'player1', action: newPending.player1! },
          { playerId: 'player2', action: newPending.player2! }
        ]
      };
      resolveTurnNow(turnActions);
    } else {
      // Still waiting for other player
      console.log(`Waiting for ${otherPlayer} to submit action...`);
    }
  };

  // Helper to resolve turn
  const resolveTurnNow = (turnActions: TurnActions) => {
    const newState = resolveTurn(gameState, turnActions);
    setGameState(newState);
    
    const newHistory = [...actionHistory, turnActions];
    setActionHistory(newHistory);
    setPendingActions({}); // Clear pending

    // Check game over
    if (newState.gameOver) {
      recordGame(newState);

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

      saveReplay({
        id: matchId,
        seed: gameSeed,
        actions: newHistory,
        finalState: newState,
        timestamp: Date.now()
      });
    }
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

  // Determine which player can act
  const player1CanAct = !pendingActions.player1 && !gameState.gameOver;
  const player2CanAct = !pendingActions.player2 && !gameState.gameOver && !vsAI;

  return (
    <div className="app">
      <div className="game-container compact-layout">

        {/* Top Section */}
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
            {SHOW_DEBUG_REPLAY_INFO && (
              <div className="debug-info">
                Seed: {gameSeed} | Turns: {actionHistory.length} | 
                P1 Pending: {pendingActions.player1?.type || 'none'} | 
                P2 Pending: {pendingActions.player2?.type || 'none'}
              </div>
            )}
          </header>

          {asyncMode && !gameState.gameOver && (
            <MatchHub
              gameState={gameState}
              activePlayer={myPlayerRole}
              gameSeed={gameSeed}
              actionHistory={actionHistory}
              pendingActions={pendingActions}
            />
          )}
        </div>

        {/* Main Battlefield */}
        <div className="battlefield">
          {/* Player 1 - Left */}
          <div className={`player-zone ${player1CanAct ? 'can-act' : ''} ${pendingActions.player1 ? 'action-submitted' : ''}`}>
            <PlayerPanel
              player={gameState.players[0]}
              playerName="Player 1"
              isActive={player1CanAct}
              pendingAction={pendingActions.player1}
            />
          </div>

          {/* Center Queue */}
          <div className="battlefield-center">
            <GameQueue queue={gameState.queue} deckSize={gameState.deck.length} />
            
            {/* Pending Actions Indicator */}
            {!gameState.gameOver && (
              <div className="turn-status">
                <div className={`player-status ${pendingActions.player1 ? 'submitted' : 'waiting'}`}>
                  P1: {pendingActions.player1 ? `✓ ${pendingActions.player1.type}` : 'Waiting...'}
                </div>
                {!vsAI && (
                  <div className={`player-status ${pendingActions.player2 ? 'submitted' : 'waiting'}`}>
                    P2: {pendingActions.player2 ? `✓ ${pendingActions.player2.type}` : 'Waiting...'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Player 2 - Right */}
          <div className={`player-zone ${player2CanAct ? 'can-act' : ''} ${pendingActions.player2 ? 'action-submitted' : ''}`}>
            <PlayerPanel
              player={gameState.players[1]}
              playerName={vsAI ? `AI (${aiDifficulty})` : "Player 2"}
              isActive={player2CanAct}
              pendingAction={pendingActions.player2}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="controls-section">
          {/* Player 1 Controls */}
          {!vsAI || true ? (
            <div className="player-controls">
              <h3>Player 1 Actions</h3>
              <ActionControls
                gameState={gameState}
                activePlayer="player1"
                onActionSelected={(action) => handleAction('player1', action)}
                actionsDisabled={!player1CanAct || aiThinking}
                asyncMode={asyncMode}
                isMyTurn={true}
                pendingAction={pendingActions.player1}
                vsAI={vsAI}
                aiThinking={aiThinking}
                onSwitchPlayer={() => {}}
              />
            </div>
          ) : null}

          {/* Player 2 Controls (Local PvP only) */}
          {!vsAI && (
            <div className="player-controls">
              <h3>Player 2 Actions</h3>
              <ActionControls
                gameState={gameState}
                activePlayer="player2"
                onActionSelected={(action) => handleAction('player2', action)}
                actionsDisabled={!player2CanAct}
                asyncMode={false}
                isMyTurn={true}
                pendingAction={pendingActions.player2}
                vsAI={false}
                aiThinking={false}
                onSwitchPlayer={() => {}}
              />
            </div>
          )}
        </div>

        {/* History Strip - Minimal */}
        <div id="history-strip" className="history-strip">
          <span className="history-label">History:</span>
          {actionHistory.map((turn, i) => (
            <div key={i} className="history-chip">
              T{i + 1}: {turn.playerActions[0].action.type[0]}{turn.playerActions[1].action.type[0]}
            </div>
          ))}
        </div>

        {/* Game Over Overlay */}
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

        {/* Auction Modal */}
        <AuctionModal
          isOpen={auctionModalOpen}
          onClose={() => setAuctionModalOpen(false)}
          gameState={gameState}
          activePlayer={auctionModalPlayer}
          onSubmit={(action) => {
            handleAction(auctionModalPlayer, action);
            setAuctionModalOpen(false);
          }}
        />

      </div>
    </div>
  );
}

export default App;
