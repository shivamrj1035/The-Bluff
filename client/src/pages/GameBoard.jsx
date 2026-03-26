import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../components/Toast';
import { useGameStore } from '../store/useGameStore';
import Card from '../components/Card';
import DealAnimation from '../components/DealAnimation';
import Avatar, { TrophyIcon, TrashIcon, MaskIcon } from '../components/Icons';

import MoveAnimation from '../components/MoveAnimation';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const GET_SEATS = (isPortrait) => isPortrait ? [
  { top: '3%', left: '50%', transform: 'translateX(-50%)' },
  { top: '15%', right: '2%', transform: 'translateY(-50%) scale(0.85)' },
  { top: '38%', right: '2%', transform: 'translateY(-50%) scale(0.85)' },
  { top: '62%', right: '2%', transform: 'translateY(-50%) scale(0.85)' },
  { top: '15%', left: '2%', transform: 'translateY(-50%) scale(0.85)' },
  { top: '38%', left: '2%', transform: 'translateY(-50%) scale(0.85)' },
  { top: '62%', left: '2%', transform: 'translateY(-50%) scale(0.85)' },
] : [
  { top: '4%', left: '50%', transform: 'translateX(-50%)' },
  { top: '18%', right: '2%' },
  { bottom: '25%', right: '2%' },
  { top: '18%', left: '2%' },
  { bottom: '25%', left: '2%' },
  { top: '4%', right: '15%' },
  { top: '4%', left: '15%' },
];

