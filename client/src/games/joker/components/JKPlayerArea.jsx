import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AvatarDisplay from '../../../components/common/AvatarDisplay';
import ChatBubble from '../../../components/common/ChatBubble';
import JKCard from './JKCard';

export default function JKPlayerArea({
  player,
  isMe = false,
  isCurrentTurn = false,
  isTarget = false,
  isMyTurn = false,
  chatMessage = null,
  discardMessage = null, // { id, text }
  isHost = false,
  compact = false,
  onPickCard,
}) {
  if (!player) return null;

  const glowColor = 'var(--red)';

  // Opponent's face-down cards to show
  const cardCount = player.cardCount || 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
        zIndex: 5,
        opacity: player.isConnected ? 1 : 0.7,
        filter: player.isConnected ? 'none' : 'grayscale(0.5)',
      }}
    >
      {/* Floating Discard Banner */}
      <AnimatePresence>
        {discardMessage && (
          <motion.div
            key={discardMessage.id}
            initial={{ opacity: 0, y: 15, scale: 0.8, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: -45, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -90, scale: 0.8, filter: 'blur(8px)' }}
            transition={{ duration: 2.0, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              zIndex: 100,
              background: 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: compact ? '0.65rem' : '0.75rem',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.5), 0 4px 10px rgba(0,0,0,0.4)',
              border: '1.5px solid rgba(255, 255, 255, 0.2)',
              pointerEvents: 'none'
            }}
          >
            {discardMessage.text}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Chat bubble */}
      {chatMessage && (
        <div style={{ position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)', zIndex: 30, pointerEvents: 'none', marginBottom: 1.5 }}>
          <ChatBubble message={chatMessage} isMe={isMe} />
        </div>
      )}

      {/* Avatar Container */}
      <div style={{ position: 'relative', width: compact ? 32 : 44, height: compact ? 32 : 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Active Turn Glow */}
        {isCurrentTurn && (
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: 'absolute',
              inset: compact ? -4 : -6,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${glowColor}66 0%, transparent 70%)`,
              border: `2px solid ${glowColor}`,
              boxShadow: `0 0 15px ${glowColor}44`,
              zIndex: -1,
            }}
          />
        )}

        <AvatarDisplay
          avatarId={player.avatar}
          playerName={player.name}
          size={compact ? 28 : 40}
          animated={isCurrentTurn}
        />

        {/* Host Crown */}
        {isHost && (
          <div style={{ position: 'absolute', top: compact ? -8 : -10, right: compact ? -8 : -10, fontSize: compact ? '0.7rem' : '1rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
            👑
          </div>
        )}
      </div>

      {/* Player Info Badge */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'rgba(15,10,25,0.7)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${isCurrentTurn ? glowColor : isTarget && isMyTurn ? '#facc15' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: compact ? 14 : 20,
        padding: compact ? '3px 8px' : '4px 12px',
        minWidth: compact ? 70 : 100,
        boxShadow: isTarget && isMyTurn ? '0 0 12px rgba(250,204,21,0.4)' : '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <span style={{
          fontSize: compact ? '0.65rem' : '0.75rem',
          fontWeight: 700,
          color: player.isConnected ? '#fff' : '#64748b',
          maxWidth: compact ? 65 : 90,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}>
          {isMe ? 'You' : player.name}
        </span>
        <span style={{
          fontSize: compact ? '0.5rem' : '0.55rem',
          fontWeight: 800,
          letterSpacing: '0.05em',
          color: isTarget && isMyTurn ? '#facc15' : 'var(--red)',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}>
          {isTarget && isMyTurn ? 'Pick from!' : `${cardCount} Cards`}
        </span>
      </div>

      {/* Disconnected / AI takeover status */}
      {!player.isConnected && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)', color: '#f87171',
          fontSize: '0.55rem', fontWeight: 900, padding: '2px 8px',
          borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.3)',
          letterSpacing: '0.05em', marginTop: 2
        }}>
          AI TAKEOVER
        </div>
      )}

      {/* Face-down cards fan (only for Opponents) */}
      {!isMe && cardCount > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: 6,
          position: 'relative',
          height: compact ? 38 : 50,
          width: Math.min(120, cardCount * 12 + 25),
        }}>
          {Array.from({ length: cardCount }).map((_, idx) => {
            const rot = (idx - (cardCount - 1) / 2) * (cardCount > 6 ? 6 : 10);
            const clickable = isTarget && isMyTurn;
            return (
              <motion.div
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${idx * (100 / Math.max(cardCount, 1))}%`,
                  transformOrigin: 'bottom center',
                  zIndex: idx,
                }}
                animate={{
                  rotate: rot,
                }}
                whileHover={clickable ? { scale: 1.15, zIndex: 100, y: -8 } : {}}
              >
                <JKCard
                  cardId="X"
                  faceDown={true}
                  size={compact ? 'xs' : 'sm'}
                  onClick={clickable ? () => onPickCard(idx) : undefined}
                  style={{
                    border: clickable ? '1.5px solid #facc15' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: clickable ? '0 0 10px rgba(250,204,21,0.5)' : 'none',
                  }}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
