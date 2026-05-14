import React from 'react';
import { motion } from 'framer-motion';

const SUITS = [
  { id: 'S', symbol: '♠', label: 'Spades',   gradient: 'linear-gradient(135deg,#1e293b,#334155)', glow: '#94a3b8' },
  { id: 'H', symbol: '♥', label: 'Hearts',   gradient: 'linear-gradient(135deg,#7f1d1d,#dc2626)', glow: '#f87171' },
  { id: 'D', symbol: '♦', label: 'Diamonds', gradient: 'linear-gradient(135deg,#7c2d12,#f97316)', glow: '#fb923c' },
  { id: 'C', symbol: '♣', label: 'Clubs',    gradient: 'linear-gradient(135deg,#134e4a,#0f766e)', glow: '#34d399' },
];

/**
 * TrumpSelector — shown to the trump winner to pick the rang (trump suit).
 * Props:
 *  onSelect   fn(suitId)
 *  disabled   bool
 *  selectorName  string — the player's name shown in the prompt
 */
export default function TrumpSelector({ onSelect, disabled = false, selectorName = 'The winner' }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '28px 24px',
        background: 'linear-gradient(160deg, rgba(15,10,40,0.97), rgba(8,5,25,0.98))',
        borderRadius: 24,
        border: '1px solid rgba(167,139,250,0.25)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        maxWidth: 380,
        width: '100%',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.16em', color: '#f59e0b' }}>
          SELECT TRUMP (RANG)
        </p>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
          {disabled ? `Waiting for ${selectorName}...` : 'Choose the trump suit'}
        </h2>
        {!disabled && (
          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
            Your higher card earned you the right to pick rang
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
        {SUITS.map(suit => (
          <motion.button
            key={suit.id}
            whileHover={!disabled ? { scale: 1.05, y: -4 } : {}}
            whileTap={!disabled ? { scale: 0.97 } : {}}
            onClick={() => !disabled && onSelect?.(suit.id)}
            style={{
              padding: '18px 12px',
              background: suit.gradient,
              border: `1.5px solid ${suit.glow}44`,
              borderRadius: 16,
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              opacity: disabled ? 0.5 : 1,
              boxShadow: disabled ? 'none' : `0 0 20px ${suit.glow}22`,
              transition: 'opacity 0.2s',
            }}
          >
            <span style={{ fontSize: '2.2rem', filter: `drop-shadow(0 0 8px ${suit.glow}88)` }}>
              {suit.symbol}
            </span>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              {suit.label}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
