import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useCPStore } from '../store/useCPStore';
import { useGameStore } from '../../bluff/store/useGameStore';
import AuthDialog from '../../../components/common/AuthDialog';
import { toast } from '../../../components/common/Toast';
import AvatarDisplay from '../../../components/common/AvatarDisplay';

export default function CourtPieceEntryPage() {
  const { connectCP, setCPScreen, cpRoomId } = useCPStore();
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
    connectCP('', name.trim(), avatar || 'P', user?.id);
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!user) { setIsAuthOpen(true); return; }
    const ok = await persistIdentity();
    if (!ok) return;
    setCPScreen('CP_JOIN');
  };

  const stats = [
    { value: '4', label: 'players' },
    { value: '2 teams', label: 'A vs B' },
    { value: 'trump', label: 'rang' },
  ];

  const features = [
    ['Trick-taking', 'Follow suit or play trump'],
    ['Team play', 'Partners sit opposite'],
  ];

  return (
    <div style={{
      minHeight: '100vh', width: '100vw', overflow: 'hidden',
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, position: 'relative',
    }}>
      <AuthDialog isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {/* Ambient glows */}
      <div style={{ position: 'absolute', inset: 'auto auto 10% -60px', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-glow), transparent 68%)', filter: 'blur(12px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: '12% -80px auto auto', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, var(--green), transparent 70%)', filter: 'blur(12px)', pointerEvents: 'none' }} />

      {/* Back button */}
      <div style={{ position: 'absolute', top: 20, left: 20 }}>
        <button
          onClick={() => {
            setCPScreen('LANDING');
            setScreen('EXPLORE');
          }}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: '0.82rem', fontWeight: 700, padding: '9px 14px', borderRadius: 12, cursor: 'pointer', backdropFilter: 'blur(8px)' }}
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
          background: 'var(--bg2)',
          border: '1px solid var(--border-bright)',
          boxShadow: '0 28px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.03)',
          backdropFilter: 'blur(16px)', position: 'relative', zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 800, letterSpacing: '0.16em' }}>
              COURT PIECE TABLE
            </p>
            <h1 style={{ margin: 0, fontSize: '2.1rem', lineHeight: 0.95, fontWeight: 900, letterSpacing: '-0.03em' }}>
              <span style={{ color: 'var(--text)' }}>Play </span>
              <span style={{ background: 'linear-gradient(135deg, var(--gold), var(--green))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Court Piece
              </span>
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
              Rang · Coat Piece · Classic Indian Card Game
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
          {stats.map(s => (
            <div key={s.label} style={{ padding: '12px 10px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text)' }}>{s.value}</strong>
              <span style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Name input */}
        <div style={{ marginBottom: 18 }}>
          <p style={{ margin: '0 0 8px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--muted)', letterSpacing: '0.14em' }}>PLAYER NAME</p>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${editingName ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 16, padding: '13px 14px',
            boxShadow: editingName ? '0 0 0 3px var(--accent-glow)' : 'none',
          }}>
            <span style={{ color: 'var(--muted)' }}>👤</span>
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 15, padding: 0 }}>
              ✏️
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <motion.button
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            onClick={handleCreate} disabled={loading}
            style={{
              width: '100%', padding: '15px 18px',
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              border: 'none', borderRadius: 16, color: 'var(--text)', fontSize: '0.96rem', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              boxShadow: '0 10px 28px var(--shadow-p)',
            }}
          >
            <span>👑 Create Private Table</span>
            <span>→</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            onClick={handleJoin} disabled={loading}
            style={{
              width: '100%', padding: '15px 18px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
              borderRadius: 16, color: 'var(--dim)', fontSize: '0.96rem', fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}
          >
            <span>👥 Join Existing Table</span>
            <span>→</span>
          </motion.button>
        </div>

        {/* Feature pills */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {features.map(([title, text]) => (
            <div key={title} style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--text)', fontSize: '0.82rem', fontWeight: 800, marginBottom: 4 }}>{title}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.74rem', lineHeight: 1.4 }}>{text}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
