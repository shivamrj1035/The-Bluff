import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useJKStore } from '../store/useJKStore';
import JKCard from '../components/JKCard';
import JKPlayerArea from '../components/JKPlayerArea';
import ChatInput from '../../../components/common/ChatInput';
import AvatarDisplay from '../../../components/common/AvatarDisplay';
import { toast } from '../../../components/common/Toast';

const SUIT_SYMBOL = { H: '♥', D: '♦', C: '♣', S: '♠' };
const SUIT_NAME = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades' };
const SUIT_COLOR = { H: '#ef4444', D: '#ef4444', C: '#22d3ee', S: '#a78bfa' };

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

const seatLayouts = {
  2: [
    { top: '-60px', left: '50%', transform: 'translateX(-50%)', label: 'Top' }
  ],
  3: [
    { top: '10%', left: '15%', transform: 'translate(-50%, -50%)', label: 'Left' },
    { top: '10%', right: '15%', transform: 'translate(50%, -50%)', label: 'Right' }
  ],
  4: [
    { top: '50%', left: '-60px', transform: 'translateY(-50%)', label: 'Left' },
    { top: '-60px', left: '50%', transform: 'translateX(-50%)', label: 'Top' },
    { top: '50%', right: '-60px', transform: 'translateY(-50%)', label: 'Right' }
  ],
  5: [
    { top: '55%', left: '-50px', transform: 'translateY(-50%)', label: 'Left' },
    { top: '-30px', left: '25%', transform: 'translateX(-50%)', label: 'Top Left' },
    { top: '-30px', right: '25%', transform: 'translateX(50%)', label: 'Top Right' },
    { top: '55%', right: '-50px', transform: 'translateY(-50%)', label: 'Right' }
  ],
  6: [
    { top: '60%', left: '-50px', transform: 'translateY(-50%)', label: 'Left' },
    { top: '5%', left: '15%', transform: 'translate(-50%, -50%)', label: 'Top Left' },
    { top: '-60px', left: '50%', transform: 'translateX(-50%)', label: 'Top' },
    { top: '5%', right: '15%', transform: 'translate(50%, -50%)', label: 'Top Right' },
    { top: '60%', right: '-50px', transform: 'translateY(-50%)', label: 'Right' }
  ]
};

