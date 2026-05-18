import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../../components/common/Toast';
import { useGameStore } from '../store/useGameStore';
import Card from '../components/Card';
import DealAnimation from '../components/DealAnimation';
import Avatar, { TrophyIcon, TrashIcon, MaskIcon } from '../../../components/common/Icons';
import MoveAnimation from '../components/MoveAnimation';
import FloatingAction from '../../../components/common/FloatingAction';
import ChatBubble from '../../../components/common/ChatBubble';
import ChatInput from '../../../components/common/ChatInput';
import AvatarDisplay from '../../../components/common/AvatarDisplay';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

const GET_SEATS = (isPortrait, numOpponents) => {
  if (!isPortrait) {
    // Symmetrical landscape layouts relative to the table container bounds
    if (numOpponents === 1) {
      return [
        { top: '8%', left: '50%', transform: 'translateX(-50%) scale(0.95)' }
      ];
    }
    if (numOpponents === 2) {
      return [
        { top: '45%', left: '2%', transform: 'translateY(-50%) scale(0.95)' },
        { top: '45%', right: '2%', transform: 'translateY(-50%) scale(0.95)' }
      ];
    }
    if (numOpponents === 3) {
      return [
        { top: '45%', left: '2%', transform: 'translateY(-50%) scale(0.95)' },
        { top: '8%', left: '50%', transform: 'translateX(-50%) scale(0.95)' },
        { top: '45%', right: '2%', transform: 'translateY(-50%) scale(0.95)' }
      ];
    }
    if (numOpponents === 4) {
      return [
        { top: '45%', left: '2%', transform: 'translateY(-50%) scale(0.9)' },
        { top: '8%', left: '30%', transform: 'translateX(-50%) scale(0.9)' },
        { top: '8%', right: '30%', transform: 'translateX(50%) scale(0.9)' },
        { top: '45%', right: '2%', transform: 'translateY(-50%) scale(0.9)' }
      ];
    }
    if (numOpponents === 5) {
      return [
        { top: '55%', left: '2%', transform: 'translateY(-50%) scale(0.85)' },
        { top: '22%', left: '2%', transform: 'translateY(-50%) scale(0.85)' },
        { top: '8%', left: '50%', transform: 'translateX(-50%) scale(0.85)' },
        { top: '22%', right: '2%', transform: 'translateY(-50%) scale(0.85)' },
        { top: '55%', right: '2%', transform: 'translateY(-50%) scale(0.85)' }
      ];
    }
    if (numOpponents === 6) {
      return [
        { top: '55%', left: '2%', transform: 'translateY(-50%) scale(0.85)' },
        { top: '22%', left: '2%', transform: 'translateY(-50%) scale(0.85)' },
        { top: '8%', left: '30%', transform: 'translateX(-50%) scale(0.85)' },
        { top: '8%', right: '30%', transform: 'translateX(50%) scale(0.85)' },
        { top: '22%', right: '2%', transform: 'translateY(-50%) scale(0.85)' },
        { top: '55%', right: '2%', transform: 'translateY(-50%) scale(0.85)' }
      ];
    }
    if (numOpponents === 7) {
      return [
        { top: '65%', left: '2%', transform: 'translateY(-50%) scale(0.8)' },
        { top: '38%', left: '2%', transform: 'translateY(-50%) scale(0.8)' },
        { top: '15%', left: '8%', transform: 'translate(-50%, -50%) scale(0.8)' },
        { top: '8%', left: '50%', transform: 'translateX(-50%) scale(0.8)' },
        { top: '15%', right: '8%', transform: 'translate(50%, -50%) scale(0.8)' },
        { top: '38%', right: '2%', transform: 'translateY(-50%) scale(0.8)' },
        { top: '65%', right: '2%', transform: 'translateY(-50%) scale(0.8)' }
      ];
    }
    if (numOpponents === 8) {
      return [
        { top: '70%', left: '2%', transform: 'translateY(-50%) scale(0.8)' },
        { top: '42%', left: '2%', transform: 'translateY(-50%) scale(0.8)' },
        { top: '18%', left: '2%', transform: 'translateY(-50%) scale(0.8)' },
        { top: '8%', left: '30%', transform: 'translateX(-50%) scale(0.8)' },
        { top: '8%', right: '30%', transform: 'translateX(50%) scale(0.8)' },
        { top: '18%', right: '2%', transform: 'translateY(-50%) scale(0.8)' },
        { top: '42%', right: '2%', transform: 'translateY(-50%) scale(0.8)' },
        { top: '70%', right: '2%', transform: 'translateY(-50%) scale(0.8)' }
      ];
    }

    // Mathematical fallback for 9 or more opponents (distribute along top elliptical perimeter)
    const fallbackSeats = [];
    const minAngle = 190 * Math.PI / 180;
    const maxAngle = 350 * Math.PI / 180;
    for (let i = 0; i < numOpponents; i++) {
      const angle = minAngle + (i * (maxAngle - minAngle) / (numOpponents - 1 || 1));
      const x = 50 + 44 * Math.cos(angle);
      const y = 50 + 38 * Math.sin(angle);
      fallbackSeats.push({
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%) scale(0.7)'
      });
    }
    return fallbackSeats;
  }

  // Symmetrical portrait layouts relative to the table container bounds
  const playerOff = -80; // top offset
  const sideOff = -45;   // side offset

  if (numOpponents === 1) {
    return [
      { top: playerOff, left: '50%', transform: 'translateX(-50%) scale(0.9)' }
    ];
  }
  if (numOpponents === 2) {
    return [
      { top: '50%', left: sideOff, transform: 'translateY(-50%) scale(0.9)' },
      { top: '50%', right: sideOff, transform: 'translateY(-50%) scale(0.9)' }
    ];
  }
  if (numOpponents === 3) {
    // 3 opponents (4-player standard): Left, Top, Right. Matches second image perfectly!
    return [
      { top: '50%', left: sideOff, transform: 'translateY(-50%) scale(0.9)' },
      { top: playerOff, left: '50%', transform: 'translateX(-50%) scale(0.9)' },
      { top: '50%', right: sideOff, transform: 'translateY(-50%) scale(0.9)' }
    ];
  }
  if (numOpponents === 4) {
    return [
      { top: '25%', left: sideOff, transform: 'translateY(-50%) scale(0.85)' },
      { top: '75%', left: sideOff, transform: 'translateY(-50%) scale(0.85)' },
      { top: '25%', right: sideOff, transform: 'translateY(-50%) scale(0.85)' },
      { top: '75%', right: sideOff, transform: 'translateY(-50%) scale(0.85)' }
    ];
  }
  if (numOpponents === 5) {
    return [
      { top: '25%', left: sideOff, transform: 'translateY(-50%) scale(0.8)' },
      { top: '75%', left: sideOff, transform: 'translateY(-50%) scale(0.8)' },
      { top: playerOff, left: '50%', transform: 'translateX(-50%) scale(0.8)' },
      { top: '25%', right: sideOff, transform: 'translateY(-50%) scale(0.8)' },
      { top: '75%', right: sideOff, transform: 'translateY(-50%) scale(0.8)' }
    ];
  }
  // 6 or more
  return [
    { top: playerOff, left: '50%', transform: 'translateX(-50%) scale(0.75)' },
    { top: '20%', left: sideOff, transform: 'translateY(-50%) scale(0.75)' },
    { top: '50%', left: sideOff, transform: 'translateY(-50%) scale(0.75)' },
    { top: '80%', left: sideOff, transform: 'translateY(-50%) scale(0.75)' },
    { top: '20%', right: sideOff, transform: 'translateY(-50%) scale(0.75)' },
    { top: '50%', right: sideOff, transform: 'translateY(-50%) scale(0.75)' },
    { top: '80%', right: sideOff, transform: 'translateY(-50%) scale(0.75)' }
  ];
};

