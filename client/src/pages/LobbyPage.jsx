import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { toast } from '../components/Toast';
import Avatar from '../components/Icons';

export default function LobbyPage() {
  const { gameState, playerId, startGame, roomId, disconnect, kickPlayer } = useGameStore();
  const [copied, setCopied] = useState(false);

  const players = gameState?.players || [];
  const isHost = gameState?.hostId === playerId;
  const canStart = players.length >= 2;

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?room=${roomId}`).then(() => {
      setCopied(true); toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at 50% 0%, #1a0a3d 0%, #0c0c1a 60%, #060614 100%)', padding: '0 20px' }}>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }} style={{ width: '100%', maxWidth: 480 }}>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontSize: '.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.15em', fontWeight: 900, marginBottom: 8 }}>ROOM CODE</p>
          <h1 style={{
            fontSize: '3.2rem', fontWeight: 900, letterSpacing: '.25em',
            background: 'linear-gradient(135deg, #c4b5fd, #7c3aed)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(124,58,237,0.4))',
          }}>{roomId}</h1>
        </div>

        <div className="panel-sm" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <code style={{ flex: 1, fontSize: '.8rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{window.location.origin}?room={roomId}</code>
          <button onClick={copyLink} className="btn btn-sm"
            style={{ background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)', border: copied ? '1px solid #10b98166' : '1px solid #7c3aed66', color: copied ? '#10b981' : '#a78bfa', fontWeight: 900, width: 'auto' }}>
            {copied ? 'COPIED' : 'COPY LINK'}
          </button>
        </div>

        <div className="panel" style={{ padding: 32, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ fontWeight: 900, fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Players</h2>
            <div style={{ padding: '6px 14px', fontSize: '.85rem', fontWeight: 900, color: '#9ca3af', background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>{players.length}/8</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 100 }}>
            <AnimatePresence>
              {players.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ delay: i * 0.05 }}
                  className={`player-row${p.id === playerId ? ' me' : ''}`} style={{ padding: '12px 16px' }}>
                  <Avatar name={p.name} size={40} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 900, fontSize: '.95rem', margin: 0 }}>
                      {p.name.toUpperCase()}
                      {p.id === playerId && <span style={{ color: '#a78bfa', fontSize: '.7rem', marginLeft: 8 }}>(YOU)</span>}
                    </p>
                    {gameState?.hostId === p.id && <p style={{ fontSize: '.65rem', color: '#f59e0b', fontWeight: 900, margin: 0, letterSpacing: '0.1em' }}>ROOM HOST</p>}
                  </div>
                  {isHost && p.id !== playerId && (
                    <button onClick={() => kickPlayer(p.id)} 
                      style={{ padding: '6px 12px', fontSize: '.7rem', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 900, cursor: 'pointer' }}>KICK</button>
                  )}
                  <div className="dot-live" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {isHost ? (
            <div style={{ marginTop: 24 }}>
              {!canStart && <p style={{ textAlign: 'center', fontSize: '.75rem', color: '#6b7280', marginBottom: 16, fontWeight: 700 }}>WAITING FOR AT LEAST 2 PLAYERS</p>}
              <button className="btn btn-primary" onClick={startGame} disabled={!canStart}
                style={{ opacity: canStart ? 1 : 0.4, cursor: canStart ? 'pointer' : 'not-allowed', padding: 20 }}>
                START SESSION
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ width: 20, height: 20, border: '3px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ color: '#6b7280', fontSize: '.9rem', fontWeight: 900 }}>WAITING FOR HOST...</span>
            </div>
          )}
        </div>

        <button className="btn btn-outline" onClick={disconnect} style={{ fontSize: '.8rem', color: '#9ca3af', padding: '16px', fontWeight: 900 }}>LEAVE TABLE</button>
      </motion.div>
    </div>
  );
}
