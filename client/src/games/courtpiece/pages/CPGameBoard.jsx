import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCPStore } from '../store/useCPStore';
import CPCard from '../components/CPCard';
import CPPlayerArea from '../components/CPPlayerArea';
import TrumpSelector from '../components/TrumpSelector';
import ScoreBoard from '../components/ScoreBoard';
import ChatInput from '../../../components/common/ChatInput';
import AvatarDisplay from '../../../components/common/AvatarDisplay';
import { toast } from '../../../components/common/Toast';

const SUIT_SYMBOL = { H: '♥', D: '♦', C: '♣', S: '♠' };
const SUIT_NAME   = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades' };

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

  const positions = [
    { player: bottomPlayer, pos: 'bottom' },
    { player: topPlayer,    pos: 'top'    },
    { player: leftPlayer,   pos: 'left'   },
    { player: rightPlayer,  pos: 'right'  },
  ];

  // Find played card for a player in the current trick
  const trickCardFor = (playerId) =>
    gs.currentTrick?.find(t => t.playerId === playerId)?.card || null;

  // Must-follow-suit check: gray out only rule-restricted cards
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

  // Trump selector visibility
  const isTrumpReveal    = gs.state === 'TRUMP_REVEAL';
  const isTrumpSelection = gs.state === 'TRUMP_SELECTION';
  const iAmTrumpSelector = gs.trumpSelecterId === myId;
  const showTrumpOverlay = isTrumpReveal || isTrumpSelection;

  // Round end
  const isRoundEnd = gs.state === 'ROUND_END';
  const isGameOver = gs.state === 'GAME_OVER';

  // Team name helpers
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
      background: 'radial-gradient(ellipse at 50% 0%, #1a0a30 0%, #0c0816 55%, #04020d 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
    }}>

      {/* ── TOP BAR ───────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <div>
          <p style={{ margin:0, fontSize:'0.6rem', fontWeight:800, letterSpacing:'0.14em', color:'#fb923c' }}>COURT PIECE</p>
          <p style={{ margin:0, fontSize:'0.78rem', fontWeight:700, color:'#6b7280' }}>
            Room <span style={{ color:'#e2e8f0', fontFamily:'monospace' }}>{cpRoomId}</span>
            {gs.trumpSuit && <span style={{ marginLeft:8 }}>· Trump: {SUIT_SYMBOL[gs.trumpSuit]} {SUIT_NAME[gs.trumpSuit]}</span>}
          </p>
        </div>

        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {/* Turn indicator */}
          {gs.state === 'PLAYING' && (
            <div style={{ padding:'5px 12px', borderRadius:10, background: gs.currentTurn === myId ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.05)', border:`1px solid ${gs.currentTurn === myId ? 'rgba(251,146,60,0.4)' : 'rgba(255,255,255,0.08)'}`, fontSize:'0.72rem', fontWeight:800, color: gs.currentTurn === myId ? '#fb923c' : '#6b7280' }}>
              {gs.currentTurn === myId ? '🃏 Your Turn' : `${players.find(p => p.id === gs.currentTurn)?.name || '...'}'s turn`}
            </div>
          )}

          {isHost && (
            <button onClick={cpCloseGame}
              style={{ padding:'7px 12px', borderRadius:10, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontSize:'0.72rem', fontWeight:700, cursor:'pointer' }}>
              Close
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN TABLE AREA ───────────────────────────────────────────── */}
      <div style={{ flex:1, display:'grid', gridTemplateRows:'auto 1fr auto', gridTemplateColumns:'auto 1fr auto', gap:8, padding:'12px 16px', overflow:'hidden', position:'relative' }}>

        {/* Top player (partner) */}
        <div style={{ gridColumn:'1/4', display:'flex', justifyContent:'center', alignItems:'flex-start', paddingTop:4 }}>
          {topPlayer && (
            <CPPlayerArea
              player={topPlayer}
              team={players.findIndex(p => p.id === topPlayer?.id) % 2 === 0 ? 'A' : 'B'}
              isMe={false}
              isCurrentTurn={gs.currentTurn === topPlayer?.id}
              playedCard={trickCardFor(topPlayer?.id)}
              trumpSuit={gs.trumpSuit}
              position="top"
              chatMessage={cpChatMessages?.find(m => m.senderId === topPlayer?.id)?.message}
              isHost={topPlayer?.id === gs.hostId}
            />
          )}
        </div>

        {/* Left player */}
        <div style={{ display:'flex', alignItems:'center', paddingLeft:4 }}>
          {leftPlayer && (
            <CPPlayerArea
              player={leftPlayer}
              team={players.findIndex(p => p.id === leftPlayer?.id) % 2 === 0 ? 'A' : 'B'}
              isMe={false}
              isCurrentTurn={gs.currentTurn === leftPlayer?.id}
              playedCard={trickCardFor(leftPlayer?.id)}
              trumpSuit={gs.trumpSuit}
              position="left"
              chatMessage={cpChatMessages?.find(m => m.senderId === leftPlayer?.id)?.message}
              isHost={leftPlayer?.id === gs.hostId}
            />
          )}
        </div>

        {/* CENTER TABLE — trick + trump reveal overlay */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, position:'relative' }}>

          {/* Trump/Reveal overlay */}
          <AnimatePresence>
            {showTrumpOverlay && (
              <motion.div
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, borderRadius:16, zIndex:20, backdropFilter:'blur(8px)', padding:16 }}
              >
                {/* Show reveal cards */}
                {isTrumpReveal && (
                  <motion.div initial={{ scale:0.8 }} animate={{ scale:1 }} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
                    <p style={{ margin:0, fontSize:'0.68rem', fontWeight:800, letterSpacing:'0.14em', color:'#fb923c' }}>TRUMP REVEAL</p>
                    <p style={{ margin:0, fontSize:'0.85rem', color:'#9ca3af', textAlign:'center' }}>
                      {players[0]?.name} vs {players[1]?.name}
                    </p>
                    <div style={{ display:'flex', gap:24, alignItems:'flex-end' }}>
                      {[0, 1].map(idx => {
                        const p = players[idx];
                        if (!p) return null;
                        const revealCard = gs.revealCards?.[p.id];
                        return (
                          <div key={p.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                            <AvatarDisplay avatarId={p.avatar} playerName={p.name} size={32} animated={false} />
                            <CPCard cardId={revealCard} trumpSuit={null} size="md" />
                            {gs.trumpSelecterId === p.id && (
                              <span style={{ fontSize:'0.65rem', fontWeight:800, color:'#fb923c' }}>👑 Picks Trump</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p style={{ margin:0, fontSize:'0.75rem', color:'#6b7280' }}>Selecting trump suit in a moment...</p>
                  </motion.div>
                )}

                {isTrumpSelection && (
                  <TrumpSelector
                    onSelect={cpSelectTrump}
                    disabled={!iAmTrumpSelector}
                    selectorName={players.find(p => p.id === gs.trumpSelecterId)?.name || '...'}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Round / Game over overlay */}
          <AnimatePresence>
            {(isRoundEnd || isGameOver) && (
              <motion.div
                initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
                style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.82)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, borderRadius:16, zIndex:20, backdropFilter:'blur(10px)', padding:20 }}
              >
                <p style={{ margin:0, fontSize:'0.7rem', fontWeight:800, letterSpacing:'0.14em', color: isGameOver ? '#f59e0b' : '#fb923c' }}>
                  {isGameOver ? '🏆 MATCH OVER' : '🃏 ROUND OVER'}
                </p>
                <h2 style={{ margin:0, fontSize:'1.6rem', fontWeight:900, color:'#fff', textAlign:'center' }}>
                  {isGameOver
                    ? `Team ${gs.matchWinner} Wins the Match!`
                    : `Team ${gs.roundWinner} wins this round`}
                </h2>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, width:'100%', maxWidth:280 }}>
                  {['A','B'].map(t => (
                    <div key={t} style={{ padding:'12px', borderRadius:14, background: gs.roundWinner===t || gs.matchWinner===t ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.04)', border:`1px solid ${gs.roundWinner===t || gs.matchWinner===t ? 'rgba(251,146,60,0.4)' : 'rgba(255,255,255,0.06)'}`, textAlign:'center' }}>
                      <p style={{ margin:'0 0 4px', fontSize:'0.65rem', fontWeight:800, color: TEAM_COLORS[t] }}>TEAM {t}</p>
                      <p style={{ margin:0, fontSize:'1.1rem', fontWeight:900, color:'#fff' }}>{gs.teams?.[t]?.tricks || 0} tricks</p>
                      <p style={{ margin:0, fontSize:'0.7rem', color:'#6b7280' }}>{gs.teams?.[t]?.coats || 0} coats</p>
                    </div>
                  ))}
                </div>
                {isHost && (
                  <div style={{ display:'flex', gap:10 }}>
                    {!isGameOver && (
                      <motion.button whileHover={{ scale:1.03 }} onClick={cpRestartGame}
                        style={{ padding:'12px 24px', borderRadius:14, background:'linear-gradient(135deg,#c2410c,#9a3412)', border:'none', color:'#fff', fontWeight:800, cursor:'pointer', fontSize:'0.9rem' }}>
                        Next Round
                      </motion.button>
                    )}
                    <motion.button whileHover={{ scale:1.03 }} onClick={cpRestartGame}
                      style={{ padding:'12px 24px', borderRadius:14, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#e2e8f0', fontWeight:800, cursor:'pointer', fontSize:'0.9rem' }}>
                      New Match
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>


          {/* Center trick cards */}
          <div style={{ display:'grid', gridTemplateAreas:'"tl tc tr" "ml mc mr" "bl bc br"', width:170, height:170, position:'relative' }}>
            {/* Cards in compass positions */}
            {[
              { pos: topPlayer,   area: 'tc', top:'0',   left:'50%', transform:'translateX(-50%)', initial: { y: -200, x: '-50%', opacity: 0 }, animate: { y: 0, x: '-50%', opacity: 1 } },
              { pos: leftPlayer,  area: 'ml', top:'50%', left:'0',   transform:'translateY(-50%)', initial: { x: -200, y: '-50%', opacity: 0 }, animate: { x: 0, y: '-50%', opacity: 1 } },
              { pos: rightPlayer, area: 'mr', top:'50%', right:'0',  transform:'translateY(-50%)', initial: { x: 200, y: '-50%', opacity: 0 }, animate: { x: 0, y: '-50%', opacity: 1 } },
              { pos: bottomPlayer,area: 'bc', bottom:'0',left:'50%', transform:'translateX(-50%)', initial: { y: 200, x: '-50%', opacity: 0 }, animate: { y: 0, x: '-50%', opacity: 1 } },
            ].map(({ pos, top, left, right, bottom, initial, animate }) => {
              if (!pos) return null;
              const card = trickCardFor(pos.id);
              if (!card) return null;
              return (
                <motion.div 
                  key={`${pos.id}-${card}`}
                  initial={initial}
                  animate={animate}
                  transition={{ type: 'spring', stiffness: 250, damping: 25 }}
                  style={{ position:'absolute', top, left, right, bottom }}
                >
                  <CPCard cardId={card} trumpSuit={gs.trumpSuit} size="sm" />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right player */}
        <div style={{ display:'flex', alignItems:'center', paddingRight:4 }}>
          {rightPlayer && (
            <CPPlayerArea
              player={rightPlayer}
              team={players.findIndex(p => p.id === rightPlayer?.id) % 2 === 0 ? 'A' : 'B'}
              isMe={false}
              isCurrentTurn={gs.currentTurn === rightPlayer?.id}
              playedCard={trickCardFor(rightPlayer?.id)}
              trumpSuit={gs.trumpSuit}
              position="right"
              chatMessage={cpChatMessages?.find(m => m.senderId === rightPlayer?.id)?.message}
              isHost={rightPlayer?.id === gs.hostId}
            />
          )}
        </div>

        {/* Bottom - My info + chat */}
        <div style={{ gridColumn:'1/4', display:'flex', justifyContent:'center', gap:16, alignItems:'flex-end', paddingBottom:4 }}>
          {bottomPlayer && (
            <CPPlayerArea
              player={bottomPlayer}
              team={myTeam}
              isMe={true}
              isCurrentTurn={gs.currentTurn === myId}
              playedCard={null}
              trumpSuit={gs.trumpSuit}
              position="bottom"
              chatMessage={cpChatMessages?.find(m => m.senderId === myId)?.message}
              isHost={bottomPlayer?.id === gs.hostId}
            />
          )}
        </div>

        {/* Absolutely positioned ScoreBoard at bottom left */}
        <div style={{ position:'absolute', bottom: 16, left: 16, zIndex: 10 }}>
          <ScoreBoard
            teams={gs.teams}
            teamANames={teamA.map(p => p.name)}
            teamBNames={teamB.map(p => p.name)}
            trumpSuit={gs.trumpSuit}
            targetCoats={gs.targetCoats}
            trickCount={gs.trickCount}
          />
        </div>
      </div>

      {/* ── MY HAND ───────────────────────────────────────────────────── */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'12px 16px 20px', flexShrink:0 }}>
        {/* Lead suit notice */}
        {leadSuit && gs.currentTurn === myId && (
          <p style={{ margin:'0 0 8px', textAlign:'center', fontSize:'0.72rem', fontWeight:800, color:'#fb923c', letterSpacing:'0.1em' }}>
            Lead suit: {SUIT_SYMBOL[leadSuit]} — {hasLeadSuit ? 'You must follow suit' : 'You may play any card'}
          </p>
        )}

        {/* Play hint */}
        {gs.currentTurn === myId && gs.state === 'PLAYING' && !trickCardFor(myId) && (
          <p style={{ margin:'0 0 8px', textAlign:'center', fontSize:'0.72rem', color:'#6b7280' }}>
            {cpSelectedCard ? 'Tap the same card again to play it' : 'Tap a card to select, tap again to play'}
          </p>
        )}

        <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', maxWidth:'100%', overflowX:'auto' }}>
          {hand.map(card => {
            const playable = isPlayable(card);
            const ruleRestricted = gs.state === 'PLAYING' && gs.currentTurn === myId && !isValidSuit(card);
            return (
              <CPCard
                key={card}
                cardId={card}
                trumpSuit={gs.trumpSuit}
                disabled={ruleRestricted}
                selected={cpSelectedCard === card}
                onClick={playable ? () => handleCardClick(card) : undefined}
                size="md"
              />
            );
          })}
          {hand.length === 0 && gs.state === 'PLAYING' && (
            <p style={{ color:'#374151', fontSize:'0.85rem', fontWeight:600 }}>No cards in hand</p>
          )}
        </div>

        {/* Chat */}
        <div style={{ marginTop:10, display:'flex', justifyContent:'center' }}>
          <ChatInput roomId={cpRoomId} socket={cpSocket} mode="compact" />
        </div>
      </div>
    </div>
  );
}

// Color map needed inside this file
const TEAM_COLORS = { A: '#f59e0b', B: '#a78bfa' };
