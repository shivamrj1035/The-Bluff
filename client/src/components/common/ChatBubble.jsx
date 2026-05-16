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
export default function ChatBubble({ messages, message, isMe, position = 'bottom' }) {
  // Support both array of messages and a single message string
  const latestMessage = message || (messages?.[messages.length - 1]?.message);
  const msgId = message ? 'direct-msg' : messages?.[messages.length - 1]?.id;
  
  if (!latestMessage) return null;

  const isTailUp = position === 'top'; // tail points up → bubble is below the avatar

  return (
    <div style={{
      position: 'absolute',
      [isTailUp ? 'top' : 'bottom']: isTailUp ? '-52px' : '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 200,
      pointerEvents: 'none',
      width: 'max-content',
      maxWidth: isMe ? '220px' : '160px',
    }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={msgId || latestMessage}
          initial={{ opacity: 0, y: isTailUp ? 6 : -6, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: isTailUp ? -6 : 6, scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{
            background: isMe
              ? 'linear-gradient(135deg, rgba(245,158,11,0.95), rgba(217,119,6,0.95))'
              : 'rgba(15,10,25,0.98)',
            border: isMe ? '1.5px solid rgba(245,158,11,0.6)' : '1.5px solid rgba(255,255,255,0.15)',
            borderRadius: '10px',
            padding: '1.5px 8px', // Requested 1.5px padding
            backdropFilter: 'blur(16px)',
            boxShadow: isMe
              ? '0 4px 20px rgba(245,158,11,0.3)'
              : '0 4px 20px rgba(0,0,0,0.6)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Message text */}
          <p style={{
            margin: 0,
            fontSize: '0.7rem',
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1.2,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            textAlign: 'center'
          }}>
            {latestMessage}
          </p>

          {/* Tail pointer */}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `5px solid ${isMe ? 'rgba(245,158,11,0.95)' : 'rgba(15,10,25,0.98)'}`,
          }} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
