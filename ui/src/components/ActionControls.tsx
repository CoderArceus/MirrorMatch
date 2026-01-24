/**
 * ActionControls - Completely redesigned
 * Compact, scrollable, all buttons accessible
 */

import React from 'react';
import type { GameState, PlayerAction } from '../../../engine/src/types';
import * as Engine from '../../../engine/src';
import './ActionControls.css';

interface ActionControlsProps {
  gameState: GameState;
  activePlayer: 'player1' | 'player2';
  onActionSelected: (action: PlayerAction) => void;
  actionsDisabled: boolean;
  asyncMode: boolean;
  isMyTurn: boolean;
  pendingAction?: PlayerAction;
  vsAI: boolean;
  aiThinking: boolean;
  onSwitchPlayer: () => void;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  gameState,
  activePlayer,
  onActionSelected,
  actionsDisabled,
}) => {
  const legalActions = Engine.getLegalActions(gameState, activePlayer);

  // Group actions
  const takeActions = legalActions.filter(a => a.type === 'take');
  const burnAction = legalActions.find(a => a.type === 'burn');
  const standActions = legalActions.filter(a => a.type === 'stand');
  const blindHitActions = legalActions.filter(a => a.type === 'blind_hit');
  const bidActions = legalActions.filter(a => a.type === 'bid');

  // If auction, show modal trigger
  if (bidActions.length > 0) {
    return (
      <div className="action-controls-compact">
        <button
          onClick={() => {
            // Trigger auction modal
            const event = new CustomEvent('open-auction-modal', {
              detail: { activePlayer, gameState, onActionSelected }
            });
            window.dispatchEvent(event);
          }}
          className="auction-trigger-btn"
          disabled={actionsDisabled}
        >
          🎯 Dark Auction - Place Bid
        </button>
      </div>
    );
  }

  return (
    <div className="action-controls-compact">
      {/* Take Actions */}
      {takeActions.length > 0 && (
        <div className="action-group-compact">
          <div className="group-label">Take Card</div>
          <div className="button-row">
            {takeActions.map(action => (
              <button
                key={action.targetLane}
                onClick={() => onActionSelected(action)}
                className="action-btn-compact take"
                disabled={actionsDisabled}
              >
                Lane {String.fromCharCode(65 + action.targetLane)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Burn */}
      {burnAction && (
        <div className="action-group-compact">
          <button
            onClick={() => onActionSelected(burnAction)}
            className="action-btn-compact burn"
            disabled={actionsDisabled}
          >
            🔥 Burn (1 ⚡)
          </button>
        </div>
      )}

      {/* Stand Actions */}
      {standActions.length > 0 && (
        <div className="action-group-compact">
          <div className="group-label">Stand Lane</div>
          <div className="button-row">
            {standActions.map(action => (
              <button
                key={action.targetLane}
                onClick={() => onActionSelected(action)}
                className="action-btn-compact stand"
                disabled={actionsDisabled}
              >
                Lane {String.fromCharCode(65 + action.targetLane)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Blind Hit Actions */}
      {blindHitActions.length > 0 && (
        <div className="action-group-compact">
          <div className="group-label">Blind Hit</div>
          <div className="button-row">
            {blindHitActions.map(action => (
              <button
                key={action.targetLane}
                onClick={() => onActionSelected(action)}
                className="action-btn-compact blind-hit"
                disabled={actionsDisabled}
              >
                Lane {String.fromCharCode(65 + action.targetLane)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pass - always available */}
      <div className="action-group-compact">
        <button
          onClick={() => onActionSelected({ type: 'pass' })}
          className="action-btn-compact pass"
          disabled={actionsDisabled}
        >
          Pass
        </button>
      </div>
    </div>
  );
};
