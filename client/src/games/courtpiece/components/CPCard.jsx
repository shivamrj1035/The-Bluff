import React from 'react';
import { motion } from 'framer-motion';

const SUIT_COLOR = { H: '#ef4444', D: '#ef4444', C: '#000000', S: '#000000' };
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
    ? { w: 52, h: 76, rank: '0.75rem', suit: '1.1rem' }
    : size === 'lg'
    ? { w: 90, h: 130, rank: '1.2rem', suit: '1.9rem' }
    : { w: 68, h: 98, rank: '0.9rem', suit: '1.4rem' };

  if (!cardId || cardId === 'X' || faceDown) {
    return (
      <motion.div
        whileHover={onClick ? { y: -4 } : {}}
        onClick={onClick}
        style={{
          width: dims.w, height: dims.h,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          border: '1.5px solid rgba(167,139,250,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: onClick ? 'pointer' : 'default',
          ...style,
        }}
      >
        <span style={{ fontSize: dims.suit, opacity: 0.3 }}>🂠</span>
      </motion.div>
    );
  }

  const [suit, rank] = cardId.split('_');
  const color = SUIT_COLOR[suit] || '#fff';
  const symbol = SUIT_SYMBOL[suit] || suit;
  const isTrump = suit === trumpSuit;
  const displayRank = RANK_DISPLAY[rank] || rank;

  return (
    <motion.div
      whileHover={!disabled && onClick ? { y: -8, scale: 1.04 } : {}}
      whileTap={!disabled && onClick ? { scale: 0.97 } : {}}
      animate={selected ? { y: -12 } : { y: 0 }}
      onClick={!disabled ? onClick : undefined}
      style={{
        width: dims.w,
        height: dims.h,
        borderRadius: 10,
        background: disabled
          ? 'linear-gradient(160deg, #1c1c2e, #111118)'
          : 'linear-gradient(160deg, #ffffff 0%, #f1f5f9 100%)',
        border: selected
          ? `2px solid ${color}`
          : isTrump
          ? `1.5px solid ${color}55`
          : '1.5px solid rgba(255,255,255,0.12)',
        boxShadow: selected
          ? `0 0 18px ${color}88, 0 8px 24px rgba(0,0,0,0.4)`
          : isTrump
          ? `0 0 10px ${color}33, 0 4px 16px rgba(0,0,0,0.3)`
          : '0 4px 16px rgba(0,0,0,0.3)',
        cursor: disabled ? 'not-allowed' : onClick ? 'pointer' : 'default',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '5px 6px',
        opacity: disabled ? 0.38 : 1,
        transition: 'opacity 0.2s, box-shadow 0.2s',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Top-left rank + suit */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontSize: dims.rank, fontWeight: 800, color: disabled ? '#555' : color, fontFamily: 'monospace' }}>
          {displayRank}
        </span>
        <span style={{ fontSize: `calc(${dims.rank} * 0.85)`, color: disabled ? '#555' : color }}>
          {symbol}
        </span>
      </div>

      {/* Center suit symbol */}
      <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
        <span style={{ fontSize: `calc(${dims.suit} * 1.6)`, color: disabled ? '#444' : color, filter: `drop-shadow(0 2px 6px ${color}66)` }}>
          {symbol}
        </span>
      </div>

      {/* Bottom-right rank + suit (rotated) */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, transform: 'rotate(180deg)', alignSelf: 'flex-end' }}>
        <span style={{ fontSize: dims.rank, fontWeight: 800, color: disabled ? '#555' : color, fontFamily: 'monospace' }}>
          {displayRank}
        </span>
        <span style={{ fontSize: `calc(${dims.rank} * 0.85)`, color: disabled ? '#555' : color }}>
          {symbol}
        </span>
      </div>

      {/* Trump glow indicator */}
      {isTrump && !disabled && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 9,
          background: `radial-gradient(circle at 50% 50%, ${color}22, transparent 70%)`,
          pointerEvents: 'none',
        }} />
      )}
    </motion.div>
  );
}
