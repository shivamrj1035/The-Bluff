import React from 'react';
import { useGameStore } from '../store/useGameStore';
import Card from './Card';
import { motion } from 'framer-motion';

const PlayerHand = () => {
  const { gameState, playerId, selectedCards, toggleCardSelection } = useGameStore();
  const hand = gameState?.hands[playerId] || [];

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-end justify-center h-48 w-full max-w-4xl px-8">
      <div className="relative w-full flex justify-center">
        {hand.map((cardId, index) => {
          const rotation = (index - (hand.length - 1) / 2) * 4;
          const xOffset = (index - (hand.length - 1) / 2) * 30;
          
          return (
            <Card
              key={`${cardId}-${index}`}
              cardId={cardId}
              index={index}
              isSelected={selectedCards.includes(cardId)}
              onClick={() => toggleCardSelection(cardId)}
              style={{
                transform: `translateX(${xOffset}px) rotate(${rotation}deg)`,
                position: 'absolute',
                zIndex: index
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default PlayerHand;
