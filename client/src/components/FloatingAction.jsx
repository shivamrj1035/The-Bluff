import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * FloatingAction — shows a small pill notification floating from a player's seat
 * to the center of the table. Used only when there's no card animation (PASS).
 * For PLAY, this is shown alongside MoveAnimation.
 */
export default function FloatingAction({ fromPos, toPos, text, type, onComplete }) {
  if (!fromPos || !toPos || !text) return null;

  const isPass = type === 'PASS';

  // For PASS: animate from seat to center then fade out (no blocking overlay)
  // For PLAY: brief label that complements card movement
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 800 }}>
      <AnimatePresence>
        <motion.div
          key={text + '_fa'}
          initial={{
            top: fromPos.top || 'auto',
            left: fromPos.left || '50%',
            right: fromPos.right || 'auto',
            bottom: fromPos.bottom || 'auto',
            transform: fromPos.transform || 'translate(-50%, -50%)',
            opacity: 0,
            scale: 0.7,
          }}
          animate={{
            top: toPos.top || '50%',
            left: toPos.left || '50%',
            right: 'auto',
            bottom: 'auto',
            transform: toPos.transform || 'translate(-50%, -50%)',
            opacity: 1,
            scale: 1,
          }}
          exit={{ opacity: 0, scale: 0.8, y: -10 }}
          transition={{
            duration: isPass ? 1.8 : 1.2,
            ease: 'easeOut',
          }}
          onAnimationComplete={onComplete}
          style={{
            position: 'absolute',
            padding: isPass ? '8px 18px' : '6px 14px',
            borderRadius: '999px',
            background: isPass
              ? 'rgba(30, 30, 50, 0.92)'
              : 'rgba(124, 58, 237, 0.85)',
            border: isPass
              ? '1.5px solid rgba(167,139,250,0.35)'
              : '1.5px solid rgba(255,255,255,0.2)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{
            color: isPass ? '#9ca3af' : '#fff',
            fontWeight: 700,
            fontSize: isPass ? '0.75rem' : '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {text}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
