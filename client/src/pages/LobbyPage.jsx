import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { toast } from '../components/Toast';
import Avatar from '../components/Icons';

export default function LobbyPage() {
  const {
    gameState, startGame, roomId, disconnect, kickPlayer,
    reorderPlayers, hostTransferredName, hostTransferredId,
  } = useGameStore();
  const [copied, setCopied] = useState(false);
  const prevHostTransfer = useRef(null);

  const players = gameState?.players || [];

  // ✅ FIX: Use gameState.myId (embedded by server) instead of store's playerId
  // This avoids race conditions where playerId hasn't been set yet in the store
  // ✅ Guard: explicitly require gameState to be non-null.
  // Without this, undefined === undefined gives a false-positive isHost=true
  // when gameState is null (socket connected but game_state not yet received).
  const myId = gameState?.myId ?? null;
  const isHost = Boolean(gameState && myId && gameState.hostId === myId);
  const canStart = players.length >= 2;

  // Toast when host changes
  useEffect(() => {
    if (
      hostTransferredName &&
      hostTransferredId &&
      hostTransferredId !== prevHostTransfer.current
    ) {
      prevHostTransfer.current = hostTransferredId;
      if (hostTransferredId === myId) {
        toast.success('👑 You are now the host!');
      } else {
        toast.info(`👑 ${hostTransferredName} is the new host`);
      }
    }
  }, [hostTransferredName, hostTransferredId, myId]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?room=${roomId}`).then(() => {
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Move a player up/down in the order; host only
  const movePlayer = (idx, direction) => {
    const newPlayers = [...players];
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= newPlayers.length) return;
    [newPlayers[idx], newPlayers[swapIdx]] = [newPlayers[swapIdx], newPlayers[idx]];
    reorderPlayers(newPlayers.map((p) => p.id));
  };

  // ⚡ If connected but no game_state yet — show a loading spinner
  // This prevents the fake empty lobby (0/8 players) from appearing
  if (!gameState) {
    return (
      <div style={{
        height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 0%, #1a0a3d 0%, #0c0c1a 60%, #060614 100%)',
        gap: 20,
      }}>
        <div style={{
          width: 48, height: 48, border: '4px solid #7c3aed',
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: '#a78bfa', fontWeight: 800, fontSize: '1rem', letterSpacing: '.1em' }}>
          JOINING ROOM...
        </p>
        <p style={{ color: '#4b5563', fontWeight: 600, fontSize: '.75rem' }}>
          Connecting to game server
        </p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, #1a0a3d 0%, #0c0c1a 60%, #060614 100%)',
      padding: '0 20px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        style={{ width: '100%', maxWidth: 500 }}
      >

        {/* Room code */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontSize: '.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.15em', fontWeight: 900, marginBottom: 8 }}>ROOM CODE</p>
          <h1 style={{
            fontSize: '3.2rem', fontWeight: 900, letterSpacing: '.25em',
            background: 'linear-gradient(135deg, #c4b5fd, #7c3aed)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(124,58,237,0.4))',
          }}>{roomId}</h1>
        </div>

        {/* Invite link */}
        <div className="panel-sm" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <code style={{ flex: 1, fontSize: '.8rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
            {window.location.origin}?room={roomId}
          </code>
          <button onClick={copyLink} className="btn btn-sm"
            style={{
              background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)',
              border: copied ? '1px solid #10b98166' : '1px solid #7c3aed66',
              color: copied ? '#10b981' : '#a78bfa', fontWeight: 900, width: 'auto',
            }}>
            {copied ? 'COPIED' : 'COPY LINK'}
          </button>
        </div>

        {/* Players panel */}
        <div className="panel" style={{ padding: 32, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontWeight: 900, fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Players</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isHost && players.length >= 2 && (
                <span style={{ fontSize: '.65rem', color: '#a78bfa', fontWeight: 800, letterSpacing: '.08em', opacity: 0.7 }}>
                  ↕ DRAG ORDER = TURN ORDER
                </span>
              )}
              <div style={{ padding: '6px 14px', fontSize: '.85rem', fontWeight: 900, color: '#9ca3af', background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
                {players.length}/8
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 100 }}>
            <AnimatePresence>
              {players.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ delay: i * 0.04, layout: { duration: 0.25 } }}
                  className={`player-row${p.id === myId ? ' me' : ''}`}
                  style={{ padding: '12px 16px', position: 'relative' }}
                >
                  {/* Turn order number */}
                  <div style={{
                    minWidth: 24, height: 24, borderRadius: '50%',
                    background: i === 0 ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.06)',
                    border: i === 0 ? '1px solid #7c3aed88' : '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.7rem', fontWeight: 900, color: i === 0 ? '#a78bfa' : '#4b5563',
                    marginRight: 4,
                  }}>
                    {i + 1}
                  </div>

                  <Avatar name={p.name} size={38} />

                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 900, fontSize: '.95rem', margin: 0 }}>
                      {p.name.toUpperCase()}
                      {p.id === myId && <span style={{ color: '#a78bfa', fontSize: '.7rem', marginLeft: 8 }}>(YOU)</span>}
                    </p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                      {gameState?.hostId === p.id && (
                        <span style={{ fontSize: '.62rem', color: '#f59e0b', fontWeight: 900, letterSpacing: '0.1em' }}>👑 HOST</span>
                      )}
                      {i === 0 && (
                        <span style={{ fontSize: '.62rem', color: '#7c3aed', fontWeight: 900, letterSpacing: '0.08em' }}>GOES FIRST</span>
                      )}
                      {!p.isConnected && (
                        <span style={{ fontSize: '.62rem', color: '#ef4444', fontWeight: 900 }}>DISCONNECTED</span>
                      )}
                    </div>
                  </div>

                  {/* Host reorder buttons */}
                  {isHost && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 6 }}>
                      <button
                        onClick={() => movePlayer(i, -1)}
                        disabled={i === 0}
                        title="Move up (earlier turn)"
                        style={{
                          padding: '2px 7px', fontSize: '.7rem', borderRadius: 6,
                          background: i === 0 ? 'transparent' : 'rgba(124,58,237,0.12)',
                          border: i === 0 ? '1px solid transparent' : '1px solid rgba(124,58,237,0.3)',
                          color: i === 0 ? '#2d2d3a' : '#a78bfa',
                          cursor: i === 0 ? 'default' : 'pointer', lineHeight: 1,
                        }}>
                        ▲
                      </button>
                      <button
                        onClick={() => movePlayer(i, 1)}
                        disabled={i === players.length - 1}
                        title="Move down (later turn)"
                        style={{
                          padding: '2px 7px', fontSize: '.7rem', borderRadius: 6,
                          background: i === players.length - 1 ? 'transparent' : 'rgba(124,58,237,0.12)',
                          border: i === players.length - 1 ? '1px solid transparent' : '1px solid rgba(124,58,237,0.3)',
                          color: i === players.length - 1 ? '#2d2d3a' : '#a78bfa',
                          cursor: i === players.length - 1 ? 'default' : 'pointer', lineHeight: 1,
                        }}>
                        ▼
                      </button>
                    </div>
                  )}

                  {/* Kick button (host only, not self) */}
                  {isHost && p.id !== myId && (
                    <button
                      onClick={() => kickPlayer(p.id)}
                      style={{
                        padding: '6px 10px', fontSize: '.7rem', borderRadius: 8,
                        background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444', fontWeight: 900, cursor: 'pointer',
                      }}>
                      KICK
                    </button>
                  )}

                  <div className="dot-live" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Host controls / waiting message */}
          {isHost ? (
            <div style={{ marginTop: 24 }}>
              {!canStart && (
                <p style={{ textAlign: 'center', fontSize: '.75rem', color: '#6b7280', marginBottom: 16, fontWeight: 700 }}>
                  WAITING FOR AT LEAST 2 PLAYERS
                </p>
              )}
              {canStart && (
                <p style={{ textAlign: 'center', fontSize: '.72rem', color: '#7c3aed', marginBottom: 12, fontWeight: 800, letterSpacing: '.06em', opacity: 0.8 }}>
                  ↕ SET TURN ORDER ABOVE, THEN START
                </p>
              )}
              <button
                className="btn btn-primary"
                onClick={startGame}
                disabled={!canStart}
                style={{ opacity: canStart ? 1 : 0.4, cursor: canStart ? 'pointer' : 'not-allowed', padding: 20 }}
              >
                START SESSION
              </button>
            </div>
          ) : (
            <div style={{
              marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 12, padding: '20px',
              background: 'rgba(0,0,0,0.2)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.03)',
            }}>
              <div style={{
                width: 20, height: 20, border: '3px solid #7c3aed',
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ color: '#6b7280', fontSize: '.9rem', fontWeight: 900 }}>WAITING FOR HOST TO START...</span>
            </div>
          )}
        </div>

        <button className="btn btn-outline" onClick={disconnect} style={{ fontSize: '.8rem', color: '#9ca3af', padding: '16px', fontWeight: 900 }}>
          LEAVE TABLE
        </button>
      </motion.div>
    </div>
  );
}
