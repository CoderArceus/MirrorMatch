/**
 * AuctionModal - Compact redesign
 */

import React, { useState } from 'react';
import type { GameState, PlayerAction } from '../../../engine/src';
import './AuctionModal.css';

interface AuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  activePlayer: 'player1' | 'player2';
  onSubmit: (action: PlayerAction) => void;
}

export const AuctionModal: React.FC<AuctionModalProps> = ({
  isOpen,
  onClose,
  gameState,
  activePlayer,
  onSubmit,
}) => {
  const player = gameState.players.find(p => p.id === activePlayer)!;
  const [bidAmount, setBidAmount] = useState(0);
  const [voidStoneLane, setVoidStoneLane] = useState(0);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit({
      type: 'bid',
      bidAmount,
      potentialVoidStoneLane: voidStoneLane,
    });
    onClose();
  };

  return (
    <div className="auction-overlay" onClick={onClose}>
      <div className="auction-card" onClick={(e) => e.stopPropagation()}>
        <div className="auction-title">
          <span>🎯 Dark Auction</span>
          <button className="auction-close" onClick={onClose}>×</button>
        </div>

        <div className="bid-row">
          <span className="label">Bid:</span>
          <div className="bid-chips">
            {Array.from({ length: player.energy + 1 }, (_, i) => i).map(amount => (
              <button
                key={amount}
                onClick={() => setBidAmount(amount)}
                className={`chip ${bidAmount === amount ? 'active' : ''}`}
              >
                {amount}
              </button>
            ))}
          </div>
        </div>

        <div className="lane-row">
          <span className="label">Target:</span>
          <div className="lane-chips">
            {[0, 1, 2].map(lane => (
              <button
                key={lane}
                onClick={() => setVoidStoneLane(lane)}
                className={`chip ${voidStoneLane === lane ? 'active' : ''}`}
              >
                {String.fromCharCode(65 + lane)}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleSubmit} className="auction-submit">
          Submit {bidAmount} ⚡
        </button>
      </div>
    </div>
  );
};
