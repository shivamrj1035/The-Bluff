import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DealAnimation({ players, onComplete }) {
  const [phase, setPhase] = useState('shuffle'); // shuffle | deal | done
  const [deckCards] = useState(
    [...Array(20)].map((_, i) => ({ id: i, x: (Math.random() - 0.5) * 40, y: (Math.random() - 0.5) * 20, r: (Math.random() - 0.5) * 60 }))
  );

  useEffect(() => {
    // Phase 1: shuffle (1.2s)
    const t1 = setTimeout(() => setPhase('deal'), 1200);
    // Phase 2: deal out (2s)
    const t2 = setTimeout(() => {
      setPhase('done');
      onComplete?.();
    }, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="deal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(7,7,17,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
            {/* Deck pile */}
            <div style={{ position: 'relative', width: '100px', height: '148px', perspective: '1000px' }}>
              {deckCards.map((card, i) => (
                <motion.div
                  key={card.id}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '12px',
                    border: '1.5px solid rgba(103, 232, 249, 0.4)',
                    background: 'linear-gradient(135deg, #0e3a46, #06202a)',
                    zIndex: i,
                    transformStyle: 'preserve-3d',
                  }}
                  animate={
                    phase === 'shuffle'
                      ? {
                          x: [0, card.x, -card.x, 0],
                          y: [0, card.y, 0],
                          rotate: [0, card.r, 0],
                          translateZ: i * 0.5,
                        }
                      : phase === 'deal'
                      ? {
                          x: ((i % (players.length || 1)) - (players.length || 1) / 2) * 200,
                          y: 300,
                          rotate: 720,
                          opacity: 0,
                          scale: 0.5,
                        }
                      : {}
                  }
                  transition={
                    phase === 'shuffle'
                      ? { duration: 0.8, delay: i * 0.03, repeat: 1, ease: 'easeInOut' }
                      : { duration: 0.6, delay: i * 0.05, ease: [0.4, 0, 0.2, 1] }
                  }
                >
                  {/* Card back pattern */}
                  <div style={{
                    position: 'absolute',
                    inset: '6px',
                    borderRadius: '8px',
                    border: '1px solid rgba(103, 232, 249, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 8px)',
                  }}>
                    <span style={{ color: 'rgba(103, 232, 249, 0.25)', fontSize: '24px', fontWeight: 900 }}>♣</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Status text */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <p style={{
                  fontSize: '2rem',
                  fontWeight: 900,
                  color: '#a78bfa',
                  textShadow: '0 0 20px rgba(8, 145, 178, 0.6)',
                  margin: 0,
                }}>
                  {phase === 'shuffle' ? '🔀 Shuffling Deck...' : '🃏 Dealing Cards...'}
                </p>
              </motion.div>

              {/* Player deal indicators */}
              <AnimatePresence>
                {phase === 'deal' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}
                  >
                    {players.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="panel-sm"
                        style={{ padding: '8px 16px', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>{p.avatar}</span>
                        <span style={{ color: '#9ca3af' }}>{p.name}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
