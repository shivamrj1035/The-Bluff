import React from 'react';
import { motion } from 'framer-motion';

const SUIT_COLOR = { H: '#ef4444', D: '#ef4444', C: '#000000', S: '#000000' };
const SUIT_SYMBOL = { H: '♥', D: '♦', C: '♣', S: '♠' };
const RANK_DISPLAY = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '10': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
};

/**
 * MCCard — renders a single playing card for MendiCoat.
 * Props:
 *  cardId      string   e.g. 'H_A', 'S_10'
 *  trumpSuit   string   highlights if this card is trump
 *  disabled    bool     grayed out (can't follow suit)
 *  selected    bool     glowing selection ring
 *  onClick     fn
 *  size        'sm'|'md'|'lg'  default 'md'
 *  faceDown    bool     render card back
 */
export default function MCCard({
  cardId,
  trumpSuit,
  disabled = false,
  selected = false,
  onClick,
  size = 'md',
  faceDown = false,
  style = {},
}) {
  const dims = size === 'xs'
    ? { w: 42, h: 70, rank: '0.62rem', suit: '0.9rem', center: '1.2rem' }
    : size === 'sm'
      ? { w: 52, h: 76, rank: '0.75rem', suit: '1.1rem', center: '1.5rem' }
      : size === 'lg'
        ? { w: 90, h: 130, rank: '1.2rem', suit: '1.9rem', center: '2.5rem' }
        : { w: 68, h: 98, rank: '0.9rem', suit: '1.4rem', center: '2rem' };

  const isBack = faceDown || !cardId || cardId === 'X';
  const [suit, rank] = isBack ? ['S', 'A'] : cardId.split('_');
  const color = SUIT_COLOR[suit] || '#fff';
  const symbol = SUIT_SYMBOL[suit] || suit;
  const isTrump = suit === trumpSuit;
  const displayRank = RANK_DISPLAY[rank] || rank;

  return (
    <motion.div
      whileHover={
        !disabled && onClick && !isBack
          ? { y: -8, scale: 1.05 }
          : {}
      }
      whileTap={
        !disabled && onClick && !isBack
          ? { scale: 0.98 }
          : {}
      }
      animate={{
        y: selected ? -15 : 0,
        rotateY: isBack ? 180 : 0,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
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
        cursor: disabled
          ? 'not-allowed'
          : onClick
            ? 'pointer'
            : 'default',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '5px 6px',
        opacity: disabled ? 0.38 : 1,
        transition: 'opacity 0.2s, box-shadow 0.2s',
        userSelect: 'none',
        transformStyle: 'preserve-3d',
        ...style,
      }}
    >
      <div
        style={{
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
        }}
      >
        {/* ── FRONT FACE ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            background:
              'linear-gradient(160deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '7px',
            overflow: 'hidden',
            border: selected
              ? `2px solid #f59e0b`
              : isTrump
                ? `1.5px solid ${color}66`
                : '1px solid rgba(0,0,0,0.05)',
          }}
        >
          {/* Top Corner */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              lineHeight: 0.9,
            }}
          >
            <span
              style={{
                fontSize: dims.rank,
                fontWeight: 900,
                color,
                fontFamily: 'serif',
              }}
            >
              {displayRank}
            </span>

            <span
              style={{
                fontSize: `calc(${dims.rank} * 0.82)`,
                color,
                marginTop: -1,
              }}
            >
              {symbol}
            </span>
          </div>

          {/* Center Suit */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontSize: `calc(${dims.suit} * 1.55)`,
                color: disabled ? '#444' : color,
                filter: `drop-shadow(0 2px 6px ${color}66)`,
                lineHeight: 1,
              }}
            >
              {symbol}
            </span>
          </div>

          {/* Bottom Corner */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              alignSelf: 'flex-end',
              justifyContent: 'center',
              lineHeight: 0.78,
              transform: 'rotate(180deg)',
              marginRight: 1,
              marginBottom: 1,
              padding: '1px 0',
            }}
          >
            <span
              style={{
                fontSize: `calc(${dims.rank} * 0.92)`,
                fontWeight: 900,
                color,
                fontFamily: 'serif',
                display: 'block',
              }}
            >
              {displayRank}
            </span>

            <span
              style={{
                fontSize: `calc(${dims.rank} * 0.62)`,
                color,
                display: 'block',
                marginTop: -2,
              }}
            >
              {symbol}
            </span>
          </div>

          {/* Trump Glow */}
          {isTrump && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 9,
                background: `radial-gradient(circle at 50% 50%, ${color}11, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        {/* ── BACK FACE ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background:
              'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
            borderRadius: 10,
            border: '2px solid rgba(251, 146, 60, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 4,
              borderRadius: 8,
              border: '1px solid rgba(251, 146, 60, 0.1)',
              background:
                'repeating-linear-gradient(45deg, rgba(251,146,60,0.03) 0px, rgba(251,146,60,0.03) 1px, transparent 1px, transparent 10px)',
            }}
          />

          <span
            style={{
              color: 'rgba(251, 146, 60, 0.15)',
              fontSize: dims.center,
              fontWeight: 900,
            }}
          >
            MC
          </span>
        </div>
      </div>
    </motion.div>
  );
}
