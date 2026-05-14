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
const COLORS = {
  success: 'border-green-500/40 text-green-300',
  error:   'border-red-500/40 text-red-300',
  info:    'border-cyan-500/40 text-cyan-300',
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
    <div className="fixed top-4 left-1/2 z-[999] flex flex-col gap-2" style={{ transform: 'translateX(-50%)', minWidth: '280px', maxWidth: '400px' }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            onClick={() => remove(t.id)}
            className={`flex items-start gap-3 px-4 py-3 rounded-2xl cursor-pointer border ${COLORS[t.type]}`}
            style={{ background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(20px)' }}
          >
            <span className="text-lg shrink-0">{ICONS[t.type]}</span>
            <p className="text-sm font-semibold text-white/90 leading-snug">{t.message}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
