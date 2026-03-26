import React from 'react';
import { motion } from 'framer-motion';

const PlayingCard = ({ cardId, isSelected, onClick, isFaceDown = false, delay = 0 }) => {
  // cardId format: "H_A", "S_K", "D_10", "C_2", etc.
  if (!cardId && !isFaceDown) return null;

  const [suit, rank] = isFaceDown ? ['?', '?'] : cardId.split('_');
  
  const getSuitSymbol = (s) => {
    switch (s) {
      case 'H': return '♥';
      case 'D': return '♦';
      case 'S': return '♠';
      case 'C': return '♣';
      default: return '';
    }
  };

  const getSuitColor = (s) => {
    return (s === 'H' || s === 'D') ? '#ef4444' : '#1e293b';
  };

  const symbol = getSuitSymbol(suit);
  const color = getSuitColor(suit);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, rotateY: 180 }}
      animate={{ opacity: 1, y: isSelected ? -20 : 0, rotateY: isFaceDown ? 180 : 0 }}
      whileHover={!isFaceDown ? { y: isSelected ? -25 : -10, scale: 1.05 } : {}}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay }}
      onClick={onClick}
      className={`relative w-24 h-36 sm:w-32 sm:h-48 rounded-xl cursor-pointer shadow-2xl transition-shadow ${isSelected ? 'shadow-indigo-500/50 ring-2 ring-indigo-400' : 'shadow-black/20'}`}
      style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
    >
      <div className="absolute inset-0 w-full h-full" style={{ transformStyle: 'preserve-3d', transition: 'transform 0.5s', transform: isFaceDown ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
        
        {/* Front Face */}
        <div 
          className="absolute inset-0 w-full h-full bg-white backdrop-blur-md rounded-xl border border-gray-200 flex flex-col justify-between p-3"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(0deg)' }}
        >
          <div className="flex flex-col items-center self-start" style={{ color }}>
            <span className="text-xl sm:text-2xl font-bold leading-none">{rank}</span>
            <span className="text-xl sm:text-2xl leading-none">{symbol}</span>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
             <svg width="60%" height="60%" viewBox="0 0 100 100" className="drop-shadow-sm">
               <text x="50%" y="55%" fontSize="70" textAnchor="middle" dominantBaseline="middle" fill={color}>{symbol}</text>
             </svg>
          </div>

          <div className="flex flex-col items-center self-end rotate-180" style={{ color }}>
            <span className="text-xl sm:text-2xl font-bold leading-none">{rank}</span>
            <span className="text-xl sm:text-2xl leading-none">{symbol}</span>
          </div>
        </div>

        {/* Back Face */}
        <div 
          className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-800 to-slate-900 rounded-xl border-2 border-indigo-400/40 flex items-center justify-center shadow-inner"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="w-[85%] h-[85%] border-2 border-indigo-400/30 rounded-lg flex items-center justify-center bg-indigo-500/10">
             <svg width="60" height="60" viewBox="0 0 100 100">
               <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
               <path d="M 50 20 L 50 80 M 20 50 L 80 50" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
               <circle cx="50" cy="50" r="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
             </svg>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

export default PlayingCard;