export default function GameBoard() {
  const {
    gameState, playerId, bluffToast,
    selectedCards, toggleCard, playCards, callBluff, pickBluffCard, selectBluffCard,
    passTurn, kickPlayer, restartGame, closeGame, disconnect, chatMessages,
  } = useGameStore();

  const getMsgs = (pid) => chatMessages.filter(m => m.senderId === pid);

  const [dealDone, setDealDone] = useState(gameState?.state !== 'DEALING');
  const [declaredRank, setDeclaredRank] = useState('A');
  const [timeLeft, setTimeLeft] = useState(60);

  const { w } = useWindowSize();
  const isPortrait = w < 640 || window.innerHeight > window.innerWidth;

  const [showMobileHand, setShowMobileHand] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState(null);
  const [floatingAction, setFloatingAction] = useState(null);

  const lastAnimatedMoveKey = useRef(null);
  const lastBluffResultKey = useRef(null);

  const seatedPlayers = useMemo(() => {
    if (!gameState?.players || !playerId) return [];
    const players = gameState.players;
    const myIndex = players.findIndex(p => p.id === playerId);
    if (myIndex === -1) return players.filter(p => p.id !== playerId);
    const rotated = [...players.slice(myIndex), ...players.slice(0, myIndex)];
    return rotated.filter(p => p.id !== playerId);
  }, [gameState?.players, playerId]);

  const SEATS = useMemo(() => GET_SEATS(isPortrait, seatedPlayers.length), [isPortrait, seatedPlayers.length]);

  useEffect(() => {
    if (!gameState?.lastMove) return;
    const { playerId: moverId, count, type, playerName } = gameState.lastMove;
    const moveKey = `${moverId}:${type}:${count}:${playerName}`;
    if (moveKey === lastAnimatedMoveKey.current) return;
    lastAnimatedMoveKey.current = moveKey;

    const isMe = moverId === playerId;
    const seatIdx = seatedPlayers.findIndex(p => p.id === moverId);
    if (!isMe && seatIdx === -1) return;

    const playerOff = -80;
    const fromPos = isMe
      ? (isPortrait ? { bottom: playerOff, left: '50%', transform: 'translateX(-50%) scale(0.8)' } : { bottom: '120px', left: '50%', transform: 'translateX(-50%)' })
      : SEATS[seatIdx % SEATS.length];
    const toPos = isPortrait
      ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
      : { top: '44%', left: '50%', transform: 'translate(-50%, -50%)' };

    if (type === 'PASS') {
      setFloatingAction({
        from: fromPos,
        to: toPos,
        text: `${playerName} Passed Turn`,
        type: 'PASS',
      });
    } else {
      setActiveAnimation({ from: fromPos, to: toPos, count: count || 1 });
      setFloatingAction({
        from: fromPos,
        to: toPos,
        text: `${playerName} Played ${count} Cards`,
        type: 'PLAY',
      });
    }
  }, [gameState?.lastMove, playerId, seatedPlayers, SEATS, isPortrait]);

  useEffect(() => {
    if (!gameState?.bluffResult) return;
    const br = gameState.bluffResult;
    const key = `${br.pickerId}:${br.targetId}:${br.pickedCard}`;
    if (key === lastBluffResultKey.current) return;
    lastBluffResultKey.current = key;

    const cardRank = br.pickedCard?.split('_')[1] || '?';
    if (br.wasBluff) {
      toast.error(`🎭 EXPOSED! ${br.targetName} lied — card was not a ${cardRank}. They take ${br.pileCount} cards!`, { duration: 5000 });
    } else {
      toast.success(`✅ HONEST MOVE! ${br.targetName}'s card was ${br.pickedCard?.replace('_', ' of ')}. ${br.pickerName} takes ${br.pileCount} cards!`, { duration: 5000 });
    }

    const loserId = br.loserId;
    const isMe = loserId === playerId;
    const seatIdx = seatedPlayers.findIndex(p => p.id === loserId);
    if (isMe || seatIdx !== -1) {
      const playerOff = -80;
      const toPos = isMe
        ? (isPortrait ? { bottom: playerOff, left: '50%', transform: 'translateX(-50%) scale(0.8)' } : { bottom: '120px', left: '50%', transform: 'translateX(-50%)' })
        : SEATS[seatIdx % SEATS.length];
      setActiveAnimation({
        from: isPortrait
          ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
          : { top: '44%', left: '50%', transform: 'translate(-50%, -50%)' },
        to: toPos,
        count: Math.min(br.pileCount, 5),
      });
    }
  }, [gameState?.bluffResult, playerId, seatedPlayers, SEATS, isPortrait]);

  useEffect(() => {
    if (gameState?.roundRank) setDeclaredRank(gameState.roundRank);
  }, [gameState?.roundRank]);

  useEffect(() => {
    if (!gameState?.turnStartTime || gameState.state === 'WAITING' || gameState.state === 'ENDED') return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - gameState.turnStartTime) / 1000);
      const isPicking = gameState.state === 'BLUFF_PICKING';
      const limit = isPicking ? 20 : (gameState.timerDuration || 60);
      setTimeLeft(Math.max(0, limit - elapsed));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [gameState?.turnStartTime, gameState?.state]);

  if (!gameState) return null;

  const {
    players, hands, pile, sidePile, currentTurn, lastMove, state,
    hostId, roundRank, ranking, bluffPickerId, bluffSelectIdx, bluffResult,
    roomId: serverRoomId, isSpectator,
  } = gameState;

  const myHand = (() => {
    const rawHand = hands?.[playerId] ?? [];
    return [...rawHand].sort((a, b) => {
      const rA = a.includes('_') ? a.split('_')[1] : 'X';
      const rB = b.includes('_') ? b.split('_')[1] : 'X';
      return RANKS.indexOf(rA) - RANKS.indexOf(rB);
    });
  })();

  const myInfo = players.find(p => p.id === playerId);
  const isHost = hostId === playerId;
  const isMyTurn = currentTurn === playerId;
  const isPickingPhase = state === 'BLUFF_PICKING';
  const isEnded = state === 'ENDED';
  const isResolution = state === 'ROUND_RESOLUTION';

  const totalPileCards = pile?.reduce((s, m) => s + (m.count || 0), 0) || 0;
  const currentPlayer = players.find(p => p.id === currentTurn);
  const bluffPicker = players.find(p => p.id === bluffPickerId);

  const handlePlay = () => {
    if (selectedCards.length === 0) return toast.error('Select cards to play');
    playCards(declaredRank);
  };

  const getRankPos = (pId) => {
    const r = ranking.find(rank => rank.id === pId);
    return r ? r.rankPos : null;
  };

  const canPass = isMyTurn && !isPickingPhase && !isEnded && pile.length > 0 && roundRank;
  const canCallBluff = isMyTurn && !isPickingPhase && !isEnded && pile.length > 0;

  const playerOff = -80;

  return (
    <div style={{
      height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative',
      background: isPortrait ? '#0a0515' : 'var(--bg)',
      display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif"
    }}>

      {/* ── Mobile Background Glow Overlay ── */}
      {isPortrait && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 50% 26%, #1a0a3a 0%, transparent 60%)',
          opacity: 0.45, pointerEvents: 'none', zIndex: 1
        }} />
      )}

      {/* ── Deal Animation ── */}
      {!dealDone && state === 'DEALING' && (
        <DealAnimation players={players} onComplete={() => setDealDone(true)} />
      )}

      {/* ── TOP HEADER ── */}
      <div style={{
        height: isPortrait ? 48 : 60, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: isPortrait ? '0 12px' : '0 24px', zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'absolute', top: 0, left: 0, right: 0
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '0.15em' }}>THE BLUFF</span>
          <span style={{ fontSize: isPortrait ? '0.7rem' : '0.85rem', fontWeight: 700, color: '#94a3b8' }}>
            Room <span style={{ color: '#fff', opacity: 0.9 }}>{serverRoomId}</span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {roundRank && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ padding: '4px 10px', borderRadius: 8, border: '1.5px solid #f59e0b', background: 'rgba(245,158,11,0.1)' }}>
              <span style={{ fontSize: '0.5rem', color: '#f59e0b', fontWeight: 900, textTransform: 'uppercase' }}>RANK: </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff' }}>{roundRank}</span>
            </motion.div>
          )}

          {currentPlayer && !isEnded && !isPickingPhase && !isResolution && (
            <div style={{
              padding: '4px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: '6px',
              border: isMyTurn ? '1.5px solid var(--secondary)' : '1px solid rgba(255,255,255,0.1)',
              background: isMyTurn ? 'rgba(8,145,178,0.15)' : 'rgba(0,0,0,0.2)',
            }}>
              <div style={{ position: 'relative', width: '18px', height: '18px' }}>
                <svg style={{ transform: 'rotate(-90deg)', width: '18px', height: '18px' }}>
                  <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                  <circle cx="9" cy="9" r="7" fill="none"
                    stroke={timeLeft < 10 ? '#ef4444' : 'var(--secondary)'} strokeWidth="2"
                    strokeDasharray="44"
                    strokeDashoffset={44 - (44 * timeLeft / (isPickingPhase ? 20 : (gameState.timerDuration || 60)))} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.45rem', fontWeight: 900 }}>
                  {timeLeft}
                </div>
              </div>
              <span style={{ fontWeight: 800, color: isMyTurn ? '#fff' : '#9ca3af', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                {isMyTurn ? 'YOUR TURN' : currentPlayer.name.toUpperCase()}
              </span>
            </div>
          )}

          <button className="btn btn-red btn-sm" onClick={disconnect} style={{ width: 'auto', padding: '6px 10px', fontSize: '0.7rem' }}>EXIT</button>
        </div>
      </div>

      {/* ── MAIN PLAY AREA CONTAINER ── */}
      <div style={{
        flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isPortrait ? '10px 16px' : '20px 60px 20px 240px', minHeight: 0
      }}>

        {/* ── Felt Table Container ── */}
        <div style={{
          width: isPortrait ? '85vw' : '75vw',
          aspectRatio: isPortrait ? '3/2' : '2.2/1',
          maxWidth: '900px', maxHeight: '420px', zIndex: 5,
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Table Surface Shape */}
          <div className="felt-table" style={{
            position: 'absolute', inset: 0,
            borderRadius: isPortrait ? '120px' : '200px',
            background: isPortrait ? 'linear-gradient(180deg, #2b1255 0%, #160a2a 100%)' : 'radial-gradient(ellipse at center, var(--felt-light) 0%, var(--felt-mid) 40%, var(--felt) 70%, #010b13 100%)',
            border: isPortrait ? '5px solid #1c0e35' : '8px solid #005f73',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8), 0 30px 100px rgba(0,0,0,0.6)',
            zIndex: 1,
          }}>
            {/* Inner Border Line */}
            <div style={{
              position: 'absolute', inset: isPortrait ? 8 : 15,
              borderRadius: isPortrait ? '112px' : '185px',
              border: '1px dashed rgba(255,255,255,0.1)',
              pointerEvents: 'none',
            }} />
          </div>

          {/* Grid of central deck, pile, and details */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', alignItems: 'center',
            width: '100%', padding: isPortrait ? '0 12px' : '0 30px', zIndex: 5,
          }}>
            {/* Left: Last Play details */}
            <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
              {lastMove && lastMove.type !== 'PASS' && (
                <div className="panel-sm" style={{
                  padding: isPortrait ? '2px 5px' : '4px 8px',
                  background: 'rgba(0,0,0,0.65)',
                  border: '1px solid rgba(103,232,249,0.4)',
                  borderRadius: '8px', display: 'inline-block',
                }}>
                  <p style={{ margin: 0, fontSize: isPortrait ? '0.45rem' : '0.55rem', fontWeight: 900, color: 'var(--primary-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {lastMove.playerName}
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: isPortrait ? '0.65rem' : '0.8rem', fontWeight: 900, color: '#fff' }}>
                    {lastMove.count} CARDS
                  </p>
                  <p style={{ margin: 0, fontSize: isPortrait ? '0.45rem' : '0.6rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>
                    OF {lastMove.declaredRank}
                  </p>
                </div>
              )}
            </div>

            {/* Center: Main Pile cards */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 10 }}>
              <div style={{ position: 'relative', width: isPortrait ? '45px' : '65px', height: isPortrait ? '62px' : '95px' }}>
                {totalPileCards > 0 ? (
                  [...Array(Math.min(6, totalPileCards))].map((_, i) => (
                    <div key={i} style={{
                      position: 'absolute', inset: 0, borderRadius: '6px',
                      background: 'linear-gradient(135deg, #0e3a46, #06202a)',
                      border: '1px solid rgba(103,232,249,0.3)', zIndex: i,
                      transform: `translate(${(i - 3) * 1.2}px, ${(i - 3) * 1}px) rotate(${(i - 3) * 2.5}deg)`,
                      boxShadow: '0 3px 10px rgba(0,0,0,0.5)',
                    }} />
                  ))
                ) : (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '6px', border: '1.5px dashed rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '0.5rem', fontWeight: 900 }}>EMPTY</span>
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.5rem', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>PILE</p>
                <p style={{ fontSize: isPortrait ? '1.2rem' : '1.8rem', fontWeight: 900, color: '#fff', lineHeight: 1, margin: 0 }}>{totalPileCards}</p>
              </div>
            </div>

            {/* Right: Side Pile/Discard pile */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: sidePile.length > 0 ? 0.9 : 0.25, zIndex: 10 }}>
              <div style={{ position: 'relative', width: isPortrait ? '30px' : '42px', height: isPortrait ? '30px' : '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 6, transform: 'rotate(10deg)', background: 'rgba(255,255,255,0.03)' }}>
                <TrashIcon size={isPortrait ? 12 : 20} color="#fff" />
              </div>
              <p style={{ fontSize: '0.5rem', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, textAlign: 'center' }}>
                SIDE<br />{sidePile.length}
              </p>
            </div>
          </div>

          {/* ── Table-based Opponents Map on Mobile view ── */}
          {isPortrait && seatedPlayers.map((player, i) => {
            const pos = SEATS[i % SEATS.length];
            const isActive = currentTurn === player.id;
            const hc = player.cardCount;
            const winRank = getRankPos(player.id);
            const playerWinner = !!winRank;

            // Separate transform from positioning styles to prevent Framer Motion from overwriting translation
            const { transform, ...positionStyles } = pos;

            return (
              <div
                key={player.id}
                style={{
                  position: 'absolute',
                  zIndex: isActive ? 20 : 10,
                  transform,
                  ...positionStyles,
                }}
              >
                <motion.div
                  initial={false}
                  animate={{ scale: isActive ? 0.85 : 0.7 }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {/* Avatar Display */}
                  <div style={{ position: 'relative', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isActive && (
                      <motion.div
                        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        style={{
                          position: 'absolute', inset: -4, borderRadius: '50%',
                          background: 'radial-gradient(circle, var(--primary) 66%, transparent 70%)',
                          border: '2px solid var(--primary-light)',
                          boxShadow: '0 0 15px var(--shadow-p)', zIndex: -1,
                        }}
                      />
                    )}
                    <AvatarDisplay avatarId={player.avatar} playerName={player.name} size={34} animated={isActive} />
                    {player.id === hostId && (
                      <div style={{ position: 'absolute', top: -8, right: -8, fontSize: '0.75rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>👑</div>
                    )}
                  </div>

                  {/* Player details tag */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    background: 'rgba(10,5,20,0.8)', backdropFilter: 'blur(8px)',
                    border: `1.5px solid ${isActive ? 'var(--primary-light)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 14, padding: '4px 10px', minWidth: 78, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#fff', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                      {player.name.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.05em', color: hc === 0 ? '#f59e0b' : 'var(--muted)', textTransform: 'uppercase', lineHeight: 1.1 }}>
                      {hc === 0 ? 'WINNER' : `${hc} CARDS`}
                    </span>

                    {isHost && !playerWinner && (
                      <button
                        onClick={() => kickPlayer(player.id)}
                        style={{ position: 'absolute', top: -2, right: -2, background: '#ef4444', color: '#fff', width: 14, height: 14, borderRadius: '50%', fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, border: '1px solid #000', cursor: 'pointer', zIndex: 10 }}
                      >✕</button>
                    )}

                    {playerWinner && (
                      <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(0,0,0,0.85)', borderRadius: 'inherit',
                          border: '1.5px solid #f59e0b', backdropFilter: 'blur(4px)',
                        }}
                      >
                        <TrophyIcon size={14} />
                        <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#f59e0b' }}>#{winRank}</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Floating chat messages bubbles */}
                  <div style={{ position: 'absolute', top: '-50px', left: '50%', transform: 'translateX(-50%)', width: '100%', pointerEvents: 'none' }}>
                    <ChatBubble messages={getMsgs(player.id)} isMe={false} position="top" />
                  </div>

                  {/* Opponent mini card fan backs */}
                  {!playerWinner && hc > 0 && (
                    <div style={{ position: 'relative', height: '28px', width: '100%', display: 'flex', justifyContent: 'center', marginTop: 1 }}>
                      {[...Array(Math.min(hc, 5))].map((_, ci) => (
                        <div key={ci} className="face-down-card" style={{
                          width: '20px', height: '30px', left: '50%', marginLeft: '-10px',
                          transform: `translateX(${(ci - 2) * 8}px) rotate(${(ci - 2) * 4}deg)`, zIndex: ci,
                        }} />
                      ))}
                      {hc > 5 && (
                        <div style={{ position: 'absolute', right: '-10px', top: 0, fontSize: '.5rem', fontWeight: 900, color: '#9ca3af' }}>+{hc - 5}</div>
                      )}
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}

          {/* ── Table-based Active Player Circle ("You") ── */}
          {isPortrait && !isSpectator && (
            <div style={{ position: 'absolute', bottom: playerOff, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
              <motion.div
                initial={false}
                animate={{ scale: isMyTurn ? 0.95 : 0.8 }}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: '4px',
                }}
              >
                {/* Active Glow */}
                <div style={{ position: 'relative', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isMyTurn && (
                    <motion.div
                      animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      style={{
                        position: 'absolute', inset: -4, borderRadius: '50%',
                        background: 'radial-gradient(circle, var(--primary) 66%, transparent 70%)',
                        border: '2px solid var(--primary-light)',
                        boxShadow: '0 0 15px var(--shadow-p)', zIndex: -1,
                      }}
                    />
                  )}
                  <AvatarDisplay avatarId={myInfo?.avatar} playerName={myInfo?.name || 'You'} size={34} animated={isMyTurn} />
                  {playerId === hostId && (
                    <div style={{ position: 'absolute', top: -8, right: -8, fontSize: '0.75rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>👑</div>
                  )}
                </div>

                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: 'rgba(10,5,20,0.8)', backdropFilter: 'blur(8px)',
                  border: `1.5px solid ${isMyTurn ? 'var(--primary-light)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14, padding: '4px 10px', minWidth: 78, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#fff', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                    YOU
                  </span>
                  <span style={{ fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--muted)', textTransform: 'uppercase', lineHeight: 1.1 }}>
                    {myHand.length} CARDS
                  </span>

                  {getRankPos(playerId) && (
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.85)', borderRadius: 'inherit',
                        border: '1.5px solid #f59e0b', backdropFilter: 'blur(4px)',
                      }}
                    >
                      <TrophyIcon size={14} />
                      <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#f59e0b' }}>#{getRankPos(playerId)}</span>
                    </motion.div>
                  )}
                </div>

                {/* My Chat bubble */}
                <div style={{ position: 'absolute', top: '-50px', left: '50%', transform: 'translateX(-50%)', width: '100%', pointerEvents: 'none' }}>
                  <ChatBubble messages={getMsgs(playerId)} isMe={true} position="top" />
                </div>
              </motion.div>
            </div>
          )}

          {/* ── Card Movement & Floating text animations inside table container on portrait ── */}
          {isPortrait && (
            <>
              <MoveAnimation
                fromPos={activeAnimation?.from}
                toPos={activeAnimation?.to}
                count={activeAnimation?.count}
                onComplete={() => setActiveAnimation(null)}
              />
              <FloatingAction
                fromPos={floatingAction?.from}
                toPos={floatingAction?.to}
                text={floatingAction?.text}
                type={floatingAction?.type}
                onComplete={() => setFloatingAction(null)}
              />
            </>
          )}

        </div>
      </div>

      {/* ── Table-based Opponents Map on Desktop view (Direct children, original layout) ── */}
      {!isPortrait && seatedPlayers.map((player, i) => {
        const pos = SEATS[i % SEATS.length];
        const isActive = currentTurn === player.id;
        const hc = player.cardCount;
        const winRank = getRankPos(player.id);
        const playerWinner = !!winRank;

        // Separate transform from positioning styles to prevent Framer Motion from overwriting translation
        const { transform, ...positionStyles } = pos;

        return (
          <div
            key={player.id}
            style={{
              position: 'absolute',
              zIndex: isActive ? 20 : 10,
              transform,
              ...positionStyles,
            }}
          >
            <motion.div
              initial={false}
              animate={{ scale: isActive ? 1.05 : 0.85 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <div className={`panel-sm${isActive ? ' active-pulse' : ''}`} style={{
                padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '90px',
                border: isActive ? '2.5px solid var(--secondary)' : '1.5px solid rgba(255,255,255,0.08)',
                background: isActive ? 'rgba(8,145,178,0.3)' : 'rgba(255,255,255,0.04)',
                boxShadow: isActive ? '0 0 25px rgba(8,145,178,0.4)' : 'none',
                position: 'relative', overflow: 'hidden',
              }}>
                <AvatarDisplay avatarId={player.avatar} playerName={player.name} size={28} animated={true} />
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <p style={{ fontSize: '0.65rem', fontWeight: 900, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '65px' }}>
                    {player.name.toUpperCase()}
                  </p>
                  {!playerWinner && (
                    <p style={{
                      fontSize: '0.55rem',
                      color: hc === 0 ? '#f59e0b' : '#6b7280',
                      fontWeight: 800, margin: 0,
                      animation: hc === 0 ? 'pulse 1s infinite' : 'none'
                    }}>
                      {hc === 0 ? 'WINNER PENDING...' : `${hc} CARDS`}
                    </p>
                  )}
                  {playerWinner && (
                    <p style={{ fontSize: '0.55rem', color: '#f59e0b', fontWeight: 900, margin: 0 }}>FINISHED #{winRank}</p>
                  )}
                </div>
                {isHost && !playerWinner && (
                  <button
                    onClick={() => kickPlayer(player.id)}
                    style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', width: 18, height: 18, borderRadius: '50%', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, border: '2px solid #000', cursor: 'pointer', zIndex: 10 }}
                  >✕</button>
                )}
                {playerWinner && (
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.75)', borderRadius: 'inherit',
                      border: '2px solid #f59e0b',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <TrophyIcon size={22} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#f59e0b' }}>#{winRank}</span>
                  </motion.div>
                )}
              </div>

              <div style={{ position: 'absolute', top: '-58px', left: '50%', transform: 'translateX(-50%)', width: '100%', pointerEvents: 'none' }}>
                <ChatBubble messages={getMsgs(player.id)} isMe={false} position="top" />
              </div>

              {!playerWinner && hc > 0 && (
                <div style={{ position: 'relative', height: '32px', width: '100%', display: 'flex', justifyContent: 'center', marginTop: 1 }}>
                  {[...Array(Math.min(hc, 5))].map((_, ci) => (
                    <div key={ci} className="face-down-card" style={{
                      width: '22px', height: '34px', left: '50%', marginLeft: '-11px',
                      transform: `translateX(${(ci - 2) * 8}px) rotate(${(ci - 2) * 4}deg)`, zIndex: ci,
                    }} />
                  ))}
                  {hc > 5 && (
                    <div style={{ position: 'absolute', right: '-12px', top: 0, fontSize: '.55rem', fontWeight: 900, color: '#9ca3af' }}>+{hc - 5}</div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        );
      })}

      {/* ── Desktop Animations & Floating actions ── */}
      {!isPortrait && (
        <>
          <MoveAnimation
            fromPos={activeAnimation?.from}
            toPos={activeAnimation?.to}
            count={activeAnimation?.count}
            onComplete={() => setActiveAnimation(null)}
          />
          <FloatingAction
            fromPos={floatingAction?.from}
            toPos={floatingAction?.to}
            text={floatingAction?.text}
            type={floatingAction?.type}
            onComplete={() => setFloatingAction(null)}
          />
        </>
      )}

      {/* ── ACTION CONTROLS HUD (centered just above fanned cards on mobile) ── */}
      {isPortrait && !isSpectator && !isEnded && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
          padding: '4px 16px 12px', zIndex: 80, width: '100%', flexShrink: 0,
          marginTop: '-24px', // Shift up slightly to overlap beautifully with the bottom table area
        }}>
          {isMyTurn && !isPickingPhase && !isResolution && (
            <>
              {/* Rank selector only when starting new round */}
              {!roundRank && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: '0.45rem', fontWeight: 900, color: '#94a3b8', paddingLeft: 2 }}>DECLARE RANK</span>
                  <select
                    value={declaredRank}
                    onChange={e => setDeclaredRank(e.target.value)}
                    className="rank-select"
                    style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: 8, background: '#1c0e35', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                  >
                    {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {/* BLUFF button */}
              {canCallBluff && (
                <button
                  className="btn btn-red btn-sm"
                  onClick={callBluff}
                  style={{ padding: '8px 14px', fontWeight: 900, width: 'auto', fontSize: '0.7rem', borderRadius: 10 }}
                >
                  <MaskIcon size={12} /> BLUFF
                </button>
              )}

              {/* PLAY button */}
              <button
                className="btn btn-primary btn-sm"
                onClick={handlePlay}
                disabled={selectedCards.length === 0}
                style={{ padding: '8px 16px', opacity: selectedCards.length === 0 ? 0.35 : 1, width: 'auto', fontSize: '0.7rem', borderRadius: 10 }}
              >
                PLAY {selectedCards.length > 0 ? selectedCards.length : ''}
              </button>

              {/* PASS button */}
              {canPass && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={passTurn}
                  style={{ padding: '8px 14px', width: 'auto', fontSize: '0.7rem', borderRadius: 10 }}
                >
                  PASS
                </button>
              )}
            </>
          )}

          {!isMyTurn && !isResolution && (
            <div style={{ padding: '6px 16px', borderRadius: 10, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.05em' }}>
                {state === 'WAITING' ? 'WAITING FOR HOST' : 'WAITING FOR TURN...'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── BOTTOM HAND AREA (Portrait Viewport, scrollable and elegant fanning) ── */}
      {!isSpectator && isPortrait && (
        <div style={{
          height: 175, display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '0 6px 1px', zIndex: 100, flexShrink: 0, width: '100%',
        }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-start',
              width: '100%',
              paddingTop: 10,
              paddingBottom: 20,
              overflowX: 'auto',
              overflowY: 'hidden',
              touchAction: 'pan-x',
              paddingLeft: 16,
              paddingRight: 16,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              gap: 8,
            }}
            className="no-scrollbar"
          >
            {myHand.map((cardId, i) => {
              const selected = selectedCards.includes(cardId);
              const isLast = i === myHand.length - 1;
              return (
                <motion.div
                  key={`${cardId}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  style={{
                    marginRight: isLast ? 0 : -35,
                    zIndex: selected ? 100 : i,
                    position: 'relative',
                    flexShrink: 0,
                    cursor: isMyTurn ? 'pointer' : 'default',
                  }}
                  onClick={() => isMyTurn && !isPickingPhase && !isEnded && toggleCard(cardId)}
                >
                  <Card cardId={cardId} scale={0.8} />
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── My Hand on Desktop ── */}
      <AnimatePresence>
        {!isSpectator && !isPortrait && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'absolute', bottom: '120px', left: 0, right: 0,
              display: 'flex', justifyContent: 'center', zIndex: 40,
              pointerEvents: (isPickingPhase || isEnded || isResolution) ? 'none' : 'auto',
            }}
          >
            <div style={{
              position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              height: '180px', width: '95vw', maxWidth: '1200px', padding: '12px 0',
            }}>
              {myHand.map((cardId, i) => {
                const count = myHand.length;
                const cardWidth = 85;
                const containerWidth = Math.min(1100, window.innerWidth * 0.9);
                let overlap = 65;
                if (count > 1) {
                  const neededWidth = (count * 65) + 20;
                  if (neededWidth > containerWidth) {
                    overlap = (containerWidth - cardWidth) / (count - 1);
                  }
                }
                const totalWidth = overlap * (count - 1) + cardWidth;
                const startX = -totalWidth / 2 + cardWidth / 2;
                const tx = startX + (i * overlap);
                const selected = selectedCards.includes(cardId);

                return (
                  <motion.div
                    key={`${cardId}-${i}`}
                    layout
                    whileHover={{ y: selected ? -40 : -18, zIndex: 100 }}
                    style={{
                      position: 'absolute', left: '50%', bottom: '20px',
                      x: tx, y: selected ? -35 : 0,
                      zIndex: i, cursor: isMyTurn ? 'pointer' : 'default',
                      filter: selected ? 'drop-shadow(0 0 8px var(--secondary))' : 'none',
                    }}
                    onClick={() => isMyTurn && !isPickingPhase && !isEnded && toggleCard(cardId)}
                  >
                    <Card cardId={cardId} scale={1.05} index={i} />
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HUD (Bottom Bar) on Desktop ── */}
      {!isPortrait && (
        <div className="hud">
          <div style={{
            width: '100%', maxWidth: '900px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '16px', flexDirection: 'row',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
              <div style={{ position: 'relative' }}>
                <AvatarDisplay avatarId={myInfo?.avatar} playerName={myInfo?.name || '?'} size={32} animated={true} />
                {getRankPos(playerId) && (
                  <div style={{ position: 'absolute', inset: -3, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', borderRadius: '50%', border: '2px solid #f59e0b' }}>
                    <TrophyIcon size={10} />
                  </div>
                )}
                <ChatBubble messages={getMsgs(playerId)} isMe={true} position="bottom" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 900, color: '#fff', margin: 0, textTransform: 'uppercase' }}>
                  {myHand.length} CARDS
                </p>
                <p style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--secondary)', margin: 0 }}>{myInfo?.name}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', wrap: 'wrap', justifyContent: 'center' }}>
              {!isSpectator ? (
                <>
                  {isMyTurn && !isPickingPhase && !isEnded && !isResolution && (
                    <>
                      {!roundRank && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontSize: '0.45rem', fontWeight: 900, color: '#6b7280', paddingLeft: 2 }}>DECLARE RANK</span>
                          <select
                            value={declaredRank}
                            onChange={e => setDeclaredRank(e.target.value)}
                            className="rank-select"
                            style={{ padding: '5px 8px', fontSize: '0.75rem' }}
                          >
                            {RANKS.map(r => <option key={r} value={r} style={{ background: '#031015' }}>{r}</option>)}
                          </select>
                        </div>
                      )}

                      {canCallBluff && (
                        <button
                          className="btn btn-red btn-sm"
                          onClick={callBluff}
                          style={{ padding: '8px 12px', fontWeight: 900, width: 'auto', fontSize: '0.75rem' }}
                        >
                          <MaskIcon size={12} /> BLUFF
                        </button>
                      )}

                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handlePlay}
                        disabled={selectedCards.length === 0}
                        style={{ padding: '8px 16px', opacity: selectedCards.length === 0 ? 0.35 : 1, width: 'auto', fontSize: '0.75rem' }}
                      >
                        PLAY {selectedCards.length > 0 ? selectedCards.length : ''}
                      </button>

                      {canPass && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={passTurn}
                          style={{ padding: '8px 12px', width: 'auto', fontSize: '0.75rem' }}
                        >
                          PASS
                        </button>
                      )}
                    </>
                  )}

                  {!isMyTurn && !isEnded && !isPickingPhase && !isResolution && (
                    <p style={{ color: '#4b5563', fontSize: '0.7rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {state === 'WAITING' ? 'Waiting for Host' : 'Waiting for Turn...'}
                    </p>
                  )}
                </>
              ) : (
                <p style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 700, margin: 0, fontStyle: 'italic' }}>
                  SPECTATING
                </p>
              )}

              {isPickingPhase && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="dot-live" style={{ width: 8, height: 8, background: '#ef4444' }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#fff', letterSpacing: '0.08em' }}>BLUFF CHECK...</span>
                </div>
              )}

              {isHost && !isEnded && (
                <button
                  onClick={closeGame}
                  style={{
                    color: '#ef4444', background: 'rgba(239,68,68,0.1)',
                    fontSize: '0.65rem', fontWeight: 900, padding: '6px 12px', cursor: 'pointer',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', textTransform: 'uppercase',
                  }}
                >
                  CLOSE
                </button>
              )}

              {!isEnded && <ChatInput compact={true} />}
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Chat Input on portrait mobile ── */}
      {isPortrait && !isEnded && (
        <div style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 1000 }}>
          <ChatInput compact={true} />
        </div>
      )}

      {/* ── Bluff Picking Overlay ── */}
      <AnimatePresence>
        {isPickingPhase && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(5,5,15,0.96)', backdropFilter: 'blur(16px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px',
            }}
          >
            <MaskIcon size={48} />
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: isPortrait ? '1rem' : '1.4rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                {bluffPickerId === playerId
                  ? 'Pick a card to expose the bluff!'
                  : `${bluffPicker?.name?.toUpperCase()} IS DECIDING...`}
              </h2>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '6px 0 0', fontWeight: 700 }}>
                Targeting: <span style={{ color: '#f59e0b', fontWeight: 900 }}>
                  {players.find(p => p.id === gameState.bluffTargetId)?.name || '...'}
                </span>
              </p>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: timeLeft < 6 ? '#ef4444' : 'var(--secondary)', marginTop: 6 }}>{timeLeft}s</div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', padding: '0 20px', maxWidth: '700px' }}>
              {pile[pile.length - 1]?.cards?.map((_, idx) => {
                const isSelected = bluffSelectIdx === idx;
                return (
                  <motion.div
                    key={idx}
                    animate={{ scale: isSelected ? 1.1 : 1, y: isSelected ? -14 : 0 }}
                    onMouseEnter={() => bluffPickerId === playerId && selectBluffCard(idx)}
                    onMouseLeave={() => bluffPickerId === playerId && selectBluffCard(null)}
                    onClick={() => bluffPickerId === playerId && pickBluffCard(idx)}
                    style={{
                      cursor: bluffPickerId === playerId ? 'pointer' : 'default',
                      filter: isSelected ? 'drop-shadow(0 0 20px var(--secondary))' : 'none',
                      border: isSelected ? '2.5px solid var(--secondary)' : '2px solid transparent',
                      borderRadius: '10px', transition: 'border 0.15s',
                    }}
                  >
                    <Card cardId="X" faceDown={true} scale={isPortrait ? 0.8 : 1} />
                  </motion.div>
                );
              }) || <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>Waiting for cards...</p>}
            </div>

            <p style={{ color: 'var(--secondary)', fontWeight: 900, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {bluffPickerId === playerId ? 'SELECT A CARD NOW!' : 'Waiting for decision...'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bluff Result / Resolution ── */}
      <AnimatePresence>
        {isResolution && bluffResult && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(5,5,15,0.98)', backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '16px',
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{
                fontSize: isPortrait ? '1.6rem' : '2.5rem', fontWeight: 900,
                color: bluffResult.wasBluff ? '#ef4444' : '#10b981',
                textTransform: 'uppercase', letterSpacing: '0.15em', textAlign: 'center',
                textShadow: bluffResult.wasBluff ? '0 0 40px rgba(239,68,68,0.5)' : '0 0 40px rgba(16,185,129,0.5)',
              }}
            >
              {bluffResult.wasBluff ? '🎭 BLUFF CAUGHT!' : '✅ HONEST MOVE!'}
            </motion.div>

            <motion.div
              initial={{ scale: 0.5, rotateY: 180 }}
              animate={{ scale: 1.1, rotateY: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 100 }}
              style={{ filter: 'drop-shadow(0 0 30px rgba(8,145,178,0.6))' }}
            >
              <Card cardId={bluffResult.pickedCard} scale={isPortrait ? 1 : 1.2} />
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              style={{ textAlign: 'center' }}>
              <p style={{ fontSize: isPortrait ? '0.9rem' : '1.2rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                {bluffResult.wasBluff
                  ? <><span style={{ color: '#ef4444' }}>{bluffResult.targetName}</span> was lying!</>
                  : <><span style={{ color: '#10b981' }}>{bluffResult.targetName}</span> was honest!</>}
              </p>
              <p style={{ fontSize: isPortrait ? '0.75rem' : '1rem', color: '#f59e0b', fontWeight: 900, margin: '6px 0 0' }}>
                +{bluffResult.pileCount} cards → {bluffResult.loserId === playerId ? 'YOU' :
                  players.find(p => p.id === bluffResult.loserId)?.name?.toUpperCase()}
              </p>
            </motion.div>

            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}
              style={{ display: 'flex', overflowX: 'auto', gap: '5px', padding: '80px', justifyContent: 'center', scrollbarWidth: 'none', maxWidth: '85vw' }}
              className="no-scrollbar"
            >
              {bluffResult.assignedCards?.slice(0, 24).map((cId, idx) => (
                <div key={idx} style={{ flexShrink: 0, marginLeft: idx > 0 ? -11 : 0 }}>
                  <Card cardId={cId} faceDown={cId !== bluffResult.pickedCard} scale={0.55} />
                </div>
              ))}
              {bluffResult.assignedCards?.length > 24 && (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 8px', color: '#6b7280', fontWeight: 900 }}>
                  +{bluffResult.assignedCards.length - 24}
                </div>
              )}
            </motion.div>

            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '5px', background: 'rgba(255,255,255,0.05)' }}>
              <motion.div
                initial={{ width: '100%' }} animate={{ width: '0%' }}
                transition={{ duration: 4, ease: 'linear' }}
                style={{ height: '100%', background: bluffResult.wasBluff ? '#ef4444' : '#10b981' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Final Ranking / Game Over ── */}
      <AnimatePresence mode="wait">
        {isEnded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(5,5,15,0.98)', backdropFilter: 'blur(30px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px',
              overflowY: 'auto',
            }}
          >
            <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
              style={{ textAlign: 'center', marginBottom: 16 }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#ef4444', letterSpacing: '0.35em', marginBottom: 4 }}>GAME OVER</div>
              <h1 style={{ fontSize: isPortrait ? '1.5rem' : '2.2rem', fontWeight: 900, color: '#fff', margin: 0 }}>
                {ranking[ranking.length - 1]?.id === playerId
                  ? 'YOU LOST! 🤡'
                  : `${ranking[ranking.length - 1]?.name?.toUpperCase()} LOST! 🤡`}
              </h1>
            </motion.div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: '360px' }}>
              {ranking.map((res, i) => {
                const isLoser = i === ranking.length - 1;
                const isChamp = i === 0;
                return (
                  <motion.div
                    key={res.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.6 + (i * 0.1) }}
                    className="panel"
                    style={{
                      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                      border: isLoser ? '2px solid #ef4444' : isChamp ? '2.5px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                      background: isLoser ? 'rgba(239,68,68,0.1)' : isChamp ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.04)',
                      transform: isChamp ? 'scale(1.03)' : 'none',
                    }}
                  >
                    <span style={{ fontWeight: 900, fontSize: '1.1rem', width: 30, textAlign: 'center', color: isLoser ? '#ef4444' : isChamp ? '#f59e0b' : '#6b7280' }}>
                      {isLoser ? '💀' : isChamp ? '🏆' : `#${res.rankPos}`}
                    </span>
                    <AvatarDisplay avatarId={res.avatar} playerName={res.name} size={isPortrait ? 30 : 32} animated={false} />
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <p style={{ fontWeight: 900, fontSize: '0.85rem', color: '#fff', margin: 0 }}>{res.name.toUpperCase()}</p>
                      <p style={{ fontSize: '0.5rem', color: isLoser ? '#ef4444' : '#6b7280', fontWeight: 800, margin: 0 }}>
                        {isLoser ? 'LAST PLACE' : isChamp ? 'CHAMPION' : 'WELL PLAYED'}
                      </p>
                    </div>
                    {!isLoser && (isChamp ? <TrophyIcon size={22} /> : (i < 3 && <TrophyIcon size={16} />))}
                  </motion.div>
                );
              })}
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
              style={{ marginTop: 24, display: 'flex', gap: 10, flexDirection: isPortrait ? 'column' : 'row', alignItems: 'center' }}
            >
              {isHost && <button className="btn btn-primary" onClick={restartGame} style={{ padding: '12px 28px', fontSize: '0.85rem' }}>PLAY AGAIN</button>}
              <button className="btn btn-outline" onClick={disconnect} style={{ padding: '12px 28px', fontSize: '0.85rem' }}>EXIT LOUNGE</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Branding ── */}
      <div style={{ position: 'fixed', bottom: 4, right: 8, zIndex: 50, opacity: 0.25, pointerEvents: 'none' }}>
        <p style={{ color: '#fff', fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.1em', margin: 0 }}>
          © SHIVAM JAYSWAL
        </p>
      </div>

      <style>{`
        @keyframes blink {
          from { opacity: 1; } to { opacity: 0.6; }
        }
        .active-pulse {
          animation: pulse-border 2.2s infinite;
        }
        @keyframes pulse-border {
          0%   { box-shadow: 0 0 0 0 rgba(8, 145, 178, 0.7); }
          70%  { box-shadow: 0 0 0 14px rgba(8, 145, 178, 0); }
          100% { box-shadow: 0 0 0 0 rgba(8, 145, 178, 0); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
