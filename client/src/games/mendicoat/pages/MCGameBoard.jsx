import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMCStore } from '../store/useMCStore';
import MCCard from '../components/MCCard';
import MCPlayerArea from '../components/MCPlayerArea';
import TrumpSelector from '../components/TrumpSelector';
import ChatInput from '../../../components/common/ChatInput';
import AvatarDisplay from '../../../components/common/AvatarDisplay';

const SUIT_SYMBOL = { H: '♥', D: '♦', C: '♣', S: '♠' };
const SUIT_NAME   = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades' };
const SUIT_COLOR  = { H: '#ef4444', D: '#ef4444', C: '#e2e8f0', S: '#e2e8f0' };
const TEAM_COLORS = { A: '#f59e0b', B: '#a78bfa' };

function getCardSuit(c) { return c?.split('_')[0]; }

export default function MCGameBoard() {
  const {
    mcGameState: gs,
    mcRoomId,
    mcSelectedCard,
    mcSetSelectedCard,
    mcPlayCard,
    mcSelectTrump,
    mcCloseGame,
    mcRestartGame,
    mcSendChat,
    mcChatMessages,
    mcSocket,
    mcDisconnect,
  } = useMCStore();

  // Guard — server hasn't sent state yet
  if (!gs) {
    return (
      <div style={{
        height: '100vh', width: '100vw', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0a0515', color: '#fff',
        fontFamily: "'Inter', sans-serif", flexDirection: 'column', gap: 20,
      }}>
        <div style={{ width: 40, height: 40, border: '3px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#94a3b8', fontWeight: 700 }}>Connecting to game…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const myId      = gs.myId;
  const myTeam    = gs.myTeam;
  const hand      = gs.hands?.[myId] || [];
  const isHost    = Boolean(myId && gs.hostId === myId);
  const players   = gs.players || [];

  // Relative positions
  const myIndex     = players.findIndex(p => p.id === myId);
  const getRelative = (offset) => players[(myIndex + offset + 4) % 4] || null;

  const bottomPlayer = players[myIndex];
  const topPlayer    = getRelative(2);
  const leftPlayer   = getRelative(3);
  const rightPlayer  = getRelative(1);

  const trickCardFor = (playerId) =>
    gs.currentTrick?.find(t => t.playerId === playerId)?.card || null;

  // Card playability
  const leadSuit    = gs.leadSuit;
  const hasLeadSuit = leadSuit && hand.some(c => getCardSuit(c) === leadSuit);
  const isValidSuit = (card) => {
    if (!leadSuit) return true;
    if (hasLeadSuit) return getCardSuit(card) === leadSuit;
    return true;
  };
  const isPlayable = (card) => {
    if (gs.state !== 'PLAYING') return false;
    if (gs.currentTurn !== myId) return false;
    return isValidSuit(card);
  };

  const isTrumpSelection = gs.state === 'TRUMP_SELECTION';
  const iAmTrumpSelector = gs.trumpSelecterId === myId;
  const isRoundEnd       = gs.state === 'ROUND_END';
  const isGameOver       = gs.state === 'GAME_OVER';

  const handleCardClick = (card) => {
    if (!isPlayable(card)) return;
    if (mcSelectedCard === card) {
      mcPlayCard(card);
    } else {
      mcSetSelectedCard(card);
    }
  };

  return (
    <div style={{
      height: '100vh', width: '100vw', overflow: 'hidden',
      background: '#0a0515', color: '#fff',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', sans-serif", position: 'relative',
    }}>
      {/* Background Gradients */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, #1a0a3a 0%, transparent 70%)', opacity: 0.4, pointerEvents: 'none' }} />

      {/* ── TOP HEADER ─────────────────────────────────────────────── */}
      <div style={{
        height: 60, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 24px', zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '0.15em' }}>MENDI COAT</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8' }}>
            Room <span style={{ color: '#fff', opacity: 0.9 }}>{mcRoomId}</span>
            {gs.trumpSuit && (
              <span style={{ marginLeft: 12 }}>
                Trump : <span style={{ color: SUIT_COLOR[gs.trumpSuit] }}>{SUIT_SYMBOL[gs.trumpSuit]} {SUIT_NAME[gs.trumpSuit]}</span>
              </span>
            )}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={mcDisconnect} style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171', padding: '6px 16px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
          }}>
            Leave Game
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
      <div style={{
        flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 60px 20px 240px'
      }}>

        {/* Sidebar Statistics */}
        <div style={{
          position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)',
          width: 190, background: 'rgba(15,10,25,0.85)', backdropFilter: 'blur(12px)',
          borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16, zIndex: 10,
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
        }}>
          {/* Trump suit */}
          <div>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>TRUMP</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: '1.4rem', color: SUIT_COLOR[gs.trumpSuit] || '#64748b' }}>{SUIT_SYMBOL[gs.trumpSuit] || '—'}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{SUIT_NAME[gs.trumpSuit] || 'None'}</span>
            </div>
          </div>

          {/* Tricks left */}
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>TRICKS LEFT</span>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff' }}>{13 - (gs.trickCount || 0)}</div>
          </div>

          {/* Team scorecards — shows Mendis (10s) + Tricks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {['A', 'B'].map(t => (
              <div key={t}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: TEAM_COLORS[t] }}>TEAM {t}</span>
                  <span style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 700 }}>
                    🃏{gs.teams?.[t]?.tricks || 0} · 🔟{gs.teams?.[t]?.mendis || 0}
                  </span>
                </div>
                <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: 5, fontWeight: 600 }}>
                  {players.filter((_, i) => i % 2 === (t === 'A' ? 0 : 1)).map(p => p.id === myId ? 'You' : p.name).join(' & ')}
                </div>
                {/* Coat count */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: 5 }).map((_, ci) => (
                    <div key={ci} style={{
                      width: 20, height: 20, borderRadius: 5,
                      background: ci < (gs.teams?.[t]?.coats || 0) ? TEAM_COLORS[t] : 'rgba(255,255,255,0.08)',
                      border: `1px solid ${ci < (gs.teams?.[t]?.coats || 0) ? TEAM_COLORS[t] : 'rgba(255,255,255,0.05)'}`,
                    }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10, textAlign: 'center', fontSize: '0.55rem', fontWeight: 800, color: '#64748b' }}>
            MOST 10s WINS
          </div>
        </div>

        {/* ── THE TABLE ──────────────────────────────────────────────── */}
        <div style={{
          width: 'min(100%, 860px)', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {/* Elliptical Table Shape */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '200px',
            background: 'linear-gradient(180deg, #2b1255 0%, #160a2a 100%)',
            border: '8px solid #1c0e35',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8), 0 30px 100px rgba(0,0,0,0.6)',
            aspectRatio: '2/1', zIndex: 1
          }}>
            <div style={{ position: 'absolute', inset: 15, borderRadius: '185px', border: '1px dashed rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.08, textAlign: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.3em', color: '#fff' }}>MENDI COAT</span>
            </div>
          </div>

          {/* Player Positions */}
          <div style={{ position: 'absolute', top: -85, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            {topPlayer && <MCPlayerArea player={topPlayer} team={players.indexOf(topPlayer) % 2 === 0 ? 'A' : 'B'} isMe={false} isCurrentTurn={gs.currentTurn === topPlayer.id} playedCard={trickCardFor(topPlayer.id)} trumpSuit={gs.trumpSuit} position="top" chatMessage={mcChatMessages?.find(m => m.senderId === topPlayer.id)?.message} isHost={topPlayer.id === gs.hostId} />}
          </div>
          <div style={{ position: 'absolute', bottom: -85, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            {bottomPlayer && <MCPlayerArea player={bottomPlayer} team={myTeam} isMe={true} isCurrentTurn={gs.currentTurn === myId} playedCard={null} trumpSuit={gs.trumpSuit} position="bottom" chatMessage={mcChatMessages?.find(m => m.senderId === myId)?.message} isHost={bottomPlayer.id === gs.hostId} />}
          </div>
          <div style={{ position: 'absolute', left: -75, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
            {leftPlayer && <MCPlayerArea player={leftPlayer} team={players.indexOf(leftPlayer) % 2 === 0 ? 'A' : 'B'} isMe={false} isCurrentTurn={gs.currentTurn === leftPlayer.id} playedCard={trickCardFor(leftPlayer.id)} trumpSuit={gs.trumpSuit} position="left" chatMessage={mcChatMessages?.find(m => m.senderId === leftPlayer.id)?.message} isHost={leftPlayer.id === gs.hostId} />}
          </div>
          <div style={{ position: 'absolute', right: -75, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
            {rightPlayer && <MCPlayerArea player={rightPlayer} team={players.indexOf(rightPlayer) % 2 === 0 ? 'A' : 'B'} isMe={false} isCurrentTurn={gs.currentTurn === rightPlayer.id} playedCard={trickCardFor(rightPlayer.id)} trumpSuit={gs.trumpSuit} position="right" chatMessage={mcChatMessages?.find(m => m.senderId === rightPlayer.id)?.message} isHost={rightPlayer.id === gs.hostId} />}
          </div>

          {/* Trick Cards in Center */}
          <div style={{ position: 'relative', width: 220, height: 220, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AnimatePresence>
              {[
                { id: topPlayer?.id,    pos: { top: 35,    left: '50%', x: '-50%' } },
                { id: bottomPlayer?.id, pos: { bottom: 35, left: '50%', x: '-50%' } },
                { id: leftPlayer?.id,   pos: { left: 35,   top: '50%',  y: '-50%' } },
                { id: rightPlayer?.id,  pos: { right: 35,  top: '50%',  y: '-50%' } },
              ].map(({ id, pos }) => {
                const card = trickCardFor(id);
                if (!card) return null;
                return (
                  <motion.div
                    key={`${id}-${card}`}
                    initial={{ scale: 0.5, opacity: 0, ...pos }}
                    animate={{ scale: 1, opacity: 1, ...pos }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    style={{ position: 'absolute', zIndex: 20 }}
                  >
                    <MCCard cardId={card} trumpSuit={gs.trumpSuit} size="sm" />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Trump Selection Overlay */}
          <AnimatePresence>
            {isTrumpSelection && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', inset: 0, zIndex: 50, borderRadius: '200px', background: 'rgba(10,5,20,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <TrumpSelector onSelect={mcSelectTrump} disabled={!iAmTrumpSelector} selectorName={players.find(p => p.id === gs.trumpSelecterId)?.name} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── ROUND / GAME OVER OVERLAY ──────────────────────────────── */}
      <AnimatePresence>
        {(isRoundEnd || isGameOver) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(5,2,12,0.8)', backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              style={{
                width: 'min(100%, 560px)', background: 'rgba(20,15,35,0.95)',
                borderRadius: 40, border: '1px solid rgba(255,255,255,0.1)',
                padding: '50px 40px', textAlign: 'center',
                boxShadow: '0 40px 100px rgba(0,0,0,0.8)'
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                {isGameOver ? 'Match Result' : 'Round Result'}
              </span>

              <h2 style={{ fontSize: '3.5rem', fontWeight: 900, margin: '0 0 10px', background: 'linear-gradient(to bottom, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Team {isGameOver ? gs.matchWinner : gs.roundWinner}
              </h2>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f59e0b', marginBottom: 40 }}>VICTORY</p>

              {/* Team stats: Mendis + Tricks */}
              <div style={{ display: 'flex', gap: 20, marginBottom: 50 }}>
                {['A', 'B'].map(t => {
                  const winner = isGameOver ? gs.matchWinner : gs.roundWinner;
                  return (
                    <div key={t} style={{
                      flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: '24px 16px',
                      border: `1px solid ${winner === t ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: winner === t ? '0 10px 30px rgba(245,158,11,0.15)' : 'none'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: TEAM_COLORS[t], display: 'block', marginBottom: 8 }}>TEAM {t}</span>
                      <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: 12, fontWeight: 600 }}>
                        {players.filter((_, i) => i % 2 === (t === 'A' ? 0 : 1)).map(p => p.id === myId ? 'You' : p.name).join(' & ')}
                      </div>
                      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                        <div>
                          <div style={{ fontSize: '2rem', fontWeight: 900 }}>{gs.teams?.[t]?.mendis || 0}</div>
                          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>🔟 MENDIS</span>
                        </div>
                        <div>
                          <div style={{ fontSize: '2rem', fontWeight: 900 }}>{gs.teams?.[t]?.tricks || 0}</div>
                          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>🃏 TRICKS</span>
                        </div>
                        <div>
                          <div style={{ fontSize: '2rem', fontWeight: 900 }}>{gs.teams?.[t]?.coats || 0}</div>
                          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>🏆 COATS</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {isHost && (
                  <button
                    onClick={mcRestartGame}
                    style={{
                      width: '100%', background: '#f59e0b', color: '#000', border: 'none',
                      padding: '18px', borderRadius: 16, fontWeight: 900, cursor: 'pointer',
                      fontSize: '1.1rem', transition: 'transform 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {isGameOver ? 'START NEW MATCH' : 'CONTINUE TO NEXT ROUND'}
                  </button>
                )}

                <button
                  onClick={() => { mcDisconnect(); window.location.href = '/'; }}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)', padding: '16px',
                    borderRadius: 16, fontWeight: 800, cursor: 'pointer', fontSize: '1rem'
                  }}
                >
                  CLOSE & BACK TO HOME
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM HAND AREA ──────────────────────────────────────── */}
      <div style={{
        height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '0 24px 20px', zIndex: 100, gap: 15
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {hand.map((card, idx) => {
            const playable = isPlayable(card);
            return (
              <motion.div
                key={card}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <MCCard
                  cardId={card}
                  trumpSuit={gs.trumpSuit}
                  disabled={!playable && gs.currentTurn === myId}
                  selected={mcSelectedCard === card}
                  onClick={() => handleCardClick(card)}
                  size="md"
                />
              </motion.div>
            );
          })}
        </div>

        <div style={{ width: 'min(100%, 600px)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <ChatInput roomId={mcRoomId} socket={mcSocket} mode="compact" />
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { margin: 0; padding: 0; overflow: hidden; }
      `}</style>
    </div>
  );
}
