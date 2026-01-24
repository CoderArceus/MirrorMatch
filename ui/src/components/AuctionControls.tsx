import React, { useState } from 'react';
import type { GameState, PlayerAction, BidAction } from '../../../engine/src/types';
import './AuctionControls.css';

interface AuctionControlsProps {
    onSubmit: (action: PlayerAction) => void;
    activePlayer: 'player1' | 'player2';
    gameState: GameState;
    actionsDisabled: boolean;
}

export const AuctionControls: React.FC<AuctionControlsProps> = ({
    onSubmit,
    activePlayer,
    gameState,
    actionsDisabled
}) => {
    const [bidAmount, setBidAmount] = useState(0);
    const [voidStoneLane, setVoidStoneLane] = useState(0);

    const player = gameState.players.find(p => p.id === activePlayer)!;
    const maxBid = player.energy;

    const handleSubmit = () => {
        const action: BidAction = {
            type: 'bid',
            bidAmount,
            potentialVoidStoneLane: voidStoneLane
        };
        onSubmit(action);
    };

    return (
        <div className="auction-controls dark-panel">
            <div className="bid-selection-group">
                <label>
                    <strong>Your Bid</strong>
                </label>
                <div className="bid-buttons">
                    {Array.from({ length: maxBid + 1 }, (_, i) => i).map(bid => (
                        <button
                            key={bid}
                            onClick={() => setBidAmount(bid)}
                            className={`bid-btn ${bidAmount === bid ? 'selected' : ''}`}
                            disabled={actionsDisabled}
                        >
                            {bid}
                        </button>
                    ))}
                </div>
                <div className="selected-bid-display">
                    Selected: <strong>{bidAmount} energy</strong>
                </div>
            </div>

            <div className="void-stone-lane-group">
                <label>
                    <strong>Void Stone Target (if you lose)</strong>
                    <div className="lane-buttons">
                        {[0, 1, 2].map(lane => (
                            <button
                                key={lane}
                                onClick={() => setVoidStoneLane(lane)}
                                className={`lane-select-btn ${voidStoneLane === lane ? 'selected' : ''}`}
                                disabled={actionsDisabled}
                            >
                                Lane {String.fromCharCode(65 + lane)}
                            </button>
                        ))}
                    </div>
                </label>
            </div>

            <button onClick={handleSubmit} className="submit-bid-btn" disabled={actionsDisabled}>
                Submit Bid
            </button>

            <p className="auction-hint">
                💡 Higher bid = more likely to win. Winner pays bid. Loser gets shackled lane.
            </p>
        </div>
    );
};
