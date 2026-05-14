import React from 'react';
import { motion } from 'framer-motion';
import AvatarDisplay from '../../../components/common/AvatarDisplay';
import ChatBubble from '../../../components/common/ChatBubble';
import CPCard from './CPCard';

/**
 * CPPlayerArea — a single player slot in the 4-player table layout.
 * Reuses the common AvatarDisplay and ChatBubble components.
 *
 * Props:
 *  player       { id, name, avatar, cardCount, isConnected }
 *  team         'A' | 'B'
 *  isMe         bool
 *  isCurrentTurn bool
 *  playedCard   cardId | null  (card they played in current trick)
 *  trumpSuit    string
 *  position     'bottom' | 'top' | 'left' | 'right'
 *  chatMessage  string | null
 *  isHost       bool
 */
export default function CPPlayerArea({
  player,
  team,
  isMe = false,
  isCurrentTurn = false,
  playedCard = null,
  trumpSuit,
  position = 'top',
  chatMessage = null,
  isHost = false,
}) {
  if (!player) return null;

  const isVertical = position === 'top' || position === 'bottom';
  const teamColor = team === 'A' ? '#f59e0b' : '#a78bfa';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'center',
        gap: 8,
        position: 'relative',
      }}
    >
      {/* Chat bubble */}
      {chatMessage && (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 30, pointerEvents: 'none', marginBottom: 8 }}>
          <ChatBubble message={chatMessage} isMe={isMe} />
        </div>
      )}

      {/* Avatar + info */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        {/* Turn indicator ring */}
        {isCurrentTurn && (
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            style={{
              position: 'absolute',
              inset: -5,
              borderRadius: '50%',
              border: `2.5px solid ${teamColor}`,
              pointerEvents: 'none',
            }}
          />
        )}
        <AvatarDisplay
          avatarId={player.avatar}
          playerName={player.name}
          size={isMe ? 44 : 36}
          animated={isCurrentTurn}
        />

        {/* Name + team badge */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            {isHost && <span title="Host" style={{ fontSize: '0.65rem' }}>👑</span>}
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: player.isConnected ? '#e2e8f0' : '#4b5563',
              maxWidth: 80,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {isMe ? `${player.name} (You)` : player.name}
            </span>
          </div>
          <div style={{
            fontSize: '0.6rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: teamColor,
            textTransform: 'uppercase',
          }}>
            Team {team} · {player.cardCount ?? 0} cards
          </div>
          {!player.isConnected && (
            <div style={{ fontSize: '0.58rem', color: '#ef4444', fontWeight: 700 }}>OFFLINE</div>
          )}
        </div>
      </div>

      {/* Played card in trick */}
      {playedCard && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: position === 'top' ? -20 : position === 'bottom' ? 20 : 0 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <CPCard cardId={playedCard} trumpSuit={trumpSuit} size="sm" />
        </motion.div>
      )}

      {/* Playing indicator (face-down card back) */}
      {isCurrentTurn && !playedCard && !isMe && (
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
        >
          <CPCard cardId="X" size="sm" />
        </motion.div>
      )}
    </div>
  );
}
