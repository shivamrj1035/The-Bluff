import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useJKStore } from '../store/useJKStore';
import { useGameStore } from '../../bluff/store/useGameStore';
import AuthDialog from '../../../components/common/AuthDialog';
import { toast } from '../../../components/common/Toast';
import AvatarDisplay from '../../../components/common/AvatarDisplay';

export default function JokerEntryPage() {
  const { connectJK, setJKScreen } = useJKStore();
  const { setScreen, playerName: storedName, avatar, user, profile, setIdentity } = useGameStore();

  const [name, setName] = useState(storedName || profile?.username || '');
  const [editingName, setEditingName] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => { if (editingName) nameRef.current?.focus(); }, [editingName]);

  useEffect(() => {
    if (storedName || profile?.username) {
      setName(storedName || profile?.username || '');
    }
  }, [storedName, profile?.username]);

  const persistIdentity = async () => {
    if (!name.trim()) { toast.error('Enter your player name first'); return false; }
    await setIdentity(name.trim(), avatar || 'P');
    return true;
  };

  const handleCreate = async () => {
    if (!user) { setIsAuthOpen(true); return; }
    const ok = await persistIdentity();
    if (!ok) return;
    setLoading(true);
    connectJK('', name.trim(), avatar || 'P', user?.id);
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!user) { setIsAuthOpen(true); return; }
    const ok = await persistIdentity();
    if (!ok) return;
    setJKScreen('JK_JOIN');
  };

  const stats = [
    { value: '2-6', label: 'players' },
    { value: 'Joker', label: 'wildcard' },
    { value: 'Pairs', label: 'auto-remove' },
  ];

  const features = [
    ['Avoid Joker', 'Do not get left holding the Joker card'],
    ['Draw Cards', 'Draw cards clockwise from your opponent'],
  ];

  return (
    <div style={{
      minHeight: '100vh', width: '100vw', overflow: 'hidden',
      background: 'radial-gradient(circle at 50% 50%, #110724 0%, #030107 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, position: 'relative',
    }}>
      <AuthDialog isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {/* Ambient glows */}
      <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34, 197, 94, 0.16), transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '5%', right: '-10%', width: 550, height: 550, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.18), transparent 70%)', filter: 'blur(120px)', pointerEvents: 'none' }} />

      {/* Back button */}
      <div style={{ position: 'absolute', top: 20, left: 20 }}>
        <button
          onClick={() => {
            setJKScreen('LANDING');
            setScreen('EXPLORE');
          }}
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--muted)', fontSize: '0.82rem', fontWeight: 700, padding: '9px 14px', borderRadius: 12, cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.color = '#fff'; }}
          onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.03)'; e.target.style.color = 'var(--muted)'; }}
        >
          ← Explore
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          width: '100%', maxWidth: 440, borderRadius: 26, padding: '28px 24px 22px',
          background: 'rgba(20, 12, 34, 0.65)',
          border: '1px solid rgba(167, 139, 250, 0.18)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)',
          backdropFilter: 'blur(18px)', position: 'relative', zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: 'var(--red)', fontWeight: 800, letterSpacing: '0.16em' }}>
              JOKER TABLE
            </p>
            <h1 style={{ margin: 0, fontSize: '2.1rem', lineHeight: 0.95, fontWeight: 900, letterSpacing: '-0.03em' }}>
              <span style={{ color: 'var(--text)' }}>Play </span>
              <span style={{
                backgroundImage: 'linear-gradient(135deg, #ef4444, #a78bfa)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent'
              }}>
                Joker
              </span>
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
              Old Maid Style · Avoid the Wildcard Joker
            </p>
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <AvatarDisplay
              avatarId={avatar}
              playerName={name}
              size={62}
              showBorder={true}
              animated={true}
            />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
          {stats.map((s, idx) => {
            const pillStyles = [
              { bg: 'rgba(34, 197, 94, 0.05)', border: 'rgba(34, 197, 94, 0.25)', color: '#22c55e' }, // Acid Green
              { bg: 'rgba(234, 179, 8, 0.05)', border: 'rgba(234, 179, 8, 0.25)', color: '#eab308' }, // Gold/Yellow
              { bg: 'rgba(167, 139, 250, 0.05)', border: 'rgba(167, 139, 250, 0.25)', color: '#c084fc' } // Purple
            ][idx];
            return (
              <div key={s.label} style={{ padding: '12px 10px', borderRadius: 16, background: pillStyles.bg, border: `1px solid ${pillStyles.border}`, textAlign: 'center' }}>
                <strong style={{ display: 'block', fontSize: '0.9rem', color: pillStyles.color }}>{s.value}</strong>
                <span style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Name input */}
        <div style={{ marginBottom: 18 }}>
          <p style={{ margin: '0 0 8px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--muted)', letterSpacing: '0.14em' }}>PLAYER NAME</p>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(15, 10, 25, 0.45)',
            border: `1px solid ${editingName ? 'rgba(167, 139, 250, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: 16, padding: '13px 14px',
            boxShadow: editingName ? '0 0 15px rgba(167, 139, 250, 0.2)' : 'none',
            transition: 'all 0.2s'
          }}>
            <span style={{ color: '#a78bfa' }}>👤</span>
            <input
              ref={nameRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={() => setEditingName(true)}
              onBlur={() => setEditingName(false)}
              placeholder="Enter your name"
              maxLength={12}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '0.98rem', fontWeight: 700, minWidth: 0 }}
            />
            <button onClick={() => { setEditingName(true); nameRef.current?.focus(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', fontSize: 15, padding: 0 }}>
              ✏️
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <motion.button
            whileHover={{ scale: 1.01, boxShadow: '0 12px 30px rgba(34, 197, 94, 0.35)' }} whileTap={{ scale: 0.99 }}
            onClick={handleCreate} disabled={loading}
            style={{
              width: '100%', padding: '15px 18px',
              background: 'linear-gradient(135deg, #22c55e, #8b5cf6)',
              border: 'none', borderRadius: 16, color: '#fff', fontSize: '0.96rem', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              boxShadow: '0 8px 24px rgba(34, 197, 94, 0.2)',
              transition: 'box-shadow 0.25s ease'
            }}
          >
            <span>👑 Create Private Table</span>
            <span>→</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.01, background: 'rgba(139, 92, 246, 0.12)', boxShadow: '0 8px 24px rgba(139, 92, 246, 0.2)' }} whileTap={{ scale: 0.99 }}
            onClick={handleJoin} disabled={loading}
            style={{
              width: '100%', padding: '15px 18px',
              background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: 16, color: '#c7d2fe', fontSize: '0.96rem', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              transition: 'all 0.25s ease'
            }}
          >
            <span>👥 Join Existing Table</span>
            <span>→</span>
          </motion.button>
        </div>

        {/* Feature pills */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {features.map(([title, text], idx) => {
            const cardStyles = idx === 0 
              ? { bg: 'rgba(239, 68, 68, 0.02)', border: 'rgba(239, 68, 68, 0.15)', titleColor: '#fca5a5' }
              : { bg: 'rgba(34, 211, 238, 0.02)', border: 'rgba(34, 211, 238, 0.15)', titleColor: '#99f6e4' };
            return (
              <div key={title} style={{ padding: '10px 12px', borderRadius: 14, background: cardStyles.bg, border: `1px solid ${cardStyles.border}` }}>
                <div style={{ color: cardStyles.titleColor, fontSize: '0.82rem', fontWeight: 800, marginBottom: 4 }}>{title}</div>
                <div style={{ color: 'var(--muted)', fontSize: '0.74rem', lineHeight: 1.4 }}>{text}</div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
