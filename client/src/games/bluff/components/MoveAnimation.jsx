import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MoveAnimation({ fromPos, toPos, count, onComplete }) {
  if (!fromPos || !toPos || !count) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
      {[...Array(1)].map((_, i) => (
        <motion.div
          key={i}
          initial={{
            top: fromPos.top || 'auto',
            left: fromPos.left || '50%',
            right: fromPos.right || 'auto',
            bottom: fromPos.bottom || 'auto',
            transform: fromPos.transform || 'translate(-50%, -50%)',
            opacity: 1,
            scale: 0.8
          }}
          animate={{
            top: toPos.top || '50%',
            left: toPos.left || '50%',
            right: toPos.right || 'auto',
            bottom: toPos.bottom || 'auto',
            transform: toPos.transform || 'translate(-50%, -50%)',
            opacity: 0.7,
            scale: 0.6
          }}
          transition={{
            duration: 1.5,
            delay: i * 0.1,
            ease: "easeInOut"
          }}
          onAnimationComplete={() => i === 0 && onComplete && onComplete()}
          style={{
            position: 'absolute',
            width: '60px',
            height: '85px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #0e3a46, #06202a)',
            border: '1px solid rgba(103,232,249,0.5)',
            boxShadow: '0 10px 20px rgba(0,0,0,0.5)'
          }}
        />
      ))}
    </div>
  );
}