export default function GameBoard() {
  const {
    gameState, playerId, bluffToast,
    selectedCards, toggleCard, playCards, callBluff, pickBluffCard, selectBluffCard,
    passTurn, kickPlayer, restartGame, closeGame, disconnect
  } = useGameStore();

  const [dealDone, setDealDone] = useState(gameState?.state !== 'DEALING');
  const [declaredRank, setDeclaredRank] = useState('A');
  const [timeLeft, setTimeLeft] = useState(60);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [showMobileHand, setShowMobileHand] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const SEATS = useMemo(() => GET_SEATS(isPortrait), [isPortrait]);

  const seatedPlayers = useMemo(() => {
    if (!gameState?.players || !playerId) return [];
    const players = gameState.players;
    const myIndex = players.findIndex(p => p.id === playerId);
    if (myIndex === -1) return players.filter(p => p.id !== playerId);

    // Rotate so current player is "bottom" (me), then filter me out to seat others clockwise
    const rotated = [...players.slice(myIndex), ...players.slice(0, myIndex)];
    return rotated.filter(p => p.id !== playerId);
  }, [gameState?.players, playerId]);

  // Handle animations for throwing cards
  useEffect(() => {
    if (gameState?.lastMove) {
      const { playerId: moverId, count } = gameState.lastMove;
      const isMe = moverId === playerId;
      const seatIdx = seatedPlayers.findIndex(p => p.id === moverId);
      if (!isMe && seatIdx === -1) return;

      const fromPos = isMe ? { bottom: '0px', left: '50%' } : SEATS[seatIdx % SEATS.length];
      setActiveAnimation({
        from: fromPos,
        to: { top: isPortrait ? '35%' : '44%', left: '50%' },
        count
      });
    }
  }, [gameState?.lastMove]);

  // Handle animations for picking up cards
  useEffect(() => {
    if (bluffToast) {
      const loserId = bluffToast.loserId;
      const isMe = loserId === playerId;
      const seatIdx = seatedPlayers.findIndex(p => p.id === loserId);
      if (!isMe && seatIdx === -1) return;

      const toPos = isMe ? { bottom: '0px', left: '50%' } : SEATS[seatIdx % SEATS.length];
      setActiveAnimation({
        from: { top: isPortrait ? '35%' : '44%', left: '50%' },
        to: toPos,
        count: bluffToast.pileCount
      });
    }
  }, [bluffToast]);

  useEffect(() => {
    if (gameState?.roundRank) setDeclaredRank(gameState.roundRank);
  }, [gameState?.roundRank]);

  useEffect(() => {
    if (!gameState?.turnStartTime || gameState.state === 'WAITING' || gameState.state === 'ENDED') return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - gameState.turnStartTime) / 1000);
      const limit = gameState.state === 'BLUFF_PICKING' ? 20 : (gameState.timerDuration || 60);
      const remaining = Math.max(0, limit - elapsed);
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [gameState?.turnStartTime, gameState?.state]);

  useEffect(() => {
    if (!bluffToast) return;
    const { wasBluff, pickerName, targetName, pickedCard, pileCount } = bluffToast;
    const cardRank = pickedCard?.split('_')[1] || '?';
    if (wasBluff) toast.error(`EXPOSED! ${targetName} lied about having ${cardRank}. They take ${pileCount} cards.`, { duration: 5000 });
    else toast.success(`MISTAKE! ${targetName} was honest. ${pickerName} takes ${pileCount} cards.`, { duration: 5000 });
  }, [bluffToast]);

  if (!gameState) return null;

  const { players, hands, pile, sidePile, currentTurn, lastMove, state, hostId, roundRank, ranking, bluffPickerId, bluffSelectIdx } = gameState;
  
  const myHand = useMemo(() => {
    const rawHand = hands?.[playerId] || [];
    // Sort by rank order defined in RANKS
    return [...rawHand].sort((a, b) => {
      const rA = a.includes('_') ? a.split('_')[1] : 'X';
      const rB = b.includes('_') ? b.split('_')[1] : 'X';
      return RANKS.indexOf(rA) - RANKS.indexOf(rB);
    });
  }, [hands?.[playerId]]);

  const myInfo = players.find(p => p.id === playerId);
  const isMyTurn = currentTurn === playerId;
  const isHost = hostId === playerId;
  const isPickingPhase = state === 'BLUFF_PICKING';
  const isEnded = state === 'ENDED';
  const totalPileCards = pile?.reduce((s, m) => s + m.count, 0) || 0;
  const currentPlayer = players.find(p => p.id === currentTurn);
  const bluffPicker = players.find(p => p.id === bluffPickerId);

  const handlePlay = () => {
    if (selectedCards.length === 0) return toast.error('Select cards to play');
    playCards(declaredRank);
  };

  // Logic for horizontal scroll vs fan
  const useScrollHand = (isPortrait && myHand.length > 6) || myHand.length > 12;

  // Find winner rank
  const getRankPos = (pId) => {
    const r = ranking.find(rank => rank.id === pId);
    return r ? r.rankPos : null;
  };

  return (
    <div style={{
      height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative',
      background: 'radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0a0a0c 100%)',
    }}>

      {/* ── Card Movement Animation ── */}
      <MoveAnimation
        fromPos={activeAnimation?.from}
        toPos={activeAnimation?.to}
        count={activeAnimation?.count}
        onComplete={() => setActiveAnimation(null)}
      />

      {/* ── Deal Animation ── */}
      {!dealDone && state === 'DEALING' && (
        <DealAnimation players={players} onComplete={() => setDealDone(true)} />
      )}

      {/* ── Header ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px',
        paddingTop: 'env(safe-area-inset-top, 16px)'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="panel-sm" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 900, color: '#a78bfa', fontSize: '0.85rem' }}>THE BLUFF</span>
          </div>
          {roundRank && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel-sm"
              style={{ padding: '10px 20px', border: '1.5px solid #f59e0b', background: 'rgba(245,158,11,0.1)' }}>
              <span style={{ fontSize: '0.6rem', color: '#f59e0b', fontWeight: 900, textTransform: 'uppercase', marginRight: '8px' }}>Round Rank</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>{roundRank}</span>
            </motion.div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {currentPlayer && !isEnded && !isPickingPhase && (
            <div className="panel-sm" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', border: isMyTurn ? '1.5px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ position: 'relative', width: '28px', height: '28px' }}>
                <svg style={{ transform: 'rotate(-90deg)', width: '28px', height: '28px' }}>
                  <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
                  <motion.circle cx="14" cy="14" r="12" fill="none" stroke={timeLeft < 10 ? '#ef4444' : '#7c3aed'} strokeWidth="2.5"
                    strokeDasharray="75" strokeDashoffset={75 - (75 * timeLeft / (isPickingPhase ? 20 : (gameState.timerDuration || 60)))} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900 }}>
                  {timeLeft}
                </div>
              </div>
              <span style={{ fontWeight: 800, color: isMyTurn ? '#fff' : '#9ca3af', fontSize: '0.8rem' }}>{isMyTurn ? 'YOUR TURN' : currentPlayer.name.toUpperCase()}</span>
            </div>
          )}
          <button className="btn btn-red btn-sm" onClick={disconnect} style={{ width: 'auto' }}>EXIT</button>
        </div>
      </div>

      {/* ── Felt Table ── */}
      <div style={{
        position: 'absolute', top: isPortrait ? '35%' : '44%', left: '50%', transform: 'translate(-50%, -50%)',
        width: isPortrait ? '85vw' : '65vw', height: isPortrait ? '30vh' : '45vh',
        maxWidth: '900px', maxHeight: '420px', zIndex: 5
      }}>
        <div className="felt-table" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isPortrait ? '10px' : '60px' }}>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', width: '75px', height: '105px' }}>
              {totalPileCards > 0 ? (
                [...Array(Math.min(10, totalPileCards))].map((_, i) => (
                  <div key={i} style={{
                    position: 'absolute', inset: 0, borderRadius: '8px', background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)',
                    border: '1px solid rgba(167,139,250,0.3)', zIndex: i,
                    transform: `translate(${(i - 5) * 2}px, ${(i - 5) * 1.5}px) rotate(${(i - 5) * 4}deg)`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }} />
                ))
              ) : (
                <div style={{ position: 'absolute', inset: 0, borderRadius: '8px', border: '1.5px dashed rgba(255,255,255,0.08)' }} />
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>MAIN PILE</p>
              <p style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{totalPileCards}</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: sidePile.length > 0 ? 0.6 : 0.1 }}>
            <div style={{ position: 'relative', width: '50px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, transform: 'rotate(10deg)' }}>
              <TrashIcon size={24} />
            </div>
            <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#4b5563', textTransform: 'uppercase' }}>SIDED: {sidePile.length}</p>
          </div>
        </div>

        <AnimatePresence>
          {lastMove && !isPickingPhase && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', bottom: '15%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 10 }}>
              <div className="panel-sm" style={{ padding: '8px 20px', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--primary)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>
                  <span style={{ color: '#a78bfa' }}>{lastMove.playerName}</span> played <span style={{ color: '#fff', fontWeight: 900 }}>{lastMove.count}</span> Cards &rarr; <span style={{ color: '#f59e0b', fontWeight: 900 }}>{lastMove.declaredRank}</span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Opponents (Seated Clockwise) ── */}
      {seatedPlayers.map((player, i) => {
        const pos = SEATS[i % SEATS.length];
        const isActive = currentTurn === player.id;
        const hc = player.cardCount;
        const winRank = getRankPos(player.id);
        const playerWinner = !!winRank;

        return (
          <motion.div key={player.id}
            initial={false}
            animate={{ scale: isActive ? (isPortrait ? 0.9 : 1.1) : (isPortrait ? 0.75 : 0.9) }}
            style={{
              position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: isActive ? 20 : 10,
              ...pos,
            }}>
            <div className="panel-sm" style={{
              padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '110px',
              border: isActive ? '2.5px solid #7c3aed' : '1.5px solid rgba(255,255,255,0.08)',
              background: isActive ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)',
              boxShadow: isActive ? '0 0 20px rgba(124,58,237,0.3)' : 'none',
              opacity: playerWinner ? 0.4 : 1,
              position: 'relative',
              transition: 'all 0.3s ease',
              transform: isActive ? 'scale(1.05)' : 'none'
            }}>
              <Avatar name={player.name} size={32} fontSize="1rem" />
              <div style={{ textAlign: 'left', flex: 1 }}>
                <p style={{
                  fontSize: '0.75rem', fontWeight: 900, color: '#fff', margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75px'
                }}>{player.name.toUpperCase()}</p>
                <p style={{ fontSize: '0.65rem', color: playerWinner ? '#f59e0b' : '#6b7280', fontWeight: 800, margin: 0 }}>
                  {playerWinner ? `FINISHED #${winRank}` : `${hc} CARDS`}
                </p>
              </div>
              {isHost && !playerWinner && (
                <button onClick={() => kickPlayer(player.id)} style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: '#fff', width: 20, height: 20, borderRadius: '50%', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, border: '2px solid #000', cursor: 'pointer' }}>✕</button>
              )}
              {playerWinner && (
                <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <TrophyIcon size={18} />
                  <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#f59e0b', background: '#000', padding: '1px 3px', borderRadius: 4, marginTop: -4 }}>#{winRank}</span>
                </div>
              )}
            </div>

            <div style={{ position: 'relative', height: '36px', width: '100%', display: 'flex', justifyContent: 'center', marginTop: 4 }}>
              {!playerWinner && hc > 0 && [...Array(Math.min(hc, 5))].map((_, ci) => (
                <div key={ci} className="face-down-card" style={{
                  width: '28px', height: '40px', left: '50%', marginLeft: '-14px',
                  transform: `translateX(${(ci - 2) * 10}px) rotate(${(ci - 2) * 5}deg)`, zIndex: ci
                }} />
              ))}
              {!playerWinner && hc > 5 && <div style={{ position: 'absolute', right: -12, top: 0, fontSize: '.6rem', fontWeight: 900, color: '#9ca3af' }}>+{hc - 5}</div>}
            </div>
          </motion.div>
        );
      })}

      {/* ── My Hand ── */}
      <AnimatePresence>
        {(!isPortrait || showMobileHand || !isMyTurn) && (
          <motion.div
            initial={isPortrait ? { y: 200, opacity: 0 } : { opacity: 0 }}
            animate={isPortrait ? { y: 0, opacity: 1 } : { opacity: 1 }}
            exit={isPortrait ? { y: 200, opacity: 0 } : { opacity: 0 }}
            style={{
              position: 'absolute', bottom: isPortrait ? '120px' : '135px',
              left: 0, right: 0, display: 'flex', justifyContent: 'center',
              zIndex: 40, pointerEvents: (isPickingPhase || isEnded) ? 'none' : 'auto',
            }}>
            <div style={{
              position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              height: '180px', width: '90vw', maxWidth: '1200px',
            }}>
              {myHand.map((cardId, i) => {
                const count = myHand.length;
                // Traditional overlapping: calculate offset based on total count to fit width
                const maxHandWidth = isPortrait ? 320 : 800;
                const cardWidth = isPortrait ? 60 : 80;
                const overlap = count > 1 ? Math.min(cardWidth - 10, (maxHandWidth - cardWidth) / (count - 1)) : 0;
                const totalW = (count - 1) * overlap;
                const tx = (i * overlap) - (totalW / 2);
                
                const selected = selectedCards.includes(cardId);
                const angle = (i - (count - 1) / 2) * (count > 10 ? 1.5 : 3);

                return (
                  <motion.div key={`${cardId}-${i}`}
                    layout
                    style={{
                      position: 'absolute', left: '50%', bottom: 0, transformOrigin: 'bottom center',
                      x: tx, y: selected ? -30 : 0, rotate: angle,
                      zIndex: i, cursor: 'pointer',
                    }}
                    whileHover={{ y: selected ? -40 : -15, zIndex: 100 }}
                    onClick={() => toggleCard(cardId)}
                  >
                    <Card cardId={cardId} scale={isPortrait ? 0.9 : 1.1} />
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile "View Cards" Toggle ── */}
      {isPortrait && state !== 'ENDED' && (
        <div style={{ position: 'absolute', bottom: '90px', left: '50%', transform: 'translateX(-50%)', zIndex: 45 }}>
          <button className="btn btn-sm"
            onClick={() => setShowMobileHand(!showMobileHand)}
            style={{
              background: showMobileHand ? 'var(--bg2)' : 'var(--primary)',
              color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
              width: '140px', opacity: 0.9, fontSize: '0.75rem', padding: '8px'
            }}>
            {showMobileHand ? 'HIDE MY CARDS ↑' : `VIEW MY CARDS (${myHand.length}) ↓`}
          </button>
        </div>
      )}

      {/* ── Bluff Picking ── */}
      <AnimatePresence>
        {isPickingPhase && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(5,5,15,0.96)', backdropFilter: 'blur(16px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '30px'
            }}>
            <MaskIcon size={64} />

            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: isPortrait ? '1.3rem' : '1.8rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                {bluffPickerId === playerId ? 'Choose a card to expose' : `${bluffPicker?.name.toUpperCase()} IS DECIDING...`}
              </h2>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: timeLeft < 5 ? '#ef4444' : '#7c3aed', marginTop: 8, textShadow: '0 0 30px rgba(124,58,237,0.5)' }}>{timeLeft}s</div>
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', padding: '0 30px', maxWidth: '800px' }}>
              {pile[pile.length - 1]?.cards?.map((_, idx) => {
                const isSelected = bluffSelectIdx === idx;
                return (
                  <motion.div key={idx}
                    initial={{ scale: 1 }}
                    animate={{ 
                      scale: isSelected ? 1.15 : 1,
                      y: isSelected ? -20 : 0,
                    }}
                    onMouseEnter={() => bluffPickerId === playerId && selectBluffCard(idx)}
                    onMouseLeave={() => bluffPickerId === playerId && selectBluffCard(null)}
                    onClick={() => bluffPickerId === playerId && pickBluffCard(idx)}
                    style={{ 
                      cursor: bluffPickerId === playerId ? 'pointer' : 'default', 
                      filter: isSelected ? 'drop-shadow(0 0 30px #7c3aed)' : 'drop-shadow(0 0 20px rgba(0,0,0,0.5))',
                      border: isSelected ? '4px solid #7c3aed' : '2px solid transparent',
                      borderRadius: '12px',
                      transition: 'border 0.2s ease'
                    }}>
                    <Card cardId="X" faceDown={true} scale={isPortrait ? 0.9 : 1.1} />
                  </motion.div>
                );
              }) || <p style={{ color: '#6b7280' }}>Wait for cards...</p>}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#7c3aed', fontWeight: 900, fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '0.1em', animation: 'pulse 1.5s infinite' }}>
                {bluffPickerId === playerId ? 'SELECT NOW!' : 'Waiting for decision...'}
              </p>
              {bluffSelectIdx !== null && bluffPickerId !== playerId && (
                <p style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', marginTop: 10 }}>
                  {bluffPicker?.name.toUpperCase()} IS LOOKING AT A CARD...
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Final Ranking / Leaderboard ── */}
      <AnimatePresence mode="wait">
        {isEnded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(5,5,15,0.98)', backdropFilter: 'blur(30px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}>

            {/* Special Loser Animation/Banner */}
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{ textAlign: 'center', marginBottom: 30 }}
            >
              <div style={{ fontSize: '1rem', fontWeight: 900, color: '#ef4444', letterSpacing: '0.4em', marginBottom: 8 }}>GAME OVER</div>
              <h1 style={{ fontSize: isPortrait ? '2rem' : '3.5rem', fontWeight: 900, color: '#fff', margin: 0 }}>
                {ranking[ranking.length - 1]?.id === playerId ? 'YOU LOST! 🤡' : `${ranking[ranking.length - 1]?.name.toUpperCase()} LOST! 🤡`}
              </h1>
              <p style={{ color: '#6b7280', fontSize: '1rem', marginTop: 6 }}>The ultimate bluffer (or failed honest player).</p>
            </motion.div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 400 }}>
              {ranking.map((res, i) => {
                const isLoser = i === ranking.length - 1;
                return (
                  <motion.div
                    key={res.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.8 + (i * 0.1) }}
                    className="panel"
                    style={{
                      padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16,
                      border: isLoser ? '2px solid #ef4444' : (i === 0 ? '2.5px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)'),
                      background: isLoser ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                      transform: i === 0 ? 'scale(1.05)' : 'none',
                      boxShadow: i === 0 ? '0 0 30px rgba(245,158,11,0.2)' : 'none'
                    }}>
                    <span style={{ fontWeight: 900, color: isLoser ? '#ef4444' : (i === 0 ? '#f59e0b' : '#6b7280'), fontSize: '1.5rem', width: 40 }}>
                      {isLoser ? 'L' : `#${res.rankPos}`}
                    </span>
                    <Avatar name={res.name} size={40} fontSize="1.2rem" />
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <p style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', margin: 0 }}>{res.name.toUpperCase()}</p>
                      <p style={{ fontSize: '0.65rem', color: isLoser ? '#ef4444' : '#6b7280', fontWeight: 800, margin: 0 }}>
                        {isLoser ? 'BETTER LUCK NEXT TIME' : (i === 0 ? 'CHAMPION' : 'WELL PLAYED')}
                      </p>
                    </div>
                    {!isLoser && (i === 0 ? <TrophyIcon size={28} /> : (i < 3 && <TrophyIcon size={18} />))}
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              style={{ marginTop: 40, display: 'flex', gap: 16, flexDirection: isPortrait ? 'column' : 'row' }}
            >
              {isHost && <button className="btn btn-primary" onClick={restartGame} style={{ padding: '15px 40px', fontSize: '1.1rem' }}>PLAY AGAIN</button>}
              <button className="btn btn-outline" onClick={disconnect} style={{ padding: '15px 40px', fontSize: '1.1rem' }}>EXIT LOUNGE</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hud">
        <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isPortrait ? '10px' : '24px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: 'auto' }}>
            <div style={{ position: 'relative' }}>
              <Avatar name={myInfo?.name || '?'} size={isPortrait ? 30 : 40} fontSize="1.1rem" />
              {getRankPos(playerId) && (
                <div style={{ position: 'absolute', top: -8, bottom: -8, left: '50%', transform: 'translateX(-50%)' }}><TrophyIcon size={14} /></div>
              )}
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 900, color: '#fff', margin: 0, textTransform: 'uppercase' }}>{myHand.length} CARDS</p>
              <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7c3aed', margin: 0 }}>{myInfo?.name}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {isMyTurn && !isPickingPhase && !isEnded && (
              <>
                {!roundRank && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#6b7280', paddingLeft: 4 }}>RANK</span>
                    <select value={declaredRank} onChange={e => setDeclaredRank(e.target.value)} className="rank-select" style={{ padding: '6px 10px', fontSize: '0.85rem' }}>
                      {RANKS.map(r => <option key={r} value={r} style={{ background: '#0c0c1a' }}>{r}</option>)}
                    </select>
                  </div>
                )}
                {pile.length > 0 && (
                  <button className="btn btn-red btn-sm" onClick={callBluff} style={{ padding: '10px 18px', fontWeight: 900, width: 'auto' }}><MaskIcon size={16} /> BLUFF</button>
                )}
                <button className="btn btn-primary btn-sm" onClick={handlePlay} disabled={selectedCards.length === 0} style={{ padding: '10px 24px', opacity: selectedCards.length === 0 ? 0.3 : 1, width: 'auto', fontSize: '0.85rem' }}>
                  PLAY {selectedCards.length || ''}
                </button>
                {roundRank && (
                  <button className="btn btn-outline btn-sm" onClick={passTurn} style={{ padding: '10px 18px', width: 'auto' }}>PASS</button>
                )}
              </>
            )}
            {!isMyTurn && !isEnded && !isPickingPhase && (
              <p style={{ color: '#4b5563', fontSize: '0.85rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                {state === 'WAITING' ? 'Waiting for Host' : 'Waiting for Turn...'}
              </p>
            )}
            {isPickingPhase && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="dot-live" style={{ width: 12, height: 12, background: '#ef4444' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff', letterSpacing: '0.1em' }}>RESOLUTION...</span>
              </div>
            )}
            {isHost && !isEnded && <button onClick={closeGame} style={{ color: '#ef4444', background: 'none', fontSize: '0.8rem', fontWeight: 900, padding: 10, cursor: 'pointer', border: 'none', marginLeft: 10 }}>CLOSE</button>}
          </div>
        </div>
      </div>

    </div>
  );
}
