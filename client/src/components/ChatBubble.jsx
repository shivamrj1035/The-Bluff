import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * ChatBubble — A speech bubble that appears over a player's avatar/card.
 * 
 * Props:
 *   messages  — array of { id, senderId, senderName, message, ts } for this specific player
 *   isMe      — true = render on right side (bottom HUD), false = render on opponent card
 *   position  — 'top' | 'bottom' (where the bubble tail points)
 */
export default function ChatBubble({ messages, isMe, position = 'bottom' }) {
  // Only show the most recently active message for this player
  const latest = messages?.[messages.length - 1];
  if (!latest) return null;

  const isTailUp = position === 'top'; // tail points up → bubble is below the avatar

  return (
    <div style={{
      position: 'absolute',
      // For opponent cards: bubble above the card. For me: above the HUD avatar
      [isTailUp ? 'top' : 'bottom']: isTailUp ? '-52px' : '108%',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 200,
      pointerEvents: 'none',
      width: 'max-content',
      maxWidth: isMe ? '220px' : '160px',
    }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={latest.id}
          initial={{ opacity: 0, y: isTailUp ? 6 : -6, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: isTailUp ? -6 : 6, scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{
            background: isMe
              ? 'linear-gradient(135deg, rgba(124,58,237,0.95), rgba(91,33,182,0.95))'
              : 'rgba(15,15,28,0.97)',
            border: isMe ? '1.5px solid rgba(167,139,250,0.6)' : '1.5px solid rgba(255,255,255,0.12)',
            borderRadius: '14px',
            padding: '7px 12px',
            backdropFilter: 'blur(12px)',
            boxShadow: isMe
              ? '0 4px 24px rgba(124,58,237,0.4), 0 0 0 1px rgba(167,139,250,0.15)'
              : '0 4px 20px rgba(0,0,0,0.5)',
            position: 'relative',
          }}
        >
          {/* Message text */}
          <p style={{
            margin: 0,
            fontSize: '0.75rem',
            fontWeight: 700,
            color: isMe ? '#fff' : '#e2e8f0',
            lineHeight: 1.45,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}>
            {latest.message}
          </p>

          {/* Tail pointer */}
          <div style={{
            position: 'absolute',
            [isTailUp ? 'top' : 'bottom']: isTailUp ? '100%' : '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            [isTailUp
              ? 'borderBottom'
              : 'borderTop']: `8px solid ${isMe ? 'rgba(124,58,237,0.95)' : 'rgba(15,15,28,0.97)'}`,
          }} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
