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

const GET_SEATS = (isPortrait) => isPortrait ? [
  { top: '8%', left: '50%', transform: 'translateX(-50%) scale(0.7)' },
  { top: '18%', right: '3%', transform: 'translateY(-50%) scale(0.75)' },
  { top: '34%', right: '3%', transform: 'translateY(-50%) scale(0.75)' },
  { top: '50%', right: '3%', transform: 'translateY(-50%) scale(0.75)' },
  { top: '18%', left: '3%', transform: 'translateY(-50%) scale(0.75)' },
  { top: '34%', left: '3%', transform: 'translateY(-50%) scale(0.75)' },
  { top: '50%', left: '3%', transform: 'translateY(-50%) scale(0.75)' },
] : [
  { top: '10%', left: '50%', transform: 'translateX(-50%)' },
  { top: '18%', right: '1.5%' },
  { bottom: '20%', right: '1.5%' },
  { top: '18%', left: '1.5%' },
  { bottom: '20%', left: '1.5%' },
  { top: '10%', right: '12%' },
  { top: '10%', left: '12%' },
];

export default function GameBoard() {
  const {
    gameState, playerId, bluffToast,
    selectedCards, toggleCard, playCards, callBluff, pickBluffCard, selectBluffCard,
    passTurn, kickPlayer, restartGame, closeGame, disconnect, chatMessages,
  } = useGameStore();

  // Helper: get active chat messages for a specific player
  const getMsgs = (pid) => chatMessages.filter(m => m.senderId === pid);


  // ── ALL STATE AND REFS MUST COME BEFORE ANY CONDITIONAL RETURNS ──
  const [dealDone, setDealDone] = useState(gameState?.state !== 'DEALING');
  const [declaredRank, setDeclaredRank] = useState('A');
  const [timeLeft, setTimeLeft] = useState(60);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [showMobileHand, setShowMobileHand] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState(null);
  const [floatingAction, setFloatingAction] = useState(null);

  // FIX Bug 8: Track last animated move key to prevent re-triggering on every state sync
  const lastAnimatedMoveKey = useRef(null);
  // FIX Bug 6: Track last bluffResult we showed toast for
  const lastBluffResultKey = useRef(null);

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
    // Rotate so current player (me) is at bottom, others go clockwise
    const rotated = [...players.slice(myIndex), ...players.slice(0, myIndex)];
    return rotated.filter(p => p.id !== playerId);
  }, [gameState?.players, playerId]);

  // FIX Bug 8: Use stable move key to prevent animation re-firing on every state update
  useEffect(() => {
    if (!gameState?.lastMove) return;
    const { playerId: moverId, count, type, playerName } = gameState.lastMove;
    // Build a stable key for this move
    const moveKey = `${moverId}:${type}:${count}:${playerName}`;
    if (moveKey === lastAnimatedMoveKey.current) return;
    lastAnimatedMoveKey.current = moveKey;

    const isMe = moverId === playerId;
    const seatIdx = seatedPlayers.findIndex(p => p.id === moverId);
    // Only animate if it's me OR a player we can see in a seat
    if (!isMe && seatIdx === -1) return;

    const fromPos = isMe
      ? { bottom: '120px', left: '50%', transform: 'translateX(-50%)' }
      : SEATS[seatIdx % SEATS.length];
    const toPos = { top: isPortrait ? '45%' : '44%', left: '50%', transform: 'translate(-50%, -50%)' };

    if (type === 'PASS') {
      // PASS: only text animation, no card movement
      setFloatingAction({
        from: fromPos,
        to: toPos,
        text: `${playerName} Passed Turn`,
        type: 'PASS',
      });
    } else {
      // PLAY: card movement + text label
      setActiveAnimation({ from: fromPos, to: toPos, count: count || 1 });
      setFloatingAction({
        from: fromPos,
        to: toPos,
        text: `${playerName} Played ${count} Cards`,
        type: 'PLAY',
      });
    }
  }, [gameState?.lastMove, playerId, seatedPlayers, SEATS, isPortrait]);

  // FIX Bug 6: Drive bluff result toasts from gameState.bluffResult, not a separate socket event
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

    // Animation: cards fly from table to loser's seat
    const loserId = br.loserId;
    const isMe = loserId === playerId;
    const seatIdx = seatedPlayers.findIndex(p => p.id === loserId);
    if (isMe || seatIdx !== -1) {
      const toPos = isMe
        ? { bottom: '120px', left: '50%', transform: 'translateX(-50%)' }
        : SEATS[seatIdx % SEATS.length];
      setActiveAnimation({
        from: { top: isPortrait ? '45%' : '44%', left: '50%', transform: 'translate(-50%, -50%)' },
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

  // ── DERIVED STATE — safe after all hooks ──
  // FIX Bug 5: Early return MUST come after all hook calls
  if (!gameState) return null;

  const {
    players, hands, pile, sidePile, currentTurn, lastMove, state,
    hostId, roundRank, ranking, bluffPickerId, bluffSelectIdx, bluffResult,
    roomId: serverRoomId, isSpectator,
  } = gameState;

  // FIX Bug 10: Safe memo-dependency with nullish coalescing
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
    setShowMobileHand(false);
  };

  const getRankPos = (pId) => {
    const r = ranking.find(rank => rank.id === pId);
    return r ? r.rankPos : null;
  };

  // FIX Bug 7: Only show PASS button when pile has cards (not first move of round)
  const canPass = isMyTurn && !isPickingPhase && !isEnded && pile.length > 0 && roundRank;
  // BLUFF button: only if pile has cards and there's a previous player to target
  const canCallBluff = isMyTurn && !isPickingPhase && !isEnded && pile.length > 0;

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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isPortrait ? '4px 8px' : '8px 12px',
        paddingTop: 'env(safe-area-inset-top, 4px)',
      }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {!isPortrait && (
            <div className="panel-sm" style={{ padding: '6px 12px' }}>
              <span style={{ fontWeight: 900, color: '#a78bfa', fontSize: '0.7rem' }}>THE BLUFF</span>
            </div>
          )}

          {/* Room ID Pill */}
          <div className="panel-sm" style={{
            padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <span style={{ color: '#9ca3af', fontWeight: 700, fontSize: '0.55rem' }}>ROOM:</span>
            <span style={{ fontWeight: 900, color: '#fff', fontSize: isPortrait ? '0.6rem' : '0.7rem', letterSpacing: '0.05em' }}>{serverRoomId}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(`${window.location.origin}?room=${serverRoomId}`);
                toast.success('Invite link copied!');
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6d28d9', padding: '1px', display: 'flex', alignItems: 'center' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>

          {isSpectator && (
            <div className="panel-sm" style={{ padding: '4px 8px', background: '#f59e0b', border: 'none' }}>
              <span style={{ color: '#000', fontWeight: 900, fontSize: '0.55rem', textTransform: 'uppercase' }}>Spectating</span>
            </div>
          )}

          {roundRank && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel-sm"
              style={{ padding: '4px 10px', border: '1.5px solid #f59e0b', background: 'rgba(245,158,11,0.1)' }}>
              <span style={{ fontSize: '0.5rem', color: '#f59e0b', fontWeight: 900, textTransform: 'uppercase' }}>RANK: </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#fff' }}>{roundRank}</span>
            </motion.div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {currentPlayer && !isEnded && !isPickingPhase && !isResolution && (
            <div className="panel-sm" style={{
              padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px',
              border: isMyTurn ? '1.5px solid #6d28d9' : '1px solid rgba(255,255,255,0.1)',
              background: isMyTurn ? 'rgba(8,145,178,0.15)' : 'rgba(0,0,0,0.2)',
            }}>
              <div style={{ position: 'relative', width: '18px', height: '18px' }}>
                <svg style={{ transform: 'rotate(-90deg)', width: '18px', height: '18px' }}>
                  <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                  <circle cx="9" cy="9" r="7" fill="none"
                    stroke={timeLeft < 10 ? '#ef4444' : '#6d28d9'} strokeWidth="2"
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

      {/* ── Felt Table ── */}
      <div style={{
        position: 'absolute', top: isPortrait ? '48%' : '42%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: isPortrait ? '90vw' : '75vw', height: isPortrait ? '22vh' : '38vh',
        maxWidth: '900px', maxHeight: '420px', zIndex: 5,
      }}>
        <div className="felt-table" style={{
          width: '100%', height: '100%',
          borderRadius: isPortrait ? '24px' : '50%',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
          padding: isPortrait ? '0 8px' : '0 30px',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8), 0 20px 50px rgba(0,0,0,0.8)',
        }}>

          {/* Left: Last Move Info — FIX Bug 7: Don't show for PASS moves */}
          <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
            {/* FIX: Only show PLAY info — FloatingAction handles PASS display */}
            {lastMove && lastMove.type !== 'PASS' && (
              <div className="panel-sm" style={{
                padding: isPortrait ? '2px 5px' : '4px 8px',
                background: 'rgba(0,0,0,0.65)',
                border: '1px solid rgba(103,232,249,0.4)',
                borderRadius: '8px', display: 'inline-block',
              }}>
                <p style={{ margin: 0, fontSize: isPortrait ? '0.45rem' : '0.55rem', fontWeight: 900, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
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

          {/* Center: Main Pile */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ position: 'relative', width: isPortrait ? '50px' : '65px', height: isPortrait ? '70px' : '95px' }}>
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
              <p style={{ fontSize: isPortrait ? '1.4rem' : '1.8rem', fontWeight: 900, color: '#fff', lineHeight: 1, margin: 0 }}>{totalPileCards}</p>
            </div>
          </div>

          {/* Right: Side Pile */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: sidePile.length > 0 ? 0.9 : 0.25 }}>
            <div style={{ position: 'relative', width: isPortrait ? '30px' : '42px', height: isPortrait ? '42px' : '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 6, transform: 'rotate(10deg)', background: 'rgba(255,255,255,0.03)' }}>
              <TrashIcon size={isPortrait ? 12 : 20} color="#fff" />
            </div>
            <p style={{ fontSize: '0.5rem', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, textAlign: 'center' }}>
              SIDE<br />{sidePile.length}
            </p>
          </div>
        </div>
      </div>

      {/* ── Opponents (Seated Clockwise) ── */}
      {seatedPlayers.map((player, i) => {
        const pos = SEATS[i % SEATS.length];
        const isActive = currentTurn === player.id;
        const hc = player.cardCount;
        const winRank = getRankPos(player.id);
        const playerWinner = !!winRank;

        return (
          <motion.div
            key={player.id}
            initial={false}
            animate={{ scale: isActive ? (isPortrait ? 0.85 : 1.05) : (isPortrait ? 0.7 : 0.85) }}
            style={{
              position: 'absolute', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '4px', zIndex: isActive ? 20 : 10,
              ...pos,
            }}
          >
            <div className={`panel-sm${isActive ? ' active-pulse' : ''}`} style={{
              padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '90px',
              border: isActive ? '2.5px solid #6d28d9' : '1.5px solid rgba(255,255,255,0.08)',
              background: isActive ? 'rgba(8,145,178,0.3)' : 'rgba(255,255,255,0.04)',
              boxShadow: isActive ? '0 0 25px rgba(8,145,178,0.4)' : 'none',
              position: 'relative', overflow: 'hidden',
            }}>
              <AvatarDisplay avatarId={player.avatar} playerName={player.name} size={isPortrait ? 26 : 28} animated={true} />
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
              {/* FIX Bug 12: Winner trophy as overlay — no card display beneath */}
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

            {/* Chat bubble — floats above this opponent's player card */}
            <div style={{ position: 'absolute', top: isPortrait ? '-50px' : '-58px', left: '50%', transform: 'translateX(-50%)', width: '100%', pointerEvents: 'none' }}>
              <ChatBubble messages={getMsgs(player.id)} isMe={false} position="top" />
            </div>

            {/* Mini face-down cards */}
            {!playerWinner && hc > 0 && (
              <div style={{ position: 'relative', height: isPortrait ? '28px' : '32px', width: '100%', display: 'flex', justifyContent: 'center', marginTop: 1 }}>
                {[...Array(Math.min(hc, 5))].map((_, ci) => (
                  <div key={ci} className="face-down-card" style={{
                    width: isPortrait ? '20px' : '22px', height: isPortrait ? '30px' : '34px', left: '50%', marginLeft: isPortrait ? '-10px' : '-11px',
                    transform: `translateX(${(ci - 2) * 8}px) rotate(${(ci - 2) * 4}deg)`, zIndex: ci,
                  }} />
                ))}
                {hc > 5 && (
                  <div style={{ position: 'absolute', right: isPortrait ? '-10px' : '-12px', top: 0, fontSize: isPortrait ? '.5rem' : '.55rem', fontWeight: 900, color: '#9ca3af' }}>+{hc - 5}</div>
                )}
              </div>
            )}
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
              position: 'absolute', bottom: isPortrait ? '110px' : '120px',
              left: 0, right: 0, display: 'flex', justifyContent: 'center',
              zIndex: 40, pointerEvents: (isPickingPhase || isEnded || isResolution) ? 'none' : 'auto',
            }}
          >
            {isPortrait ? (
              <div style={{
                width: '100vw', display: 'flex', overflowX: 'auto', overflowY: 'visible',
                padding: '12px 40px 50px', scrollBehavior: 'smooth', gap: '10px',
                alignItems: 'flex-end', justifyContent: myHand.length < 5 ? 'center' : 'flex-start',
                scrollbarWidth: 'none', msOverflowStyle: 'none',
              }} className="no-scrollbar">
                {myHand.map((cardId, i) => {
                  const selected = selectedCards.includes(cardId);
                  return (
                    <div key={`${cardId}-${i}`}
                      style={{
                        cursor: isMyTurn ? 'pointer' : 'default', flexShrink: 0,
                        transform: `translateY(${selected ? -18 : 0}px)`,
                        transition: 'transform 0.2s ease',
                        filter: selected ? 'drop-shadow(0 0 6px #6d28d9)' : 'none',
                      }}
                      onClick={() => isMyTurn && !isPickingPhase && !isEnded && toggleCard(cardId)}
                    >
                      <Card cardId={cardId} scale={0.8} index={i} />
                    </div>
                  );
                })}
              </div>
            ) : (
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
                        filter: selected ? 'drop-shadow(0 0 8px #6d28d9)' : 'none',
                      }}
                      onClick={() => isMyTurn && !isPickingPhase && !isEnded && toggleCard(cardId)}
                    >
                      <Card cardId={cardId} scale={1.05} index={i} />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HUD (Bottom Bar) ── */}
      <div className="hud">
        <div style={{ width: '100%', maxWidth: '900px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isPortrait ? '6px' : '16px' }}>

          {/* My Info + my chat bubble */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
            <div style={{ position: 'relative' }}>
               <AvatarDisplay avatarId={myInfo?.avatar} playerName={myInfo?.name || '?'} size={isPortrait ? 24 : 32} animated={true} />
              {getRankPos(playerId) && (
                <div style={{ position: 'absolute', inset: -3, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', borderRadius: '50%', border: '2px solid #f59e0b' }}>
                  <TrophyIcon size={10} />
                </div>
              )}
              {/* My chat bubble — appears above my avatar in the HUD */}
              <ChatBubble messages={getMsgs(playerId)} isMe={true} position="bottom" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: isPortrait ? '0.6rem' : '0.7rem', fontWeight: 900, color: '#fff', margin: 0, textTransform: 'uppercase' }}>
                {myHand.length} CARDS
              </p>
              <p style={{ fontSize: '0.55rem', fontWeight: 800, color: '#6d28d9', margin: 0 }}>{myInfo?.name}</p>
            </div>
          </div>

          {/* FIX Bug 13: View Cards toggle integrated into HUD row (not a floating overlay) */}
          {!isSpectator && isPortrait && state !== 'ENDED' && (
            <button
              className="btn btn-sm"
              onClick={() => setShowMobileHand(!showMobileHand)}
              style={{
                background: showMobileHand ? 'var(--bg2)' : 'var(--primary)',
                color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
                padding: '6px 10px', fontSize: '0.6rem', width: 'auto', flexShrink: 0,
              }}
            >
              {showMobileHand ? '▲ HIDE' : `▼ CARDS (${myHand.length})`}
            </button>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            {!isSpectator ? (
              <>
                {isMyTurn && !isPickingPhase && !isEnded && !isResolution && (
                  <>
                    {/* Rank selector only when starting new round */}
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

                    {/* BLUFF button */}
                    {canCallBluff && (
                      <button
                        className="btn btn-red btn-sm"
                        onClick={callBluff}
                        style={{ padding: '8px 12px', fontWeight: 900, width: 'auto', fontSize: '0.75rem' }}
                      >
                        <MaskIcon size={12} /> BLUFF
                      </button>
                    )}

                    {/* PLAY button */}
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handlePlay}
                      disabled={selectedCards.length === 0}
                      style={{ padding: '8px 16px', opacity: selectedCards.length === 0 ? 0.35 : 1, width: 'auto', fontSize: '0.75rem' }}
                    >
                      PLAY {selectedCards.length > 0 ? selectedCards.length : ''}
                    </button>

                    {/* FIX Bug 7: PASS only shown when pile has cards */}
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

            {/* Compact chat button — always accessible in HUD */}
            {!isEnded && <ChatInput compact={true} />}
          </div>
        </div>
      </div>

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
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: timeLeft < 6 ? '#ef4444' : '#6d28d9', marginTop: 6 }}>{timeLeft}s</div>
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
                      filter: isSelected ? 'drop-shadow(0 0 20px #6d28d9)' : 'none',
                      border: isSelected ? '2.5px solid #6d28d9' : '2px solid transparent',
                      borderRadius: '10px', transition: 'border 0.15s',
                    }}
                  >
                    <Card cardId="X" faceDown={true} scale={isPortrait ? 0.8 : 1} />
                  </motion.div>
                );
              }) || <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>Waiting for cards...</p>}
            </div>

            <p style={{ color: '#6d28d9', fontWeight: 900, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
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
              style={{ display: 'flex', overflowX: 'auto', gap: '5px', padding: '8px', justifyContent: 'center', scrollbarWidth: 'none', maxWidth: '85vw' }}
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

            {/* Auto-advance progress bar */}
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

      {/* ── Floating Action Animation ── */}
      <FloatingAction
        fromPos={floatingAction?.from}
        toPos={floatingAction?.to}
        text={floatingAction?.text}
        type={floatingAction?.type}
        onComplete={() => setFloatingAction(null)}
      />

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
      `}</style>
    </div>
  );
}