export default function JKGameBoard() {
  const {
    jkGameState: gs,
    jkRoomId,
    jkPickCard,
    jkDiscardPair,
    jkRestartGame,
    jkChatMessages,
    jkSocket,
    jkLeaveRoom,
  } = useJKStore();

  const { w } = useWindowSize();
  const isMobile = w < 640;

  const [scoreOpen, setScoreOpen] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const [discardAnims, setDiscardAnims] = useState([]);
  const [drawnCardOverlay, setDrawnCardOverlay] = useState(null);

  // Handle Game Action Notification Toast & Animations
  const [lastActionId, setLastActionId] = useState(null);
  useEffect(() => {
    if (!gs || !gs.lastAction) return;
    const act = gs.lastAction;
    const actionKey = JSON.stringify(act);
    if (actionKey === lastActionId) return;
    setLastActionId(actionKey);

    const getPlayerName = (id) => gs.players?.find(p => p.id === id)?.name || 'Someone';
    const myId = gs.myId;

    if (act.type === 'deal') {
      toast.info('Cards dealt! Check your hand.');
    } else if (act.type === 'pick') {
      const picker = getPlayerName(act.pickerId);
      const target = getPlayerName(act.targetId);
      
      // If I am the picker, trigger drawn card overlay
      if (act.pickerId === myId) {
        setDrawnCardOverlay({
          card: act.card,
          removedPair: act.removedPair
        });
        setTimeout(() => {
          setDrawnCardOverlay(null);
        }, 3200);
      }

      if (act.removedPair) {
        const rank = act.removedPair[0] === 'JK_JOKER' ? 'Joker' : act.removedPair[0].split('_')[1];
        // Silenced toast notification to prevent clutter
        // toast.success(`${picker} drew from ${target} and discarded a pair of ${rank}s! 🃏`);
        
        // Trigger floating discard banner on picker
        const animId = `${act.pickerId}-discard-${Date.now()}`;
        const newAnim = { id: animId, playerId: act.pickerId, text: `Discarded Pair of ${rank}s!` };
        setDiscardAnims(prev => [...prev.filter(a => a.playerId !== act.pickerId), newAnim]);
        setTimeout(() => {
          setDiscardAnims(prev => prev.filter(a => a.id !== animId));
        }, 3000);
      } else {
        toast.info(`${picker} drew a card from ${target}.`);
      }
    } else if (act.type === 'discard') {
      const player = getPlayerName(act.playerId);
      const rank = act.removedPair[0] === 'JK_JOKER' ? 'Joker' : act.removedPair[0].split('_')[1];
      // Silenced toast notification to prevent clutter
      // toast.success(`${player} discarded a pair of ${rank}s! 🃏`);

      // Trigger floating discard banner
      const animId = `${act.playerId}-discard-${Date.now()}`;
      const newAnim = { id: animId, playerId: act.playerId, text: `Discarded Pair of ${rank}s!` };
      setDiscardAnims(prev => [...prev.filter(a => a.playerId !== act.playerId), newAnim]);
      setTimeout(() => {
        setDiscardAnims(prev => prev.filter(a => a.id !== animId));
      }, 3000);
    }
  }, [gs?.lastAction, gs?.players, gs?.myId, lastActionId]);

  if (!gs) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0515', color: '#fff', fontFamily: "'Inter', sans-serif", flexDirection: 'column', gap: 20 }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--red)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#94a3b8', fontWeight: 700 }}>Connecting to game…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const myId = gs.myId;
  const players = gs.players || [];
  const myIndex = players.findIndex(p => p.id === myId);

  // Find target opponent I must draw from (if it is my turn)
  const expectedTargetId = (() => {
    if (gs.currentTurn !== myId) return null;
    const idx = players.findIndex(p => p.id === myId);
    if (idx === -1) return null;
    for (let i = 1; i < players.length; i++) {
      const nextIdx = (idx + i) % players.length;
      const nextPlayer = players[nextIdx];
      if (gs.hands[nextPlayer.id] && gs.hands[nextPlayer.id].length > 0) {
        return nextPlayer.id;
      }
    }
    return null;
  })();

  const serverHand = gs.hands?.[myId] || [];
  const [myCardOrder, setMyCardOrder] = useState([]);

  const sortHand = (cards) => {
    return [...cards].sort((a, b) => {
      if (a === 'JK_JOKER') return -1;
      if (b === 'JK_JOKER') return 1;
      const rankOrder = {
        'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
        '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
      };
      const rA = a.split('_')[1];
      const rB = b.split('_')[1];
      return (rankOrder[rB] || 0) - (rankOrder[rA] || 0);
    });
  };

  useEffect(() => {
    if (!serverHand) return;
    const serverSet = new Set(serverHand);
    const localSet = new Set(myCardOrder);
    const isSameSet = serverHand.length === myCardOrder.length && serverHand.every(c => localSet.has(c));

    if (!isSameSet) {
      if (myCardOrder.length === 0) {
        setMyCardOrder(sortHand(serverHand));
      } else {
        const added = serverHand.filter(c => !localSet.has(c));
        const updatedOrder = myCardOrder.filter(c => serverSet.has(c)).concat(sortHand(added));
        setMyCardOrder(updatedOrder);
      }
    }
  }, [serverHand, myCardOrder]);

  const isHost = Boolean(myId && gs.hostId === myId);
  const isMyTurn = gs.currentTurn === myId && !gs.revealAnimationPending;
  const isGameOver = gs.state === 'GAME_OVER';

  const canDiscardSelected = useMemo(() => {
    if (selectedCards.length !== 2) return false;
    const [c1, c2] = selectedCards;
    if (c1 === 'JK_JOKER' || c2 === 'JK_JOKER') return false;
    return c1.split('_')[1] === c2.split('_')[1];
  }, [selectedCards]);

  // Compute other players' seats relative to me
  const opponents = [];
  if (myIndex !== -1) {
    for (let i = 1; i < players.length; i++) {
      const opp = players[(myIndex + i) % players.length];
      opponents.push(opp);
    }
  }

  // Header and layout heights
  const headerH = isMobile ? 48 : 60;
  const handAreaH = isMobile ? 180 : 160;
  const tableW = isMobile ? '85%' : 'min(100%, 860px)';

  const ScorePanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 20 }}>
      <div>
        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>GAME STATUS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: '1.2rem' }}>🃏</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
            {gs.state === 'PLAYING' ? `${players.find(p => p.id === gs.currentTurn)?.name || 'Someone'}'s Turn` : 'Game Over'}
          </span>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Players status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>PLAYERS</span>
        {players.map((p, idx) => {
          const finishedIdx = gs.roundWinner.indexOf(p.id);
          const finished = finishedIdx !== -1;
          const cardCount = p.cardCount || 0;
          return (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AvatarDisplay avatarId={p.avatar} playerName={p.name} size={24} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: finished ? 'var(--green)' : '#fff' }}>
                  {p.name} {p.id === myId && '(You)'}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: finished ? 'var(--green)' : 'var(--muted)' }}>
                {finished ? `Winner #${finishedIdx + 1}` : `${cardCount} Cards`}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Discarded Pairs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>DISCARDED PAIRS</span>
        <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }} className="no-scrollbar">
          {players.map(p => {
            const pairs = gs.removedPairs[p.id] || [];
            if (pairs.length === 0) return null;
            return (
              <div key={p.id} style={{ fontSize: '0.75rem' }}>
                <strong style={{ color: 'var(--red)' }}>{p.name}: </strong>
                <span style={{ color: '#94a3b8' }}>
                  {pairs.map((pr, pi) => pr[0].split('_')[1]).join(', ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', background: '#0a0515', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, #1a0a3a 0%, transparent 70%)', opacity: 0.4, pointerEvents: 'none' }} />

      {/* TOP HEADER */}
      <div style={{
        height: headerH, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 24px', zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--red)', letterSpacing: '0.15em' }}>JOKER</span>
          <span style={{ fontSize: isMobile ? '0.7rem' : '0.85rem', fontWeight: 700, color: '#94a3b8' }}>
            Room <span style={{ color: '#fff', opacity: 0.9 }}>{jkRoomId}</span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isMobile && (
            <button onClick={() => setScoreOpen(o => !o)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)', padding: '5px 10px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>
              {scoreOpen ? 'Hide' : 'Info'}
            </button>
          )}
          <button onClick={jkLeaveRoom} style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171', padding: isMobile ? '5px 10px' : '6px 16px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer'
          }}>
            Leave
          </button>
        </div>
      </div>

      {/* MOBILE INFO DRAWER */}
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

      {/* MAIN CONTENT */}
      <div style={{
        flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '10px 16px' : '20px 60px 20px 240px', minHeight: 0
      }}>

        {/* Desktop Sidebar */}
        {!isMobile && (
          <div style={{
            position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)',
            width: 200, background: 'rgba(15,10,25,0.85)', backdropFilter: 'blur(12px)',
            borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', padding: 20,
            display: 'flex', flexDirection: 'column', gap: 20, zIndex: 10,
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            maxHeight: '80vh', overflowY: 'auto'
          }} className="no-scrollbar">
            <ScorePanel />
          </div>
        )}

        {/* THE TABLE */}
        <div style={{
          width: tableW,
          aspectRatio: isMobile ? '3/2' : '2/1',
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {/* Elliptical Table Shape */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: isMobile ? '120px' : '200px',
            background: 'linear-gradient(180deg, #3b0712 0%, #160207 100%)', // Crimson red theme table
            border: `${isMobile ? 5 : 8}px solid #27030a`,
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8), 0 30px 100px rgba(0,0,0,0.6)',
            aspectRatio: isMobile ? '3/2' : '2/1',
            zIndex: 1
          }}>
            <div style={{ position: 'absolute', inset: isMobile ? 12 : 15, borderRadius: isMobile ? '108px' : '185px', border: '1px dashed rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.05, textAlign: 'center' }}>
              <span style={{ fontSize: isMobile ? '0.65rem' : '0.9rem', fontWeight: 900, letterSpacing: '0.35em', color: '#fff' }}>JOKER</span>
            </div>
          </div>

          {/* Opponents Positions around the table */}
          {opponents.map((opp, idx) => {
            const layout = seatLayouts[players.length]?.[idx] || {};
            const isTarget = opp.id === expectedTargetId;
            const chatMsg = jkChatMessages?.find(m => m.senderId === opp.id);
            const discardMsg = discardAnims.find(a => a.playerId === opp.id);
            return (
              <div
                key={opp.id}
                style={{
                  position: 'absolute',
                  top: layout.top,
                  left: layout.left,
                  right: layout.right,
                  transform: layout.transform,
                  zIndex: 10,
                }}
              >
                <JKPlayerArea
                  player={opp}
                  isMe={false}
                  isCurrentTurn={gs.currentTurn === opp.id}
                  isTarget={isTarget}
                  isMyTurn={isMyTurn}
                  chatMessage={chatMsg?.message}
                  discardMessage={discardMsg}
                  isHost={opp.id === gs.hostId}
                  compact={isMobile}
                  onPickCard={(cardIndex) => jkPickCard(opp.id, cardIndex)}
                />
              </div>
            );
          })}

          {/* Bottom Player Area (Me) */}
          <div style={{ position: 'absolute', bottom: isMobile ? -75 : -80, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            {players[myIndex] && (
              <JKPlayerArea
                player={players[myIndex]}
                isMe={true}
                isCurrentTurn={gs.currentTurn === myId}
                chatMessage={jkChatMessages?.find(m => m.senderId === myId)?.message}
                discardMessage={discardAnims.find(a => a.playerId === myId)}
                isHost={players[myIndex].id === gs.hostId}
                compact={isMobile}
              />
            )}
          </div>
        </div>
      </div>

      {/* Drawn Card Reveal Overlay */}
      <AnimatePresence>
        {drawnCardOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
              background: 'rgba(5, 2, 12, 0.85)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: isMobile ? 12 : 20
            }}
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: -50 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              style={{
                width: 'min(100%, 480px)',
                background: 'rgba(20, 15, 35, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 24,
                padding: '30px 40px',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--red)', letterSpacing: '0.25em', marginBottom: 20, display: 'block' }}>
                YOU DREW
              </span>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, margin: '20px 0' }}>
                <JKCard cardId={drawnCardOverlay.card} size="lg" />
                
                {drawnCardOverlay.removedPair && (
                  <>
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--red)' }}
                    >
                      +
                    </motion.span>
                    <motion.div
                      initial={{ scale: 0, opacity: 0, x: -30 }}
                      animate={{ scale: 1, opacity: 1, x: 0 }}
                      transition={{ delay: 0.8, type: 'spring' }}
                    >
                      <JKCard cardId={drawnCardOverlay.removedPair.find(c => c !== drawnCardOverlay.card)} size="lg" />
                    </motion.div>
                  </>
                )}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: drawnCardOverlay.removedPair ? 1.4 : 0.4 }}
                style={{ marginTop: 24, textAlign: 'center' }}
              >
                {drawnCardOverlay.removedPair ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--green)' }}>
                      MATCHING PAIR FOUND!
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 700 }}>
                      Discarding pair of {drawnCardOverlay.removedPair[0] === 'JK_JOKER' ? 'Joker' : drawnCardOverlay.removedPair[0].split('_')[1]}s! 🃏
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.95rem', color: '#94a3b8', fontWeight: 700 }}>
                    Added to your hand.
                  </span>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL SCREEN GAME OVER OVERLAY */}
      <AnimatePresence>
        {isGameOver && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(5, 2, 12, 0.85)', backdropFilter: 'blur(16px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: isMobile ? 12 : 20
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              style={{
                width: 'min(100%, 540px)', background: 'rgba(20, 15, 35, 0.95)',
                borderRadius: isMobile ? 24 : 40, border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: isMobile ? '28px 20px' : '50px 40px', textAlign: 'center',
                boxShadow: '0 40px 100px rgba(0,0,0,0.8), inset 0 0 40px rgba(239,68,68,0.05)',
                overflowY: 'auto', maxHeight: '90vh'
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--red)', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
                Game Over
              </span>

              <h2 style={{ fontSize: isMobile ? '1.8rem' : '2.8rem', fontWeight: 900, margin: '0 0 10px', background: 'linear-gradient(to bottom, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {players.find(p => p.id === gs.matchWinner)?.name || 'Someone'} Lost!
              </h2>
              <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--red)', marginBottom: isMobile ? 20 : 40 }}>
                Left holding the Joker Card 🃏
              </p>

              {/* Leaderboard/Winners List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 30, textAlign: 'left' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.1em', marginBottom: 4 }}>WINNING PLACEMENTS</span>
                {gs.roundWinner.map((winnerId, idx) => (
                  <div key={winnerId} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--green)' }}>#{idx + 1}</span>
                      <span style={{ fontWeight: 700 }}>{players.find(p => p.id === winnerId)?.name}</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--green)', fontWeight: 800 }}>Winner</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', background: 'rgba(239,68,68,0.05)', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--red)' }}>#L</span>
                    <span style={{ fontWeight: 700 }}>{players.find(p => p.id === gs.matchWinner)?.name}</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--red)', fontWeight: 800 }}>Old Maid / Loser</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {isHost && (
                  <button
                    onClick={jkRestartGame}
                    style={{
                      width: '100%', background: 'var(--red)', color: '#fff', border: 'none',
                      padding: isMobile ? '14px' : '18px', borderRadius: 16, fontWeight: 900, cursor: 'pointer',
                      fontSize: isMobile ? '0.9rem' : '1.1rem', transition: 'transform 0.2s'
                    }}
                  >
                    PLAY AGAIN
                  </button>
                )}

                <button
                  onClick={() => {
                    jkLeaveRoom();
                    window.location.href = '/';
                  }}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)', padding: isMobile ? '12px' : '16px',
                    borderRadius: 16, fontWeight: 800, cursor: 'pointer', fontSize: isMobile ? '0.85rem' : '1rem'
                  }}
                >
                  CLOSE & BACK TO HOME
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM HAND AREA */}
      <div style={{
        height: handAreaH, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: isMobile ? '0 6px 1px' : '0 24px 20px', zIndex: 100, gap: isMobile ? 6 : 15, flexShrink: 0,
        position: 'relative'
      }}>
        {/* Discard controls */}
        <AnimatePresence>
          {selectedCards.length === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              style={{
                position: 'absolute',
                bottom: handAreaH + 10,
                zIndex: 110,
              }}
            >
              {canDiscardSelected ? (
                <button
                  onClick={() => {
                    jkDiscardPair(selectedCards);
                    setSelectedCards([]);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: 20,
                    fontSize: '0.8rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 0 20px rgba(239, 68, 68, 0.6), 0 4px 12px rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  <span>🃏</span> Discard Selected Pair
                </button>
              ) : (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '6px 16px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}>
                  Selected cards do not match
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <Reorder.Group
          axis="x"
          values={myCardOrder}
          onReorder={setMyCardOrder}
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: isMobile ? 'flex-start' : 'center',
            width: '100%',
            paddingTop: 30,
            paddingBottom: 25,
            overflowX: isMobile ? 'auto' : 'visible',
            paddingLeft: isMobile ? 12 : 0,
            paddingRight: isMobile ? 12 : 0,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            margin: 0,
            padding: 0,
            listStyle: 'none',
          }}
          className="no-scrollbar"
        >
          {myCardOrder.map((card, idx) => {
            const isLast = idx === myCardOrder.length - 1;
            // Overlap sizing
            const cardW = isMobile ? 42 : 68;
            const maxHandW = isMobile ? w - 16 : w - 280;
            const overlapGap = isMobile ? 8 : (myCardOrder.length * (cardW + 4) > maxHandW ? -Math.ceil((myCardOrder.length * (cardW + 4) - maxHandW) / Math.max(myCardOrder.length - 1, 1)) : 4);
            const isSelected = selectedCards.includes(card);

            return (
              <Reorder.Item
                key={card}
                value={card}
                style={{
                  marginRight: isLast ? 0 : overlapGap,
                  zIndex: idx,
                  position: 'relative',
                  flexShrink: 0,
                  listStyle: 'none',
                }}
              >
                <JKCard
                  cardId={card}
                  size={isMobile ? 'xs' : 'md'}
                  selected={isSelected}
                  onClick={() => {
                    if (card === 'JK_JOKER') {
                      toast.error("Cannot discard the Joker! 🃏");
                      return;
                    }
                    setSelectedCards(prev => {
                      if (prev.includes(card)) {
                        return prev.filter(c => c !== card);
                      }
                      if (prev.length >= 2) {
                        return [prev[1], card];
                      }
                      return [...prev, card];
                    });
                  }}
                />
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </div>

      {/* Floating Chat Bubble */}
      <div style={{ position: 'fixed', bottom: isMobile ? 12 : 24, right: isMobile ? 12 : 24, zIndex: 1000 }}>
        <ChatInput roomId={jkRoomId} socket={jkSocket} mode="compact" />
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
