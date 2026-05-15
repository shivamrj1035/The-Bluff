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

  const teamColor = team === 'A' ? '#f59e0b' : '#a78bfa';

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
      {/* Chat bubble */}
      {chatMessage && (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 30, pointerEvents: 'none', marginBottom: 12 }}>
          <ChatBubble message={chatMessage} isMe={isMe} />
        </div>
      )}

      {/* Avatar Container */}
      <div style={{ position: 'relative', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Active Turn Glow */}
        {isCurrentTurn && (
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${teamColor}66 0%, transparent 70%)`,
              border: `2px solid ${teamColor}`,
              boxShadow: `0 0 15px ${teamColor}44`,
              zIndex: -1,
            }}
          />
        )}
        
        <AvatarDisplay
          avatarId={player.avatar}
          playerName={player.name}
          size={40}
          animated={isCurrentTurn}
        />
        
        {/* Host Crown */}
        {isHost && (
          <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '1rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
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
        border: `1px solid ${isCurrentTurn ? teamColor : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 20,
        padding: '4px 12px',
        minWidth: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: player.isConnected ? '#fff' : '#64748b',
          maxWidth: 90,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}>
          {isMe ? 'You (Glow)' : player.name}
        </span>
        <span style={{
          fontSize: '0.55rem',
          fontWeight: 800,
          letterSpacing: '0.05em',
          color: teamColor,
          textTransform: 'uppercase',
          lineHeight: 1,
        }}>
          TEAM {team} • {player.cardCount ?? 0} CARDS
        </span>
      </div>

      {/* AI Takeover / Offline Status */}
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
    </div>
  );
}

