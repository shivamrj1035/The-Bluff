import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FloatingAction({ fromPos, toPos, text, type, onComplete }) {
  if (!fromPos || !toPos || !text) return null;

  const isPass = type === 'PASS';

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000 }}>
      <AnimatePresence>
        <motion.div
          key={text + Date.now()}
          initial={{
            top: fromPos.top || 'auto',
            left: fromPos.left || '50%',
            right: fromPos.right || 'auto',
            bottom: fromPos.bottom || 'auto',
            transform: fromPos.transform || 'translate(-50%, -50%)',
            opacity: 0.7,
            scale: 0.5
          }}
          animate={{
            top: toPos.top || '50%',
            left: toPos.left || '50%',
            right: toPos.right || 'auto',
            bottom: toPos.bottom || 'auto',
            transform: toPos.transform || 'translate(-50%, -50%)',
            opacity: 1,
            scale: 1.2
          }}
          exit={{ opacity: 0, scale: 1.5, y: -20 }}
          transition={{
            duration: 2.5,
            ease: "easeInOut"
          }}
          onAnimationComplete={onComplete}
          style={{
            position: 'absolute',
            padding: '16px 28px',
            borderRadius: '12px',
            background: isPass ? 'rgba(0,0,0,0.9)' : 'linear-gradient(135deg, #7c3aed, #4c1d95)',
            border: '2px solid rgba(255,255,255,0.2)',
            boxShadow: '0 15px 40px rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '220px',
            backdropFilter: 'blur(10px)'
          }}
        >

          <span style={{
            color: '#fff',
            fontWeight: 900,
            fontSize: '1.1rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            textAlign: 'center'
          }}>
            {text}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
