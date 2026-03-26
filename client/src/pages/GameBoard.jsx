import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../components/Toast';
import { useGameStore } from '../store/useGameStore';
import Card from '../components/Card';
import DealAnimation from '../components/DealAnimation';
import Avatar, { TrophyIcon, TrashIcon, MaskIcon } from '../components/Icons';

const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

const GET_SEATS = (isPortrait) => isPortrait ? [
  { top: '3%', left: '50%', transform: 'translateX(-50%)' },
  { top: '14%', right: '4%', transform: 'translateY(-50%) scale(0.9)' },
  { top: '34%', right: '4%', transform: 'translateY(-50%) scale(0.9)' },
  { top: '56%', right: '4%', transform: 'translateY(-50%) scale(0.9)' },
  { top: '14%', left: '4%', transform: 'translateY(-50%) scale(0.9)' },
  { top: '34%', left: '4%', transform: 'translateY(-50%) scale(0.9)' },
  { top: '56%', left: '4%', transform: 'translateY(-50%) scale(0.9)' },
] : [
  { top: '4%', left: '50%', transform: 'translateX(-50%)' },
  { top: '15%', right: '5%' },
  { bottom: '20%', right: '5%' },
  { top: '15%', left: '5%' },
  { bottom: '20%', left: '5%' },
  { top: '4%', right: '20%' },
  { top: '4%', left: '20%' },
];

