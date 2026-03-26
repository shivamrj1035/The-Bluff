import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../components/Toast';
import { useGameStore } from '../store/useGameStore';
import { useSound } from '../hooks/useSound';
import Card from '../components/Card';
import DealAnimation from '../components/DealAnimation';
import Avatar, { TrophyIcon, TrashIcon, MaskIcon } from '../components/Icons';

import MoveAnimation from '../components/MoveAnimation';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const GET_SEATS = (isPortrait) => isPortrait ? [
  { top: '10%', left: '50%', transform: 'translateX(-50%) scale(0.8)' },
  { top: '24%', right: '4%', transform: 'translateY(-50%) scale(0.85)' },
  { top: '44%', right: '4%', transform: 'translateY(-50%) scale(0.85)' },
  { top: '64%', right: '4%', transform: 'translateY(-50%) scale(0.85)' },
  { top: '24%', left: '4%', transform: 'translateY(-50%) scale(0.85)' },
  { top: '44%', left: '4%', transform: 'translateY(-50%) scale(0.85)' },
  { top: '64%', left: '4%', transform: 'translateY(-50%) scale(0.85)' },
] : [
  { top: '14%', left: '50%', transform: 'translateX(-50%)' },
  { top: '24%', right: '2%' },
  { bottom: '25%', right: '2%' },
  { top: '24%', left: '2%' },
  { bottom: '25%', left: '2%' },
  { top: '14%', right: '15%' },
  { top: '14%', left: '15%' },
];

