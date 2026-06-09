import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMCStore } from '../store/useMCStore';
import MCCard from '../components/MCCard';
import MCPlayerArea from '../components/MCPlayerArea';
import TrumpSelector from '../components/TrumpSelector';
import ChatInput from '../../../components/common/ChatInput';

const SUIT_SYMBOL = { H: '♥', D: '♦', C: '♣', S: '♠' };
const SUIT_NAME = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades' };
const SUIT_COLOR = { H: '#ef4444', D: '#ef4444', C: '#e2e8f0', S: '#e2e8f0' };
const TEAM_COLORS = { A: '#f59e0b', B: '#a78bfa' };

function getCardSuit(c) { return c?.split('_')[0]; }

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

export default function MCGameBoard() {
  const {
    mcGameState: gs, mcRoomId, mcSelectedCard, mcSetSelectedCard,
    mcPlayCard, mcSelectTrump, mcRestartGame,
    mcChatMessages, mcSocket, mcDisconnect, mcSendChat,
  } = useMCStore();

  const { w } = useWindowSize();
  const isMobile = w < 640;

  const [scoreOpen, setScoreOpen] = useState(false);

  if (!gs) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0515', color: '#fff', fontFamily: "'Inter', sans-serif", flexDirection: 'column', gap: 20 }}>
        <div style={{ width: 40, height: 40, border: '3px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#94a3b8', fontWeight: 700 }}>Connecting to game…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const myId = gs.myId;
  const myTeam = gs.myTeam;
  const hand = useMemo(() => {
    const rawHand = gs.hands?.[myId] || [];
    const suitOrder = { 'S': 0, 'H': 1, 'C': 2, 'D': 3 };
    const rankOrder = {
      'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
      '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
    };

    return [...rawHand].sort((a, b) => {
      const [sA, rA] = a.split('_');
      const [sB, rB] = b.split('_');

      // Sort by suit first
      const valA = sA === gs.trumpSuit ? -1 : (suitOrder[sA] ?? 99);
      const valB = sB === gs.trumpSuit ? -1 : (suitOrder[sB] ?? 99);

      if (valA !== valB) return valA - valB;

      // Then sort by rank descending
      const rankA = rankOrder[rA] || 0;
      const rankB = rankOrder[rB] || 0;
      return rankB - rankA;
    });
  }, [gs.hands, myId, gs.trumpSuit]);
  const isHost = Boolean(myId && gs.hostId === myId);
  const players = gs.players || [];

  const myIndex = players.findIndex(p => p.id === myId);
  const getRelative = (offset) => players[(myIndex + offset + 4) % 4] || null;

  const bottomPlayer = players[myIndex];
  const topPlayer = getRelative(2);
  const leftPlayer = getRelative(3);
  const rightPlayer = getRelative(1);

  const trickCardFor = (playerId) => gs.currentTrick?.find(t => t.playerId === playerId)?.card || null;

  const leadSuit = gs.leadSuit;
  const hasLeadSuit = leadSuit && hand.some(c => getCardSuit(c) === leadSuit);
  const isValidSuit = (card) => { if (!leadSuit) return true; if (hasLeadSuit) return getCardSuit(card) === leadSuit; return true; };
  const isPlayable = (card) => { if (gs.state !== 'PLAYING') return false; if (gs.currentTurn !== myId) return false; return isValidSuit(card); };

  const isTrumpSelection = gs.state === 'TRUMP_SELECTION';
  const iAmTrumpSelector = gs.trumpSelecterId === myId;
  const isRoundEnd = gs.state === 'ROUND_END';
  const isGameOver = gs.state === 'GAME_OVER';

  const handleCardClick = (card) => {
    if (!isPlayable(card)) return;
    if (mcSelectedCard === card) mcPlayCard(card);
    else mcSetSelectedCard(card);
  };

  // ── Responsive values ────────────────────────────────────────────────
  const headerH = isMobile ? 48 : 60;
  const handAreaH = isMobile ? 200 : 180;
  // Push top/bottom players fully outside the table oval
  const playerOff = isMobile ? -80 : -75;
  const sideOff = isMobile ? -45 : -75;
  const trickSize = isMobile ? 190 : 220;
  const trickPad = isMobile ? 25 : 35;
  const cardSize = isMobile ? 'xs' : 'md';
  // Fan overlap: squeeze cards together when hand is large
  const cardW = isMobile ? 42 : 68; // matches xs/md dims.w in MCCard
  const maxHandW = isMobile ? w - 16 : w - 280; // available width
  // Use horizontal scroll on mobile with a fixed gap; keep overlap logic for desktop
  const overlapGap = isMobile ? 8 : (hand.length * (cardW + 4) > maxHandW ? -Math.ceil((hand.length * (cardW + 4) - maxHandW) / Math.max(hand.length - 1, 1)) : 4);

  // ── Score Panel (shared between sidebar & mobile drawer) ─────────────
  const TeamBadge = ({ team }) => {
    const t = team;
    const color = TEAM_COLORS[t];
    const data = gs.teams?.[t] || {};

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'rgba(15,10,25,0.7)',
          backdropFilter: 'blur(12px)',
          borderRadius: 14,
          padding: '6px 12px',
          border: `1px solid ${color}44`,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minWidth: 80,
          boxShadow: `0 4px 15px rgba(0,0,0,0.4), inset 0 0 10px ${color}11`
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 900, color, letterSpacing: '0.05em' }}>TEAM {t}</span>
          {/* Coats indicator */}
          <div style={{ display: 'flex', gap: 2 }}>
            {Array.from({ length: 5 }).map((_, ci) => (
              <div key={ci} style={{ width: 4, height: 4, borderRadius: 1, background: ci < (data.coats || 0) ? color : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.5rem', color: '#94a3b8', fontWeight: 700 }}>10s</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#fff' }}>{data.mendis || 0}</span>
          </div>
          <div style={{ height: 10, width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.5rem', color: '#94a3b8', fontWeight: 700 }}>TRK</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#fff' }}>{data.tricks || 0}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  const GameStatusBadge = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        background: 'rgba(15,10,25,0.4)',
        padding: '4px 12px',
        borderRadius: '0 0 12px 12px',
        border: '1px solid rgba(255,255,255,0.05)',
        borderTop: 'none',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: '1.2rem', color: SUIT_COLOR[gs.trumpSuit] || '#64748b', filter: gs.trumpSuit ? 'drop-shadow(0 0 8px currentColor)' : 'none' }}>
          {SUIT_SYMBOL[gs.trumpSuit] || '—'}
        </span>
        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.1em' }}>TRUMP</span>
      </div>
      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b' }}>
        {13 - (gs.trickCount || 0)} LEFT
      </div>
    </motion.div>
  );

  const ScorePanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 20 }}>
      {/* Trump + Tricks Left */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>TRUMP</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: '1.2rem', color: SUIT_COLOR[gs.trumpSuit] || '#64748b' }}>{SUIT_SYMBOL[gs.trumpSuit] || '—'}</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{SUIT_NAME[gs.trumpSuit] || 'None'}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>TRICKS LEFT</span>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', marginTop: 3 }}>{13 - (gs.trickCount || 0)}</div>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Team Cards */}
      {['A', 'B'].map(t => (
        <div key={t} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 900, color: TEAM_COLORS[t] }}>TEAM {t}</span>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, margin: '3px 0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {players.filter((_, i) => i % 2 === (t === 'A' ? 0 : 1)).map(p => p.id === myId ? 'You' : p.name).join(' & ')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '5px 8px', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>10s</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>{gs.teams?.[t]?.mendis || 0}</span>
            </div>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '5px 8px', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>TRICKS</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>{gs.teams?.[t]?.tricks || 0}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 800 }}>COATS</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: 5 }).map((_, ci) => (
                <div key={ci} style={{ width: 12, height: 12, borderRadius: 3, background: ci < (gs.teams?.[t]?.coats || 0) ? TEAM_COLORS[t] : 'rgba(255,255,255,0.08)', border: `1px solid ${ci < (gs.teams?.[t]?.coats || 0) ? TEAM_COLORS[t] : 'rgba(255,255,255,0.05)'}` }} />
              ))}
            </div>
          </div>
        </div>
      ))}

      <div style={{ textAlign: 'center', fontSize: '0.6rem', fontWeight: 800, color: '#64748b' }}>MOST 10s WINS</div>
    </div>
  );

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', background: '#0a0515', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, #1a0a3a 0%, transparent 70%)', opacity: 0.4, pointerEvents: 'none' }} />

      {/* ── HEADER ── */}
      <div style={{ height: headerH, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '0 12px' : '0 24px', zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '0.15em' }}>MENDI COAT</span>
          <span style={{ fontSize: isMobile ? '0.7rem' : '0.85rem', fontWeight: 700, color: '#94a3b8' }}>
            Room <span style={{ color: '#fff' }}>{mcRoomId}</span>
            {gs.trumpSuit && !isMobile && (
              <span style={{ marginLeft: 12 }}>Trump : <span style={{ color: SUIT_COLOR[gs.trumpSuit] }}>{SUIT_SYMBOL[gs.trumpSuit]} {SUIT_NAME[gs.trumpSuit]}</span></span>
            )}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Mobile: score toggle button */}
          {isMobile && (
            <button onClick={() => setScoreOpen(o => !o)} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', padding: '5px 10px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>
              {scoreOpen ? 'Hide' : 'Score'}
            </button>
          )}
          <button onClick={mcDisconnect} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: isMobile ? '5px 10px' : '6px 16px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
            Leave
          </button>
        </div>
      </div>

      {/* ── MOBILE SCORE DRAWER ── */}
      <AnimatePresence>
        {isMobile && scoreOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ background: 'rgba(15,10,25,0.97)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px', zIndex: 90, overflow: 'hidden', flexShrink: 0 }}
          >
            <ScorePanel />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '10px 16px' : '20px 60px 20px 240px', minHeight: 0 }}>

        {/* Desktop Sidebar */}
        {!isMobile && (
          <div style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', width: 240, background: 'rgba(15,10,25,0.85)', backdropFilter: 'blur(12px)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', padding: 20, display: 'flex', flexDirection: 'column', gap: 20, zIndex: 10, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <ScorePanel />
          </div>
        )}

        {/* Mobile Team Badges & Status */}
        {isMobile && (
          <>
            <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 80 }}>
              <TeamBadge team="A" />
            </div>
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 80 }}>
              <GameStatusBadge />
            </div>
            <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 80 }}>
              <TeamBadge team="B" />
            </div>
          </>
        )}

        {/* ── THE TABLE ── */}
        <div style={{ width: isMobile ? '85%' : 'min(100%, 860px)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Table surface */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: isMobile ? '120px' : '200px', background: 'linear-gradient(180deg, #2b1255 0%, #160a2a 100%)', border: `${isMobile ? 5 : 8}px solid #1c0e35`, boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8), 0 30px 100px rgba(0,0,0,0.6)', aspectRatio: isMobile ? '3/2' : '2/1', zIndex: 1 }}>
            <div style={{ position: 'absolute', inset: 12, borderRadius: isMobile ? '108px' : '185px', border: '1px dashed rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.06, textAlign: 'center' }}>
              <span style={{ fontSize: isMobile ? '0.55rem' : '0.8rem', fontWeight: 900, letterSpacing: '0.3em', color: '#fff' }}>MENDI COAT</span>
            </div>
          </div>

          {/* Players */}
          <div style={{ position: 'absolute', top: playerOff, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            {topPlayer && <MCPlayerArea player={topPlayer} team={players.indexOf(topPlayer) % 2 === 0 ? 'A' : 'B'} isMe={false} isCurrentTurn={gs.currentTurn === topPlayer.id} playedCard={trickCardFor(topPlayer.id)} trumpSuit={gs.trumpSuit} position="top" chatMessage={mcChatMessages?.find(m => m.senderId === topPlayer.id)?.message} isHost={topPlayer.id === gs.hostId} compact={isMobile} />}
          </div>
          <div style={{ position: 'absolute', bottom: playerOff, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            {bottomPlayer && <MCPlayerArea player={bottomPlayer} team={myTeam} isMe={true} isCurrentTurn={gs.currentTurn === myId} playedCard={null} trumpSuit={gs.trumpSuit} position="bottom" chatMessage={mcChatMessages?.find(m => m.senderId === myId)?.message} isHost={bottomPlayer.id === gs.hostId} compact={isMobile} />}
          </div>
          <div style={{ position: 'absolute', left: sideOff, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
            {leftPlayer && <MCPlayerArea player={leftPlayer} team={players.indexOf(leftPlayer) % 2 === 0 ? 'A' : 'B'} isMe={false} isCurrentTurn={gs.currentTurn === leftPlayer.id} playedCard={trickCardFor(leftPlayer.id)} trumpSuit={gs.trumpSuit} position="left" chatMessage={mcChatMessages?.find(m => m.senderId === leftPlayer.id)?.message} isHost={leftPlayer.id === gs.hostId} compact={isMobile} />}
          </div>
          <div style={{ position: 'absolute', right: sideOff, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
            {rightPlayer && <MCPlayerArea player={rightPlayer} team={players.indexOf(rightPlayer) % 2 === 0 ? 'A' : 'B'} isMe={false} isCurrentTurn={gs.currentTurn === rightPlayer.id} playedCard={trickCardFor(rightPlayer.id)} trumpSuit={gs.trumpSuit} position="right" chatMessage={mcChatMessages?.find(m => m.senderId === rightPlayer.id)?.message} isHost={rightPlayer.id === gs.hostId} compact={isMobile} />}
          </div>

          {/* Trick center */}
          <div style={{ position: 'relative', width: trickSize, height: trickSize, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AnimatePresence>
              {[
                { id: topPlayer?.id, pos: { top: trickPad, left: '50%', x: '-50%' } },
                { id: bottomPlayer?.id, pos: { bottom: trickPad, left: '50%', x: '-50%' } },
                { id: leftPlayer?.id, pos: { left: trickPad, top: '50%', y: '-50%' } },
                { id: rightPlayer?.id, pos: { right: trickPad, top: '50%', y: '-50%' } },
              ].map(({ id, pos }) => {
                const card = trickCardFor(id);
                if (!card) return null;
                return (
                  <motion.div key={`${id}-${card}`} initial={{ scale: 0.5, opacity: 0, ...pos }} animate={{ scale: 1, opacity: 1, ...pos }} exit={{ scale: 0.5, opacity: 0 }} style={{ position: 'absolute', zIndex: 20 }}>
                    <MCCard cardId={card} trumpSuit={gs.trumpSuit} size="sm" />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Trump Selection */}
          <AnimatePresence>
            {isTrumpSelection && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, zIndex: 50, borderRadius: isMobile ? '120px' : '200px', background: 'rgba(10,5,20,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrumpSelector onSelect={mcSelectTrump} disabled={!iAmTrumpSelector} selectorName={players.find(p => p.id === gs.trumpSelecterId)?.name} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── ROUND / GAME OVER OVERLAY ── */}
      <AnimatePresence>
        {(isRoundEnd || isGameOver) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(5,2,12,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 12 : 20 }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} style={{ width: 'min(100%, 520px)', background: 'rgba(20,15,35,0.98)', borderRadius: isMobile ? 24 : 40, border: '1px solid rgba(255,255,255,0.1)', padding: isMobile ? '28px 20px' : '50px 40px', textAlign: 'center', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', overflowY: 'auto', maxHeight: '90vh' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 12, display: 'block' }}>{isGameOver ? 'Match Result' : 'Round Result'}</span>
              <h2 style={{
                fontSize: isMobile ? '2.2rem' : '3.5rem',
                fontWeight: 900,
                margin: '0 0 8px',
                backgroundImage: 'linear-gradient(to bottom, #fff, #94a3b8)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent'
              }}>
                Team {isGameOver ? gs.matchWinner : gs.roundWinner}
              </h2>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: '#f59e0b', marginBottom: isMobile ? 20 : 40 }}>VICTORY</p>

              <div style={{ display: 'flex', gap: 12, marginBottom: isMobile ? 20 : 50 }}>
                {['A', 'B'].map(t => {
                  const winner = isGameOver ? gs.matchWinner : gs.roundWinner;
                  return (
                    <div key={t} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 18, padding: isMobile ? '16px 10px' : '24px 16px', border: `1px solid ${winner === t ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`, boxShadow: winner === t ? '0 10px 30px rgba(245,158,11,0.15)' : 'none' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: TEAM_COLORS[t], display: 'block', marginBottom: 6 }}>TEAM {t}</span>
                      <div style={{ fontSize: '0.55rem', color: '#94a3b8', marginBottom: 10, fontWeight: 600 }}>{players.filter((_, i) => i % 2 === (t === 'A' ? 0 : 1)).map(p => p.id === myId ? 'You' : p.name).join(' & ')}</div>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <div><div style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 900 }}>{gs.teams?.[t]?.mendis || 0}</div><span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>🔟 10s</span></div>
                        <div><div style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 900 }}>{gs.teams?.[t]?.tricks || 0}</div><span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>🃏 TRICKS</span></div>
                        <div><div style={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 900 }}>{gs.teams?.[t]?.coats || 0}</div><span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>🏆 COATS</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {isHost && (
                  <button onClick={mcRestartGame} style={{ width: '100%', background: '#f59e0b', color: '#000', border: 'none', padding: isMobile ? '14px' : '18px', borderRadius: 14, fontWeight: 900, cursor: 'pointer', fontSize: isMobile ? '0.9rem' : '1.1rem' }}>
                    {isGameOver ? 'START NEW MATCH' : 'CONTINUE TO NEXT ROUND'}
                  </button>
                )}
                <button onClick={() => { mcDisconnect(); window.location.href = '/'; }} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: isMobile ? '12px' : '16px', borderRadius: 14, fontWeight: 800, cursor: 'pointer', fontSize: isMobile ? '0.85rem' : '1rem' }}>
                  CLOSE & BACK TO HOME
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HAND AREA ── */}
      <div style={{ height: handAreaH, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobile ? '0 6px 1px' : '0 24px 20px', zIndex: 100, gap: isMobile ? 6 : 15, flexShrink: 0 }}>
        {/* Fan layout — negative marginRight overlaps cards to always fit without scroll on desktop; horizontal scroll on mobile */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: isMobile ? 'flex-start' : 'center',
            width: '100%',
            paddingTop: 50,
            paddingBottom: 25,
            overflowX: isMobile ? 'auto' : 'visible',
            paddingLeft: isMobile ? 12 : 0,
            paddingRight: isMobile ? 12 : 0,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          className="no-scrollbar"
        >
          {hand.map((card, idx) => {
            const playable = isPlayable(card);
            const isLast = idx === hand.length - 1;
            return (
              <motion.div
                key={card}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: mcSelectedCard === card ? -5 : 0, opacity: 1 }}
                transition={{ delay: idx * 0.03 }}
                style={{
                  marginRight: isLast ? 0 : overlapGap,
                  zIndex: mcSelectedCard === card ? 50 : idx,
                  position: 'relative',
                  flexShrink: 0
                }}
              >
                <MCCard cardId={card} trumpSuit={gs.trumpSuit} disabled={!playable && gs.currentTurn === myId} selected={mcSelectedCard === card} onClick={() => handleCardClick(card)} size={cardSize} />
              </motion.div>
            );
          })}
        </div>

      </div>
      
      {/* Floating Chat Bubble */}
      <div style={{ position: 'fixed', bottom: isMobile ? 12 : 24, right: isMobile ? 12 : 24, zIndex: 1000 }}>
        <ChatInput mode="compact" onSend={mcSendChat} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { margin: 0; padding: 0; overflow: hidden; }
        * { box-sizing: border-box; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
