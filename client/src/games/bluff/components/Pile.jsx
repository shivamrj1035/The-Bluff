import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';

const Pile = () => {
  const { gameState } = useGameStore();
  const pile = gameState?.pile || [];
  const totalCards = pile.reduce((sum, move) => sum + move.count, 0);

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
      <div className="relative w-40 h-56">
        <AnimatePresence>
          {totalCards > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full h-full bg-slate-800/50 rounded-2xl border-2 border-white/10 shadow-2xl flex items-center justify-center relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-teal-500/10" />
              <span className="text-6xl font-black text-white/20 select-none">
                {totalCards}
              </span>
              
              {/* Stack effect */}
              {[...Array(Math.min(5, totalCards))].map((_, i) => (
                <div 
                  key={i}
                  className="absolute inset-0 border border-white/5 rounded-2xl"
                  style={{ transform: `translate(${i * 2}px, ${-i * 2}px)`, zIndex: -i }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {totalCards === 0 && (
          <div className="w-full h-full border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center">
            <span className="text-text-dim/30 text-sm font-medium uppercase tracking-widest">Empty Pile</span>
          </div>
        )}
      </div>

      {gameState?.lastMove && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center"
        >
          <p className="text-text-dim text-xs uppercase tracking-widest font-bold">Last Move</p>
          <p className="text-2xl font-black text-primary-glow">
            {gameState.lastMove.count} {gameState.lastMove.declaredRank}'s
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default Pile;
