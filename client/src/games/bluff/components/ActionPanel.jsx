import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { motion } from 'framer-motion';

const ActionPanel = () => {
  const { gameState, playerId, startGame, playCards, callBluff, selectedCards } = useGameStore();
  const [declaredRank, setDeclaredRank] = useState('A');

  const isMyTurn = gameState?.currentTurn === playerId;
  const isBluffWindow = gameState?.state === 'BLUFF_WINDOW';
  const isWaiting = gameState?.state === 'WAITING';

  // Hardcoded ranks since I can't easily import from server logic folder across WSL directly in a clean way
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

  if (isWaiting) {
    return (
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2">
        <button onClick={startGame} className="btn-primary px-12 py-4 text-xl">
          Start Game
        </button>
      </div>
    );
  }

  return (
    <div className="fixed right-8 top-1/2 -translate-y-1/2 glass-panel p-6 w-64 space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-text-dim uppercase tracking-widest">Actions</h3>
        
        {isMyTurn && gameState.state === 'PLAYER_TURN' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-text-dim mb-1 block">Declare Rank</label>
              <select 
                value={declaredRank}
                onChange={(e) => setDeclaredRank(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none"
              >
                {ranks.map(r => <option key={r} value={r} className="bg-[#0a0a0c]">{r}</option>)}
              </select>
            </div>
            
            <button 
              onClick={() => playCards(declaredRank)}
              disabled={selectedCards.length === 0}
              className={`w-full p-3 rounded-xl font-bold transition-all ${
                selectedCards.length > 0 
                  ? 'bg-primary-glow text-white shadow-lg' 
                  : 'bg-white/5 text-text-dim cursor-not-allowed'
              }`}
            >
              Play {selectedCards.length} Cards
            </button>
          </div>
        )}

        {isBluffWindow && !isMyTurn && (
          <button 
            onClick={callBluff}
            className="w-full bg-accent-red p-4 rounded-xl font-bold text-white shadow-lg hover:shadow-accent-red/20"
          >
            CALL BLUFF!
          </button>
        )}

        {!isMyTurn && !isBluffWindow && (
          <div className="p-4 text-center border border-dashed border-white/10 rounded-xl">
            <p className="text-text-dim italic text-sm">Waiting for other players...</p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-white/10">
        <p className="text-[10px] text-text-dim uppercase font-bold text-center">
          Turn: <span className="text-primary-glow">{gameState?.players.find(p => p.id === gameState.currentTurn)?.name || '...'}</span>
        </p>
      </div>
    </div>
  );
};

export default ActionPanel;
