import React from 'react';
import { motion } from 'framer-motion';

const SUIT_COLOR = { H: '#dc2626', D: '#dc2626', C: '#1e293b', S: '#0f172a' }; // Classic red and deep black / slate-900
const SUIT_SYMBOL = { H: '♥', D: '♦', C: '♣', S: '♠' };
const RANK_DISPLAY = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '10': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
};

export default function JKCard({
  cardId,
  disabled = false,
  selected = false,
  onClick,
  size = 'md',
  faceDown = false,
  style = {},
}) {
  const dims = size === 'xs'
    ? { w: 42, h: 62, rank: '0.65rem', suit: '0.9rem', center: '1.2rem' }
    : size === 'sm'
      ? { w: 52, h: 76, rank: '0.75rem', suit: '1.1rem', center: '1.5rem' }
      : size === 'lg'
        ? { w: 90, h: 130, rank: '1.2rem', suit: '1.9rem', center: '2.5rem' }
        : { w: 68, h: 98, rank: '0.9rem', suit: '1.4rem', center: '2rem' };

  const isBack = faceDown || !cardId || cardId === 'X';
  const isJoker = cardId === 'JK_JOKER';

  let suit = 'S';
  let rank = 'A';
  if (!isBack && !isJoker) {
    [suit, rank] = cardId.split('_');
  }

  const color = isJoker ? '#1e3a8a' : (SUIT_COLOR[suit] || '#fff'); // Deep blue for Joker corner details
  const symbol = isJoker ? '🃏' : (SUIT_SYMBOL[suit] || suit);
  const displayRank = isJoker ? 'JK' : (RANK_DISPLAY[rank] || rank);

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
        borderRadius: 10,
        background: disabled
          ? 'linear-gradient(160deg, #1c1c2e, #111118)'
          : isJoker
            ? 'url(/joker.jpg) no-repeat center center / cover' // Fancy Joker image background
            : 'linear-gradient(160deg, #ffffff 0%, #f1f5f9 100%)',
        border: selected
          ? `2px solid ${color}`
          : isJoker
            ? '2px solid #1e3a8a'
            : '1.5px solid rgba(255,255,255,0.12)',
        boxShadow: selected
          ? `0 0 18px ${color}88, 0 8px 24px rgba(0,0,0,0.4)`
          : isJoker
            ? '0 0 15px rgba(30,58,138,0.5), 0 4px 16px rgba(0,0,0,0.3)'
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
      <div style={{
        position: 'absolute',
        inset: 0,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
        borderRadius: 12,
        boxShadow: selected
          ? `0 0 25px #f59e0b99, 0 10px 30px rgba(0,0,0,0.5)`
          : '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        {/* FRONT FACE */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backfaceVisibility: 'hidden',
          background: isJoker
            ? 'url(/joker.jpg) no-repeat center center / cover'
            : (suit === 'H' || suit === 'D')
              ? 'linear-gradient(160deg, #ffffff 0%, #fff5f5 100%)'
              : 'linear-gradient(160deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: 10,
          border: selected
            ? `2px solid ${isJoker ? '#1e3a8a' : '#f59e0b'}`
            : isJoker
              ? '1px solid rgba(0,0,0,0.1)'
              : '1px solid rgba(0,0,0,0.05)',
          boxShadow: isJoker
            ? 'none'
            : (suit === 'H' || suit === 'D')
              ? 'inset 0 0 8px rgba(220, 38, 38, 0.05)'
              : 'inset 0 0 8px rgba(15, 23, 42, 0.04)',
        }}>
          {/* Top Corner */}
          <div style={{
            position: 'absolute',
            top: size === 'xs' ? 3 : size === 'sm' ? 4 : size === 'lg' ? 10 : 6,
            left: size === 'xs' ? 4 : size === 'sm' ? 6 : size === 'lg' ? 12 : 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1
          }}>
            <span style={{ fontSize: dims.rank, fontWeight: 900, color: isJoker ? '#1e3a8a' : color, fontFamily: 'serif' }}>{displayRank}</span>
            <span style={{ fontSize: `calc(${dims.rank} * 0.9)`, color: isJoker ? '#1e3a8a' : color }}>{symbol}</span>
          </div>

          {/* Center symbol */}
          {!isJoker && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              pointerEvents: 'none'
            }}>
              <span style={{
                fontSize: `calc(${dims.suit} * 1.5)`,
                color: disabled ? '#444' : color,
                filter: `drop-shadow(0 2px 6px ${color}66)`,
              }}>
                {symbol}
              </span>
            </div>
          )}

          {/* Bottom Corner */}
          <div style={{
            position: 'absolute',
            bottom: size === 'xs' ? 3 : size === 'sm' ? 4 : size === 'lg' ? 10 : 6,
            right: size === 'xs' ? 4 : size === 'sm' ? 6 : size === 'lg' ? 12 : 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1,
            transform: 'rotate(180deg)'
          }}>
            <span style={{ fontSize: dims.rank, fontWeight: 900, color: isJoker ? '#1e3a8a' : color, fontFamily: 'serif' }}>{displayRank}</span>
            <span style={{ fontSize: `calc(${dims.rank} * 0.9)`, color: isJoker ? '#1e3a8a' : color }}>{symbol}</span>
          </div>
        </div>

        {/* BACK FACE */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          backgroundImage: 'url(/card_back.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          borderRadius: 10,
          border: '1.5px solid rgba(255, 255, 255, 0.15)',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            inset: size === 'xs' ? 2 : size === 'sm' ? 3 : size === 'lg' ? 6 : 4,
            borderRadius: size === 'xs' ? 5 : size === 'sm' ? 6 : size === 'lg' ? 9 : 7,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            pointerEvents: 'none',
          }} />
        </div>
      </div>
    </motion.div>
  );
}