export default function GameBoard() {
  const {
    gameState, playerId, bluffToast,
    selectedCards, toggleCard, playCards, callBluff, pickBluffCard, selectBluffCard,
    passTurn, kickPlayer, restartGame, closeGame, disconnect
  } = useGameStore();

  const { play } = useSound();

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
        to: { top: isPortrait ? '45%' : '44%', left: '50%' },
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
        from: { top: isPortrait ? '45%' : '44%', left: '50%' },
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

  const {
    players, hands, pile, sidePile, currentTurn, lastMove, state,
    hostId, roundRank, ranking, bluffPickerId, bluffSelectIdx, bluffResult,
    roomId: serverRoomId, isSpectator
  } = gameState;

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
  const isHost = hostId === playerId;
  const isMyTurn = currentTurn === playerId;
  const isPickingPhase = state === 'BLUFF_PICKING';
  const isEnded = state === 'ENDED';

  // Sounds for turn and moves
  const lastMoveId = lastMove?.id || '';
  useEffect(() => {
    if (lastMove) play('card_play');
  }, [lastMoveId, play]);

  useEffect(() => {
    if (isMyTurn && state === 'PLAYING') play('turn_ding');
  }, [isMyTurn, state, play]);

  useEffect(() => {
    if (isPickingPhase) play('bluff_alert');
  }, [isPickingPhase, play]);
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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isPortrait ? '8px 12px' : '16px',
        paddingTop: 'env(safe-area-inset-top, 8px)'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!isPortrait && (
            <div className="panel-sm" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 900, color: '#a78bfa', fontSize: '0.85rem' }}>THE BLUFF</span>
            </div>
          )}
          {/* Room ID Pill */}
          <div className="panel-sm" style={{
            padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <span style={{ color: '#9ca3af', fontWeight: 700, fontSize: '0.65rem' }}>ROOM:</span>
            <span style={{ fontWeight: 900, color: '#fff', fontSize: isPortrait ? '0.7rem' : '0.8rem', letterSpacing: '0.05em' }}>{serverRoomId}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(serverRoomId);
                toast.success("Room code copied!");
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed',
                padding: '2px', marginLeft: 2, display: 'flex', alignItems: 'center'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          {isSpectator && (
            <div className="panel-sm" style={{ padding: '8px 16px', background: '#f59e0b', border: 'none' }}>
              <span style={{ color: '#000', fontWeight: 900, fontSize: '0.65rem', textTransform: 'uppercase' }}>Spectating</span>
            </div>
          )}
          {roundRank && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel-sm"
              style={{ padding: '6px 14px', border: '1.5px solid #f59e0b', background: 'rgba(245,158,11,0.1)' }}>
              <span style={{ fontSize: '0.55rem', color: '#f59e0b', fontWeight: 900, textTransform: 'uppercase' }}>RANK: </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>{roundRank}</span>
            </motion.div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {currentPlayer && !isEnded && !isPickingPhase && (
            <div className="panel-sm" style={{
              padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px',
              border: isMyTurn ? '1.5px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
              background: isMyTurn ? 'rgba(124,58,237,0.1)' : 'rgba(0,0,0,0.2)',
              minWidth: isPortrait ? 'auto' : '180px'
            }}>
              <div style={{ position: 'relative', width: '24px', height: '24px' }}>
                <svg style={{ transform: 'rotate(-90deg)', width: '24px', height: '24px' }}>
                  <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                  <motion.circle cx="12" cy="12" r="10" fill="none" stroke={timeLeft < 10 ? '#ef4444' : '#7c3aed'} strokeWidth="2"
                    strokeDasharray="63" strokeDashoffset={63 - (63 * timeLeft / (isPickingPhase ? 20 : (gameState.timerDuration || 60)))} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 900 }}>
                  {timeLeft}
                </div>
              </div>
              <span style={{ fontWeight: 800, color: isMyTurn ? '#fff' : '#9ca3af', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                {isMyTurn ? 'YOUR TURN' : currentPlayer.name.toUpperCase()}
              </span>
            </div>
          )}
          <button className="btn btn-red btn-sm" onClick={disconnect} style={{ width: 'auto' }}>EXIT</button>
        </div>
      </div>

      {/* ── Felt Table ── */}
      <div style={{
        position: 'absolute', top: isPortrait ? '52%' : '44%', left: '50%', transform: 'translate(-50%, -50%)',
        width: isPortrait ? '85vw' : '70vw', height: isPortrait ? '30vh' : '45vh',
        maxWidth: '1000px', maxHeight: '500px', zIndex: 5
      }}>
        <div className="felt-table" style={{
          width: '100%', height: '100%',
          borderRadius: isPortrait ? '32px' : '50%',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
          padding: isPortrait ? '0 10px' : '0 40px',
          boxShadow: 'inset 0 0 80px rgba(0,0,0,0.8), 0 25px 60px rgba(0,0,0,0.8)',
          background: isPortrait
            ? 'radial-gradient(circle at center, var(--felt-light) 0%, var(--felt-mid) 70%, var(--felt) 100%)'
            : undefined
        }}>
          {/* Left Column: Last Move Info */}
          <div style={{ visibility: (lastMove && !isPickingPhase) ? 'visible' : 'hidden', textAlign: 'center' }}>
            {lastMove && (
              <div className="panel-sm" style={{
                padding: isPortrait ? '2px 6px' : '6px 10px',
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: '8px',
                display: 'inline-block'
              }}>
                <p style={{ margin: 0, fontSize: isPortrait ? '0.5rem' : '0.6rem', fontWeight: 900, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{lastMove.playerName}</p>
                <div style={{ marginTop: '2px' }}>
                  <p style={{ margin: 0, fontSize: isPortrait ? '0.7rem' : '0.9rem', fontWeight: 900, color: '#fff' }}>{lastMove.count} Cards</p>
                  <p style={{ margin: 0, fontSize: isPortrait ? '0.55rem' : '0.7rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>of {lastMove.declaredRank}</p>
                </div>
              </div>
            )}
          </div>

          {/* Middle Column: Main Pile */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative', width: isPortrait ? '65px' : '85px', height: isPortrait ? '90px' : '120px' }}>
              {totalPileCards > 0 ? (
                [...Array(Math.min(10, totalPileCards))].map((_, i) => (
                  <div key={i} style={{
                    position: 'absolute', inset: 0, borderRadius: '8px', background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)',
                    border: '1px solid rgba(167,139,250,0.3)', zIndex: i,
                    transform: `translate(${(i - 5) * 1.5}px, ${(i - 5) * 1.2}px) rotate(${(i - 5) * 3}deg)`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }} />
                ))
              ) : (
                <div style={{ position: 'absolute', inset: 0, borderRadius: '8px', border: '1.5px dashed rgba(255,255,255,0.08)' }} />
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>MAIN PILE</p>
              <p style={{ fontSize: isPortrait ? '1.8rem' : '2.4rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{totalPileCards}</p>
            </div>
          </div>

          {/* Right Column: Sided Pile */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: sidePile.length > 0 ? 0.9 : 0.2 }}>
            <div style={{ position: 'relative', width: isPortrait ? '40px' : '55px', height: isPortrait ? '55px' : '75px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 8, transform: 'rotate(10deg)', background: 'rgba(255,255,255,0.03)' }}>
              <TrashIcon size={isPortrait ? 18 : 28} color="#fff" />
            </div>
            <p style={{ fontSize: '0.65rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SIDED: {sidePile.length}</p>
          </div>
        </div>

        {/* <AnimatePresence>
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
        </AnimatePresence> */}
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
            <div className={`panel-sm ${isActive ? 'active-pulse' : ''}`} style={{
              padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '110px',
              border: isActive ? '2.5px solid #7c3aed' : '1.5px solid rgba(255,255,255,0.08)',
              background: isActive ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
              boxShadow: isActive ? '0 0 30px rgba(124,58,237,0.4)' : 'none',
              opacity: playerWinner ? 0.4 : 1,
              position: 'relative',
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              transform: isActive ? 'scale(1.1)' : 'none'
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
        {!isSpectator && (!isPortrait || showMobileHand) && (
          <motion.div
            initial={isPortrait ? { y: 200, opacity: 0 } : { opacity: 0 }}
            animate={isPortrait ? { y: 0, opacity: 1 } : { opacity: 1 }}
            exit={isPortrait ? { y: 200, opacity: 0 } : { opacity: 0 }}
            style={{
              position: 'absolute', bottom: isPortrait ? '130px' : '140px',
              left: 0, right: 0, display: 'flex', justifyContent: 'center',
              zIndex: 40, pointerEvents: (isPickingPhase || isEnded) ? 'none' : 'auto',
            }}>
            {isPortrait ? (
              /* Mobile Sliding Layout */
              <div style={{
                width: '100vw', display: 'flex', overflowX: 'auto', overflowY: 'visible',
                padding: '20px 40px 60px', scrollBehavior: 'smooth', gap: '12px',
                alignItems: 'flex-end', justifyContent: 'flex-start',
                scrollbarWidth: 'none', msOverflowStyle: 'none'
              }} className="no-scrollbar">
                {myHand.map((cardId, i) => {
                  const selected = selectedCards.includes(cardId);
                  return (
                    <div key={`${cardId}-${i}`}
                      style={{
                        cursor: 'pointer', flexShrink: 0,
                        transform: `translateY(${selected ? -20 : 0}px)`,
                        transition: 'transform 0.2s ease',
                      }}
                      onClick={() => toggleCard(cardId)}
                    >
                      <Card cardId={cardId} scale={0.9} index={i} />
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Desktop Traditional Overlapping Layout */
              <div style={{
                position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                height: '220px', width: '95vw', maxWidth: '1400px', padding: '20px 0'
              }}>
                {myHand.map((cardId, i) => {
                  const count = myHand.length;
                  const cardWidth = 100;
                  const containerWidth = Math.min(1200, window.innerWidth * 0.9);

                  // Calculate overlap to fit container
                  let overlap = 80; // default spacing
                  if (count > 1) {
                    const neededWidth = (count * 80) + 20;
                    if (neededWidth > containerWidth) {
                      overlap = (containerWidth - cardWidth) / (count - 1);
                    }
                  }

                  const totalWidth = overlap * (count - 1) + cardWidth;
                  const startX = -totalWidth / 2 + cardWidth / 2;
                  const tx = startX + (i * overlap);

                  const selected = selectedCards.includes(cardId);

                  return (
                    <motion.div key={`${cardId}-${i}`}
                      layout
                      whileHover={{ y: selected ? -50 : -20, zIndex: 100 }}
                      style={{
                        position: 'absolute', left: '50%', bottom: '20px',
                        x: tx, y: selected ? -40 : 0,
                        zIndex: i, cursor: 'pointer',
                      }}
                      onClick={() => toggleCard(cardId)}
                    >
                      <Card cardId={cardId} scale={1.15} index={i} />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile "View Cards" Toggle (Hidden for Spectators) ── */}
      {!isSpectator && isPortrait && state !== 'ENDED' && (
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

      {/* ── Bluff Result / Resolution ── */}
      <AnimatePresence>
        {state === 'ROUND_RESOLUTION' && bluffResult && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(5,5,15,0.98)', backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px',
              padding: '20px'
            }}>

            <div style={{ position: 'absolute', top: '10%', textAlign: 'center' }}>
              <motion.div
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{
                  fontSize: isPortrait ? '2.5rem' : '4rem', fontWeight: 900,
                  color: bluffResult.wasBluff ? '#ef4444' : '#10b981',
                  textTransform: 'uppercase', letterSpacing: '0.2em',
                  textShadow: bluffResult.wasBluff ? '0 0 50px rgba(239,68,68,0.5)' : '0 0 50px rgba(16,185,129,0.5)'
                }}>
                {bluffResult.wasBluff ? 'BLUFF CAUGHT!' : 'HONEST MOVE!'}
              </motion.div>
            </div>

            <motion.div
              initial={{ scale: 0.5, rotateY: 180, y: 50 }}
              animate={{ scale: 1.2, rotateY: 0, y: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 100 }}
              style={{ filter: 'drop-shadow(0 0 40px rgba(124,58,237,0.6))', marginTop: '40px' }}
            >
              <Card cardId={bluffResult.pickedCard} scale={isPortrait ? 1.3 : 1.6} />
            </motion.div>

            <div style={{ textAlign: 'center', maxWidth: '90%' }}>
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                style={{ fontSize: isPortrait ? '1.2rem' : '1.8rem', fontWeight: 700, color: '#fff' }}>
                {bluffResult.wasBluff
                  ? <><span style={{ color: '#ef4444' }}>{bluffResult.targetName}</span> LIED!</>
                  : <><span style={{ color: '#10b981' }}>{bluffResult.targetName}</span> HAD IT!</>
                }
              </motion.p>

              <motion.div
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}
                style={{
                  marginTop: 25, padding: '20px', background: 'rgba(255,255,255,0.05)',
                  borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)',
                  width: '90vw', maxWidth: '800px'
                }}>
                <div style={{ marginBottom: 15 }}>
                  <p style={{ fontSize: '1rem', color: '#9ca3af', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Penalty Assignment</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f59e0b', margin: '5px 0' }}>
                    +{bluffResult.pileCount} CARDS
                  </p>
                  <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 800 }}>
                    to <span style={{ color: '#7c3aed' }}>{bluffResult.loserId === playerId ? 'YOU' : bluffResult.loserId === bluffResult.targetId ? bluffResult.targetName.toUpperCase() : bluffResult.pickerName.toUpperCase()}</span>
                  </div>
                </div>

                <div style={{
                  display: 'flex', overflowX: 'auto', gap: '8px', padding: '10px 0',
                  justifyContent: 'center', scrollbarWidth: 'none',
                }} className="no-scrollbar">
                  {bluffResult.assignedCards?.slice(0, 30).map((cId, idx) => (
                    <div key={idx} style={{ flexShrink: 0, marginLeft: idx > 0 ? -15 : 0 }}>
                      <Card cardId={cId} faceDown={cId !== bluffResult.pickedCard} small={true} scale={0.7} />
                    </div>
                  ))}
                  {bluffResult.assignedCards?.length > 30 && (
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 10px', color: '#6b7280', fontSize: '1rem', fontWeight: 900 }}>
                      +{bluffResult.assignedCards.length - 30} MORE
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            <div style={{ position: 'absolute', bottom: 0, left: 0, height: '8px', background: bluffResult.wasBluff ? '#ef4444' : '#10b981', width: '100%', opacity: 0.3 }}>
              <motion.div
                initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: 4, ease: 'linear' }}
                style={{ height: '100%', background: '#fff', position: 'absolute', right: 0 }}
              />
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
            {!isSpectator ? (
              <>
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
              </>
            ) : (
              <p style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: 700, margin: 0, fontStyle: 'italic' }}>
                YOU ARE SPECTATING THIS MATCH
              </p>
            )}
            {isPickingPhase && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="dot-live" style={{ width: 12, height: 12, background: '#ef4444' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff', letterSpacing: '0.1em' }}>RESOLUTION...</span>
              </div>
            )}
            {isHost && !isEnded && (
              <button
                onClick={closeGame}
                style={{
                  color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)',
                  fontSize: '0.8rem', fontWeight: 900, padding: '8px 16px',
                  cursor: 'pointer', border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px', marginLeft: 10, textTransform: 'uppercase'
                }}
              >
                CLOSE
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
