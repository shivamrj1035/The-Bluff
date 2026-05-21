import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

let addToastFn = null;

export function toast(message, type = 'info', duration = 3500) {
  addToastFn?.({ message, type, id: Date.now() + Math.random(), duration });
}
toast.success = (msg, dur) => toast(msg, 'success', dur);
toast.error   = (msg, dur) => toast(msg, 'error', dur);
toast.info    = (msg, dur) => toast(msg, 'info', dur);

const ICONS = { success: '✅', error: '❌', info: 'ℹ️' };
const COLORS_STYLE = {
  success: { borderColor: 'rgba(34, 197, 94, 0.4)', color: '#86efac' },
  error:   { borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' },
  info:    { borderColor: 'rgba(6, 182, 212, 0.4)', color: '#67e8f9' },
};

export function Toaster() {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  useEffect(() => {
    addToastFn = (t) => {
      setToasts(prev => [...prev.slice(-4), t]);
      setTimeout(() => remove(t.id), t.duration);
    };
    return () => { addToastFn = null; };
  }, [remove]);

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minWidth: '280px',
      maxWidth: '400px',
      pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            onClick={() => remove(t.id)}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '16px',
              cursor: 'pointer',
              borderWidth: '1px',
              borderStyle: 'solid',
              background: 'rgba(15, 10, 25, 0.95)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              ...COLORS_STYLE[t.type]
            }}
          >
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{ICONS[t.type]}</span>
            <p style={{
              margin: 0,
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#f8fafc',
              lineHeight: 1.4
            }}>{t.message}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
