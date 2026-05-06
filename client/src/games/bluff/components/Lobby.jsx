import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';

const Lobby = () => {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const { connect, error } = useGameStore();

  const handleJoin = (e) => {
    e.preventDefault();
    if (name && room) {
      connect(name, room);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-screen w-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a0a0c] to-[#1a1a2e]"
    >
      <div className="glass-panel p-8 w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold glow-text tracking-tighter">THE BLUFF</h1>
          <p className="text-text-dim">Standard 52-card Multiplayer Experience</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-text-dim ml-1 mb-1 block">Your Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary-glow/50 transition-all"
                placeholder="Ex: Shivam"
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-text-dim ml-1 mb-1 block">Room ID</label>
              <input 
                type="text" 
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary-glow/50 transition-all"
                placeholder="Ex: room-101"
                required
              />
            </div>
          </div>

          {error && <p className="text-accent-red text-sm text-center">{error}</p>}

          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
            <Play size={20} />
            Join Room
          </button>
        </form>
      </div>
    </motion.div>
  );
};

export default Lobby;