export default function GameBoard() {
  const {
    gameState, playerId, bluffToast,
    selectedCards, toggleCard, playCards, callBluff, pickBluffCard, 
    passTurn, kickPlayer, restartGame, closeGame, disconnect
  } = useGameStore();

  const [dealDone, setDealDone] = useState(gameState?.state !== 'DEALING');
  const [declaredRank, setDeclaredRank] = useState('A');
  const [timeLeft, setTimeLeft] = useState(60);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const SEATS = useMemo(() => GET_SEATS(isPortrait), [isPortrait]);

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

  const { players, hands, pile, sidePile, currentTurn, lastMove, state, hostId, roundRank, ranking, bluffPickerId } = gameState;
  const myHand = hands?.[playerId] || [];
  const myInfo = players.find(p => p.id === playerId);
  const isMyTurn = currentTurn === playerId;
  const isHost = hostId === playerId;
  const isPickingPhase = state === 'BLUFF_PICKING';
  const isEnded = state === 'ENDED';
  const totalPileCards = pile?.reduce((s, m) => s + m.count, 0) || 0;
  const currentPlayer = players.find(p => p.id === currentTurn);
  const bluffPicker = players.find(p => p.id === bluffPickerId);
  const otherPlayers = players.filter(p => p.id !== playerId);

  const handlePlay = () => {
    if (selectedCards.length === 0) return toast.error('Select cards to play');
    playCards(declaredRank);
  };

  // Logic for horizontal scroll vs fan
  const useScrollHand = isPortrait && myHand.length > 8;

  return (
    <div style={{
      height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative',
      background: 'radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0a0a0c 100%)',
    }}>

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
        position: 'absolute', top: isPortrait ? '38%' : '48%', left: '50%', transform: 'translate(-50%, -50%)',
        width: isPortrait ? '80vw' : '60vw', height: isPortrait ? '30vh' : '48vh', 
        maxWidth: '850px', maxHeight: '400px', zIndex: 5
      }}>
        <div className="felt-table" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isPortrait ? '10px' : '60px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', width: '70px', height: '100px' }}>
              {totalPileCards > 0 ? (
                [...Array(Math.min(8, totalPileCards))].map((_, i) => (
                  <div key={i} style={{
                    position: 'absolute', inset: 0, borderRadius: '8px', background: 'linear-gradient(135deg, #4c1d95, #1e1b4b)',
                    border: '1px solid rgba(167,139,250,0.3)', zIndex: i,
                    transform: `translate(${(i - 4) * 2}px, ${(i - 4) * 1.5}px) rotate(${(i - 4) * 4}deg)`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }} />
                ))
              ) : (
                <div style={{ position: 'absolute', inset: 0, borderRadius: '8px', border: '1.5px dashed rgba(255,255,255,0.08)' }} />
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>MAIN PILE</p>
              <p style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{totalPileCards}</p>
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
              style={{ position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div className="panel-sm" style={{ padding: '6px 16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>
                  <span style={{ color: '#a78bfa' }}>{lastMove.playerName}</span>: {lastMove.count} Cards &rarr; <span style={{ color: '#f59e0b', fontWeight: 900 }}>{lastMove.declaredRank}</span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Opponents ── */}
      {otherPlayers.map((player, i) => {
        const pos = SEATS[i % SEATS.length];
        const isActive = currentTurn === player.id;
        const hc = player.cardCount;
        const isWinner = ranking.find(r => r.id === player.id);

        return (
          <motion.div key={player.id} style={{ 
            position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 10, 
            ...pos,
            scale: isPortrait ? 0.75 : 0.9
          }}>
            <div className="panel-sm" style={{ 
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', minWidth: '120px',
              border: isActive ? '2.5px solid #7c3aed' : '1.5px solid rgba(255,255,255,0.08)',
              background: isActive ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
              opacity: isWinner ? 0.3 : 1,
              position: 'relative'
            }}>
              <Avatar name={player.name} size={isWinner ? 24 : 32} fontSize="0.9rem" />
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fff', margin: 0 }}>{player.name.toUpperCase()}</p>
                <p style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 800, margin: 0 }}>{hc} CARDS</p>
              </div>
              {isHost && !isWinner && (
                <button onClick={() => kickPlayer(player.id)} style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: '#fff', width: 22, height: 22, borderRadius: '50%', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, border: '2px solid #000', cursor: 'pointer' }}>✕</button>
              )}
              {isWinner && <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)' }}><TrophyIcon size={16} /></div>}
            </div>

            <div style={{ position: 'relative', height: '40px', width: '100%', display: 'flex', justifyContent: 'center', marginTop: 10 }}>
               {[...Array(Math.min(hc, 5))].map((_, ci) => (
                 <div key={ci} className="face-down-card" style={{
                   width: '32px', height: '44px', left: '50%', marginLeft: '-16px',
                   transform: `translateX(${(ci - 2) * 10}px) rotate(${(ci - 2) * 6}deg)`, zIndex: ci
                 }} />
               ))}
               {hc > 5 && <div style={{ position: 'absolute', right: -12, top: 0, fontSize: '.6rem', fontWeight: 900, color: '#4b5563' }}>+{hc-5}</div>}
            </div>
          </motion.div>
        );
      })}

      {/* ── My Hand ── */}
      <div style={{ 
        position: 'absolute', bottom: isPortrait ? '120px' : '150px', 
        left: 0, right: 0, display: 'flex', justifyContent: 'center', 
        zIndex: 40, pointerEvents: (isPickingPhase || isEnded) ? 'none' : 'auto',
      }}>
        <div className="hand-scroll-area" style={{ justifyContent: useScrollHand ? 'flex-start' : 'center' }}>
          <div style={{ 
            position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', 
            minHeight: '160px', 
            width: useScrollHand ? `${myHand.length * 40}px` : '90vw', 
            maxWidth: useScrollHand ? 'none' : '1000px',
            transform: !useScrollHand ? `scale(${isPortrait ? 0.75 : 0.95})` : 'none'
          }}>
            {myHand.map((cardId, i) => {
              const count = myHand.length;
              const angle = useScrollHand ? 0 : (i - (count - 1) / 2) * (count > 15 ? 1.8 : 3.5);
              const tx = useScrollHand ? (i * 40) - (count * 20) : (i - (count - 1) / 2) * (count > 15 ? 18 : (count > 8 ? 25 : 40));
              const selected = selectedCards.includes(cardId);
              
              return (
                <div key={`${cardId}-${i}`} style={{
                  position: 'absolute', left: '50%', bottom: 0, transformOrigin: 'bottom center',
                  transform: `translateX(calc(-50% + ${tx}px)) rotate(${angle}deg) translateY(${selected ? -20 : 0}px)`, zIndex: i,
                  transition: 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)'
                }}>
                  <Card cardId={cardId} isSelected={selected} onClick={() => toggleCard(cardId)} scale={isPortrait ? 0.85 : 0.9} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bluff Picking ── */}
      <AnimatePresence>
        {isPickingPhase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
            position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(5,5,15,0.95)', backdropFilter: 'blur(12px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '30px'
          }}>
             <MaskIcon size={64} />
             
             <div style={{ textAlign: 'center' }}>
               <h2 style={{ fontSize: isPortrait ? '1.5rem' : '2.2rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                 {bluffPickerId === playerId ? 'Choose a card to expose' : `${bluffPicker?.name.toUpperCase()} is picking a card...`}
               </h2>
               <div style={{ fontSize: '4rem', fontWeight: 900, color: timeLeft < 5 ? '#ef4444' : '#7c3aed', marginTop: 10 }}>{timeLeft}s</div>
             </div>
             
             <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', padding: '0 40px' }}>
               {pile[pile.length - 1]?.cards?.map((_, idx) => (
                 <motion.div key={idx} 
                   whileHover={bluffPickerId === playerId ? { y: -30, scale: 1.15 } : {}} 
                   onClick={() => bluffPickerId === playerId && pickBluffCard(idx)}
                   style={{ cursor: bluffPickerId === playerId ? 'pointer' : 'default', filter: 'drop-shadow(0 0 20px rgba(124,58,237,0.4))' }}>
                   <Card cardId="X" faceDown={true} scale={isPortrait ? 1 : 1.2} />
                 </motion.div>
               )) || <p style={{ color: '#6b7280' }}>Loading pile...</p>}
             </div>
             <p style={{ color: '#7c3aed', fontWeight: 900, fontSize: '1.2rem', textTransform: 'uppercase' }}>
               {bluffPickerId === playerId ? 'HURRY! Penalty if timer ends.' : 'Waiting for guess...'}
             </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Ranking ── */}
      <AnimatePresence>
        {isEnded && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
            position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(7,7,15,0.98)', backdropFilter: 'blur(30px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
             <TrophyIcon size={80} />
             <h1 style={{ fontSize: '3.5rem', fontWeight: 900, color: '#f59e0b', margin: '20px 0 40px' }}>FINAL RANKING</h1>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '90%', maxWidth: 400 }}>
                {ranking.map((res, i) => (
                  <div key={res.id} className="panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 20, border: i === 0 ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontWeight: 900, color: i === 0 ? '#f59e0b' : '#6b7280', fontSize: '1.8rem', width: 40 }}>#{res.rankPos}</span>
                    <Avatar name={res.name} size={48} fontSize="1.4rem" />
                    <span style={{ fontWeight: 800, fontSize: '1.2rem', flex: 1, color: '#fff' }}>{res.name.toUpperCase()}</span>
                    {i === 0 && <TrophyIcon size={24} />}
                  </div>
                ))}
             </div>
             <div style={{ marginTop: 50, display: 'flex', gap: 16 }}>
                {isHost && <button className="btn btn-primary" onClick={restartGame} style={{ padding: '20px 40px' }}>PLAY AGAIN</button>}
                <button className="btn btn-outline" onClick={disconnect} style={{ padding: '20px 40px' }}>EXIT LOUNGE</button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hud">
        <div style={{ width: '100%', maxWidth: '900px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isPortrait ? '10px' : '24px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
            <Avatar name={myInfo?.name || '?'} size={isPortrait ? 32 : 44} fontSize="1.1rem" />
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff', margin: 0, textTransform: 'uppercase' }}>{myInfo?.name}</p>
              <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7c3aed', margin: 0 }}>{myHand.length} CARDS</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {isMyTurn && !isPickingPhase && (
              <>
                {!roundRank && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#4b5563', paddingLeft: 4 }}>CLAIM RANK</span>
                    <select value={declaredRank} onChange={e => setDeclaredRank(e.target.value)} className="rank-select">
                      {RANKS.map(r => <option key={r} value={r} style={{ background: '#0c0c1a' }}>{r}</option>)}
                    </select>
                  </div>
                )}
                {pile.length > 0 && (
                  <button className="btn btn-red btn-sm" onClick={callBluff} style={{ padding: '14px 20px', fontWeight: 900, width: 'auto' }}><MaskIcon size={16} /> BLUFF</button>
                )}
                <button className="btn btn-primary btn-sm" onClick={handlePlay} disabled={selectedCards.length === 0} style={{ padding: '14px 28px', opacity: selectedCards.length === 0 ? 0.3 : 1, width: 'auto' }}>
                  PLAY {selectedCards.length || ''}
                </button>
                {roundRank && (
                  <button className="btn btn-outline btn-sm" onClick={passTurn} style={{ padding: '14px 20px', width: 'auto' }}>PASS</button>
                )}
              </>
            )}
            {!isMyTurn && state !== 'ENDED' && !isPickingPhase && (
              <p style={{ color: '#4b5563', fontSize: '0.8rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Waiting for turn</p>
            )}
            {isPickingPhase && (
               <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                 <div style={{ width: 10, height: 10, background: '#ef4444', borderRadius: '50%', animation: 'pulse-ring 1s infinite' }} />
                 <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#fff', letterSpacing: '0.1em' }}>BLUFF RESOLUTION IN PROGRESS</span>
               </div>
            )}
            {isHost && !isEnded && <button onClick={closeGame} style={{ color: '#ef4444', background: 'none', fontSize: '0.75rem', fontWeight: 800, padding: 10, cursor: 'pointer', border: 'none' }}>CLOSE</button>}
          </div>
        </div>
      </div>

    </div>
  );
}
