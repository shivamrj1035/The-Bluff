import React from 'react';
import { motion } from 'framer-motion';

const SUIT_COLOR = { H: '#ef4444', D: '#ef4444', S: '#1e293b', C: '#1e293b' };
const SUIT_SYMBOL = { H: '♥', D: '♦', C: '♣', S: '♠' };
const RANK_DISPLAY = {
  '2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
  '10':'10','J':'J','Q':'Q','K':'K','A':'A',
};

/**
 * CPCard — renders a single playing card.
 * Props:
 *  cardId      string   e.g. 'H_A', 'S_10'
 *  trumpSuit   string   highlights if this card is trump
 *  disabled    bool     grayed out (can't follow suit)
 *  selected    bool     glowing selection ring
 *  onClick     fn
 *  size        'sm'|'md'|'lg'  default 'md'
 *  faceDown    bool     render card back
 */
export default function CPCard({
  cardId,
  trumpSuit,
  disabled = false,
  selected = false,
  onClick,
  size = 'md',
  faceDown = false,
  style = {},
}) {
  const dims = size === 'sm'
    ? { w: 56, h: 80, rank: '0.8rem', suit: '1.2rem', center: '32px' }
    : size === 'lg'
    ? { w: 90, h: 130, rank: '1.2rem', suit: '1.9rem', center: '56px' }
    : { w: 72, h: 104, rank: '1rem', suit: '1.4rem', center: '44px' };

  const isBack = !cardId || cardId === 'X' || faceDown;
  const [suit, rank] = !isBack ? cardId.split('_') : ['?', '?'];
  const color = SUIT_COLOR[suit] || '#1e293b';
  const symbol = SUIT_SYMBOL[suit] || '';
  const isTrump = suit === trumpSuit;
  const displayRank = RANK_DISPLAY[rank] || rank;

  return (
    <motion.div
      whileHover={!disabled && onClick && !isBack ? { y: -8, scale: 1.05 } : {}}
      whileTap={!disabled && onClick && !isBack ? { scale: 0.98 } : {}}
      animate={{ 
        y: selected ? -15 : 0,
        rotateY: isBack ? 180 : 0
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={!disabled ? onClick : undefined}
      style={{
        width: dims.w,
        height: dims.h,
        position: 'relative',
        cursor: (onClick && !disabled) ? 'pointer' : 'default',
        transformStyle: 'preserve-3d',
        perspective: '1000px',
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
        borderRadius: 12,
        boxShadow: selected 
          ? `0 0 25px #f59e0b99, 0 10px 30px rgba(0,0,0,0.5)`
          : isTrump 
          ? `0 0 15px ${color}44, 0 4px 12px rgba(0,0,0,0.3)`
          : '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        {/* ── FRONT FACE ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backfaceVisibility: 'hidden',
          background: 'linear-gradient(160deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '6px 8px',
          border: selected ? `2px solid #f59e0b` : isTrump ? `1.5px solid ${color}66` : '1px solid rgba(0,0,0,0.05)',
        }}>
          {/* Top Corner */}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontSize: dims.rank, fontWeight: 900, color, fontFamily: 'serif' }}>{displayRank}</span>
            <span style={{ fontSize: `calc(${dims.rank} * 0.9)`, color }}>{symbol}</span>
          </div>

          {/* Center Symbol */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: dims.center, color, opacity: 0.1 }}>{symbol}</span>
          </div>

          {/* Bottom Corner */}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, transform: 'rotate(180deg)', alignSelf: 'flex-end' }}>
            <span style={{ fontSize: dims.rank, fontWeight: 900, color, fontFamily: 'serif' }}>{displayRank}</span>
            <span style={{ fontSize: `calc(${dims.rank} * 0.9)`, color }}>{symbol}</span>
          </div>

          {/* Trump Glow */}
          {isTrump && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 9, background: `radial-gradient(circle at 50% 50%, ${color}11, transparent 70%)`, pointerEvents: 'none' }} />
          )}
        </div>

        {/* ── BACK FACE ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
          borderRadius: 10,
          border: '2px solid rgba(251, 146, 60, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', inset: 4, borderRadius: 8,
            border: '1px solid rgba(251, 146, 60, 0.1)',
            background: 'repeating-linear-gradient(45deg, rgba(251,146,60,0.03) 0px, rgba(251,146,60,0.03) 1px, transparent 1px, transparent 10px)',
          }} />
          <span style={{ color: 'rgba(251, 146, 60, 0.15)', fontSize: dims.center, fontWeight: 900 }}>CP</span>
        </div>
      </div>
    </motion.div>
  );
}

