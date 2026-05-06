import React from 'react';
import { useGameStore } from '../store/useGameStore';
import PlayerHand from './PlayerHand';
import Pile from './Pile';
import ActionPanel from './ActionPanel';
import { motion } from 'framer-motion';

const GameBoard = () => {
  const { gameState, playerId } = useGameStore();

  if (!gameState) return null;

  const otherPlayers = gameState.players.filter(p => p.id !== playerId);

  return (
    <div className="relative h-screen w-screen overflow-hidden p-8 flex flex-col items-center">
      {/* Top Banner */}
      <div className="w-full flex justify-between items-center z-20">
        <h2 className="text-2xl font-black text-white/50 tracking-tighter">THE BLUFF</h2>
        <div className="flex gap-4">
          <div className="glass-panel px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            <span className="text-xs font-bold text-text-dim">ROOM: {gameState.roomId}</span>
          </div>
        </div>
      </div>

      {/* Other Players (Top Area) */}
      <div className="mt-12 flex justify-center gap-12 w-full max-w-6xl">
        {otherPlayers.map(player => (
          <motion.div 
            key={player.id}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`
              glass-panel p-4 flex flex-col items-center gap-2 w-32 relative
              ${gameState.currentTurn === player.id ? 'ring-2 ring-primary-glow border-primary-glow bg-primary-glow/10' : ''}
            `}
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xl font-bold">
              {player.name[0]}
            </div>
            <p className="text-sm font-bold truncate w-full text-center">{player.name}</p>
            <p className="text-[10px] text-text-dim uppercase font-black">{player.cardCount} Cards</p>
            
            {gameState.currentTurn === player.id && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary-glow rounded text-[8px] font-bold uppercase">
                Thinking...
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Central Area: Pile */}
      <Pile />

      {/* My Area (Hand + Actions) */}
      <PlayerHand />
      <ActionPanel />

      {/* Win Modal */}
      {gameState.winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel p-12 text-center space-y-6"
          >
            <h2 className="text-6xl font-black glow-text">GAME OVER!</h2>
            <p className="text-2xl font-bold">
              {gameState.players.find(p => p.id === gameState.winner)?.name} WINS!
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Play Again
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;
