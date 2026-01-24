import React from 'react';
import type { Card } from '../../../engine/src/types';
import './GameQueue.css';

interface GameQueueProps {
    queue: ReadonlyArray<Card>;
    deckSize: number;
}

export const GameQueue: React.FC<GameQueueProps> = ({ queue, deckSize }) => {
    return (
        <div className="queue-section">
            <h3>Card Queue</h3>
            <div className="queue">
                {queue.map((card, idx) => (
                    <div key={idx} className={`queue-card ${idx === 0 ? 'front' : ''}`}>
                        {card.rank}{card.suit}
                    </div>
                ))}
                {queue.length === 0 && <div className="queue-empty">Empty</div>}
            </div>
            <div className="deck-info">Deck: {deckSize} cards</div>
        </div>
    );
};
