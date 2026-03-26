import React from 'react';
import { motion } from 'framer-motion';

const SUIT_COLORS = { H: '#ef4444', D: '#ef4444', S: '#1e293b', C: '#1e293b' };
const SUIT_LABELS = { H: '♥', D: '♦', S: '♠', C: '♣' };

export default function Card({ cardId, isSelected, onClick, style, index = 0, faceDown = false, small = false }) {
  if (!cardId) return null;

  const isX = cardId === 'X' || faceDown;
  const [suit, rank] = isX ? ['?', '?'] : cardId.split('_');
  const color = SUIT_COLORS[suit] || '#1e293b';
  const suitLabel = SUIT_LABELS[suit] || '';

  const width = small ? 56 : 100;
  const height = small ? 80 : 148;

  return (
    <motion.div
      layoutId={faceDown ? undefined : `card-${cardId}-${index}`}
      initial={{ opacity: 0, y: 40, rotateY: isX ? 180 : 0 }}
      animate={{
        opacity: 1,
        y: isSelected ? (small ? -8 : -24) : 0,
        rotateY: isX ? 180 : 0,
      }}
      whileHover={!isX && onClick ? { y: isSelected ? -28 : -12, scale: 1.06 } : {}}
      transition={{ type: 'spring', stiffness: 280, damping: 22, delay: index * 0.04 }}
      onClick={onClick}
      style={{
        width,
        height,
        position: 'relative',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        transformStyle: 'preserve-3d',
        perspective: '800px',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isX ? 'rotateY(180deg)' : 'rotateY(0deg)',
          borderRadius: '12px',
          boxShadow: isSelected ? '0 0 20px rgba(124, 58, 237, 0.6)' : '0 4px 15px rgba(0,0,0,0.3)',
          border: isSelected ? '2px solid #a78bfa' : 'none',
        }}
      >
        {/* ── Front Face ── */}
        <div
          className="card-face"
          style={{
            backfaceVisibility: 'hidden',
            backgroundColor: 'white',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: small ? '4px' : '10px',
            borderRadius: '10px',
            height: '100%',
            width: '100%',
          }}
        >
          {/* Top corner */}
          <div style={{ color, lineHeight: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ fontWeight: 900, fontSize: small ? '12px' : '20px', lineHeight: 1 }}>{rank}</div>
            <div style={{ fontSize: small ? '10px' : '14px', lineHeight: 1 }}>{suitLabel}</div>
          </div>

          {/* Centre symbol */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: small ? '28px' : '52px', color, opacity: 0.1 }}>{suitLabel}</span>
          </div>

          {/* Bottom corner (flipped) */}
          <div style={{ color, lineHeight: 1, transform: 'rotate(180deg)', alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ fontWeight: 900, fontSize: small ? '12px' : '20px', lineHeight: 1 }}>{rank}</div>
            <div style={{ fontSize: small ? '10px' : '14px', lineHeight: 1 }}>{suitLabel}</div>
          </div>
        </div>

        {/* ── Back Face ── */}
        <div
          className="card-face"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 50%, #2e1065 100%)',
            border: '2px solid rgba(167, 139, 250, 0.3)',
            borderRadius: '10px',
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{
            position: 'absolute',
            inset: '6px',
            borderRadius: '8px',
            border: '1px solid rgba(167, 139, 250, 0.15)',
            background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ color: 'rgba(167, 139, 250, 0.2)', fontWeight: 900, fontSize: small ? '20px' : '32px', fontFamily: 'serif' }}>♣</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
