import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCPStore } from '../store/useCPStore';
import CPCard from '../components/CPCard';
import CPPlayerArea from '../components/CPPlayerArea';
import TrumpSelector from '../components/TrumpSelector';
import ChatInput from '../../../components/common/ChatInput';
import AvatarDisplay from '../../../components/common/AvatarDisplay';
import { toast } from '../../../components/common/Toast';

const SUIT_SYMBOL = { H: '♥', D: '♦', C: '♣', S: '♠' };
const SUIT_NAME   = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades' };
const SUIT_COLOR  = { H: '#ef4444', D: '#ef4444', C: '#1e293b', S: '#1e293b' };
const TEAM_COLORS = { A: '#f59e0b', B: '#a78bfa' };

function getCardSuit(c) { return c?.split('_')[0]; }

export default function CPGameBoard() {
  const {
    cpGameState: gs,
    cpRoomId,
    cpSelectedCard,
    cpSetSelectedCard,
    cpPlayCard,
    cpSelectTrump,
    cpCloseGame,
    cpRestartGame,
    cpSendChat,
    cpChatMessages,
    cpSocket,
    cpDisconnect,
  } = useCPStore();

  if (!gs) return null;

  const myId   = gs.myId;
  const myTeam = gs.myTeam;
  const hand   = gs.hands?.[myId] || [];
  const isHost = Boolean(myId && gs.hostId === myId);
  const players = gs.players || [];

  // Find players by position relative to me
  const myIndex = players.findIndex(p => p.id === myId);
  const getRelative = (offset) => players[(myIndex + offset + 4) % 4] || null;

  const bottomPlayer = players[myIndex];         // me
  const topPlayer    = getRelative(2);           // partner (opposite)
  const leftPlayer   = getRelative(3);           // opponent
  const rightPlayer  = getRelative(1);           // opponent

  const trickCardFor = (playerId) =>
    gs.currentTrick?.find(t => t.playerId === playerId)?.card || null;

  const leadSuit = gs.leadSuit;
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

  const isTrumpReveal    = gs.state === 'TRUMP_REVEAL';
  const isTrumpSelection = gs.state === 'TRUMP_SELECTION';
  const iAmTrumpSelector = gs.trumpSelecterId === myId;
  const showTrumpOverlay = isTrumpReveal || isTrumpSelection;

  const isRoundEnd = gs.state === 'ROUND_END';
  const isGameOver = gs.state === 'GAME_OVER';

  const teamA = players.filter((_, i) => i % 2 === 0);
  const teamB = players.filter((_, i) => i % 2 !== 0);

  const handleCardClick = (card) => {
    if (!isPlayable(card)) return;
    if (cpSelectedCard === card) {
      cpPlayCard(card);
    } else {
      cpSetSelectedCard(card);
    }
  };

  return (
    <div style={{
      height: '100vh', width: '100vw', overflow: 'hidden',
      background: '#0a0515',
      color: '#fff',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
    }}>
      {/* Background Gradients */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, #1a0a3a 0%, transparent 70%)', opacity: 0.4, pointerEvents: 'none' }} />

      {/* ── TOP HEADER ────────────────────────────────────────────────── */}
      <div style={{ 
        height: 60, display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '0 24px', zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)' 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '0.15em' }}>COURT PIECE</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8' }}>
            Room <span style={{ color: '#fff', opacity: 0.9 }}>{cpRoomId}</span>
            {gs.trumpSuit && <span style={{ marginLeft: 12 }}>Trump : <span style={{ color: SUIT_COLOR[gs.trumpSuit] }}>{SUIT_SYMBOL[gs.trumpSuit]} {SUIT_NAME[gs.trumpSuit]}</span></span>}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={cpDisconnect} style={{ 
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', 
            color: '#f87171', padding: '6px 16px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' 
          }}>
            Leave Game
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem', cursor: 'pointer' }}>
                {i === 1 ? '⚙️' : i === 2 ? '?' : '💬'}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <div style={{ 
        flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', 
        padding: '20px 60px 20px 240px' // Increased left padding to shift table right
      }}>
        
        {/* Sidebar Statistics */}
        <div style={{ 
          position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)',
          width: 180, background: 'rgba(15,10,25,0.85)', backdropFilter: 'blur(12px)',
          borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 20, zIndex: 10,
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
        }}>
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>TRUMP ({SUIT_NAME[gs.trumpSuit]?.toUpperCase()})</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: '1.5rem', color: SUIT_COLOR[gs.trumpSuit] }}>{SUIT_SYMBOL[gs.trumpSuit]}</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{SUIT_NAME[gs.trumpSuit]}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>TRICKS LEFT</span>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff' }}>{13 - (gs.trickCount || 0)}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['A', 'B'].map(t => (
              <div key={t}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: TEAM_COLORS[t] }}>TEAM {t}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: '0.6rem', color: '#64748b' }}>Tricks</span>
                    <span style={{ fontSize: '0.6rem', color: '#64748b' }}>Cards</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: 6 }}>
                  {players.filter((_, i) => i % 2 === (t === 'A' ? 0 : 1)).map(p => p.id === myId ? 'You' : p.name).join(' & ')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900 }}>{gs.teams?.[t]?.tricks || 0}/5</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900 }}>{players.filter((_, i) => i % 2 === (t === 'A' ? 0 : 1)).reduce((acc, p) => acc + (p.cardCount || 0), 0)}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', pt: 12, textAlign: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>
            FIRST TO 5 TRICKS WINS
          </div>
        </div>

        {/* ── THE TABLE ────────────────────────────────────────────────── */}
        <div style={{ 
          width: 'min(100%, 860px)', aspectAspectRatio: '2 / 1', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {/* Elliptical Table Shape */}
          <div style={{ 
            position: 'absolute', inset: 0, borderRadius: '200px', 
            background: 'linear-gradient(180deg, #2b1255 0%, #160a2a 100%)',
            border: '8px solid #1c0e35',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8), 0 30px 100px rgba(0,0,0,0.6)',
            zIndex: 1
          }}>
            {/* Inner Border Line */}
            <div style={{ position: 'absolute', inset: 15, borderRadius: '185px', border: '1px dashed rgba(255,255,255,0.1)' }} />
            
            {/* Logo in Center */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.1, textAlign: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.3em', color: '#fff' }}>COURT PIECE</span>
            </div>
          </div>

          {/* Player Positions */}
          <div style={{ position: 'absolute', top: -85, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            {topPlayer && <CPPlayerArea player={topPlayer} team={players.indexOf(topPlayer)%2===0?'A':'B'} isMe={false} isCurrentTurn={gs.currentTurn===topPlayer.id} playedCard={trickCardFor(topPlayer.id)} trumpSuit={gs.trumpSuit} position="top" chatMessage={cpChatMessages?.find(m=>m.senderId===topPlayer.id)?.message} isHost={topPlayer.id===gs.hostId} />}
          </div>
          <div style={{ position: 'absolute', bottom: -85, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            {bottomPlayer && <CPPlayerArea player={bottomPlayer} team={myTeam} isMe={true} isCurrentTurn={gs.currentTurn===myId} playedCard={null} trumpSuit={gs.trumpSuit} position="bottom" chatMessage={cpChatMessages?.find(m=>m.senderId===myId)?.message} isHost={bottomPlayer.id===gs.hostId} />}
          </div>
          <div style={{ position: 'absolute', left: -75, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
            {leftPlayer && <CPPlayerArea player={leftPlayer} team={players.indexOf(leftPlayer)%2===0?'A':'B'} isMe={false} isCurrentTurn={gs.currentTurn===leftPlayer.id} playedCard={trickCardFor(leftPlayer.id)} trumpSuit={gs.trumpSuit} position="left" chatMessage={cpChatMessages?.find(m=>m.senderId===leftPlayer.id)?.message} isHost={leftPlayer.id===gs.hostId} />}
          </div>
          <div style={{ position: 'absolute', right: -75, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
            {rightPlayer && <CPPlayerArea player={rightPlayer} team={players.indexOf(rightPlayer)%2===0?'A':'B'} isMe={false} isCurrentTurn={gs.currentTurn===rightPlayer.id} playedCard={trickCardFor(rightPlayer.id)} trumpSuit={gs.trumpSuit} position="right" chatMessage={cpChatMessages?.find(m=>m.senderId===rightPlayer.id)?.message} isHost={rightPlayer.id===gs.hostId} />}
          </div>

          {/* Trick Cards in Center */}
          <div style={{ position: 'relative', width: 220, height: 220, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AnimatePresence>
              {[
                { id: topPlayer?.id,    pos: { top: 35, left: '50%', x: '-50%' } },
                { id: bottomPlayer?.id, pos: { bottom: 35, left: '50%', x: '-50%' } },
                { id: leftPlayer?.id,   pos: { left: 35, top: '50%', y: '-50%' } },
                { id: rightPlayer?.id,  pos: { right: 35, top: '50%', y: '-50%' } },
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
                    <CPCard cardId={card} trumpSuit={gs.trumpSuit} size="sm" />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Overlays (Trump Selection, Round End, etc.) */}
          <AnimatePresence>
            {showTrumpOverlay && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', inset: 0, zIndex: 50, borderRadius: '200px', background: 'rgba(10,5,20,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {isTrumpReveal && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '0.2em', marginBottom: 20 }}>TRUMP REVEAL</p>
                    <div style={{ display: 'flex', gap: 40 }}>
                      {[0, 1].map(idx => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                          <AvatarDisplay avatarId={players[idx]?.avatar} playerName={players[idx]?.name} size={48} />
                          <CPCard cardId={gs.revealCards?.[players[idx]?.id]} size="md" />
                          {gs.trumpSelecterId === players[idx]?.id && <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b' }}>👑 SELECTOR</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {isTrumpSelection && (
                  <TrumpSelector onSelect={cpSelectTrump} disabled={!iAmTrumpSelector} selectorName={players.find(p=>p.id===gs.trumpSelecterId)?.name} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── FULL SCREEN ROUND/GAME OVER OVERLAY ───────────────────────── */}
      <AnimatePresence>
        {(isRoundEnd || isGameOver) && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ 
              position: 'fixed', inset: 0, zIndex: 1000, 
              background: 'rgba(5, 2, 12, 0.75)', backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              style={{
                width: 'min(100%, 540px)', background: 'rgba(20, 15, 35, 0.95)',
                borderRadius: 40, border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '50px 40px', textAlign: 'center',
                boxShadow: '0 40px 100px rgba(0,0,0,0.8), inset 0 0 40px rgba(245,158,11,0.05)'
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                {isGameOver ? 'Match Result' : 'Round Result'}
              </span>
              
              <h2 style={{ fontSize: '3.5rem', fontWeight: 900, margin: '0 0 10px', background: 'linear-gradient(to bottom, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Team {isGameOver ? gs.matchWinner : gs.roundWinner}
              </h2>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f59e0b', marginBottom: 40 }}>VICTORY</p>

              <div style={{ display: 'flex', gap: 20, marginBottom: 50 }}>
                {['A', 'B'].map(t => (
                  <div key={t} style={{ 
                    flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: '24px 16px', 
                    border: `1px solid ${(isGameOver ? gs.matchWinner : gs.roundWinner) === t ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: (isGameOver ? gs.matchWinner : gs.roundWinner) === t ? '0 10px 30px rgba(245,158,11,0.15)' : 'none'
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: TEAM_COLORS[t], display: 'block', marginBottom: 8 }}>TEAM {t}</span>
                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: 12, fontWeight: 600 }}>
                      {players.filter((_, i) => i % 2 === (t === 'A' ? 0 : 1)).map(p => p.id === myId ? 'You' : p.name).join(' & ')}
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900 }}>{gs.teams?.[t]?.tricks}</div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>TRICKS WON</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {isHost && (
                  <button 
                    onClick={cpRestartGame}
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
                  onClick={() => {
                    cpDisconnect();
                    window.location.href = '/';
                  }}
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

      {/* ── BOTTOM HAND AREA ──────────────────────────────────────────── */}
      <div style={{ 
        height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', 
        padding: '0 24px 20px', zIndex: 100, gap: 15
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {hand.map((card, idx) => {
            const playable = isPlayable(card);
            return (
              <motion.div
                key={card}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <CPCard
                  cardId={card}
                  trumpSuit={gs.trumpSuit}
                  disabled={!playable && gs.currentTurn === myId}
                  selected={cpSelectedCard === card}
                  onClick={() => handleCardClick(card)}
                  size="md"
                />
              </motion.div>
            );
          })}
        </div>

        <div style={{ width: 'min(100%, 600px)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <ChatInput roomId={cpRoomId} socket={cpSocket} mode="compact" />
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
             <span style={{ transform: 'rotate(180deg)' }}>▲</span>
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

