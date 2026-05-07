import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { toast } from '../../../components/common/Toast';


export default function BluffEntryPage() {
  const { setScreen, setIdentity, connect, playerName: storedName, user, profile } = useGameStore();
  const [name, setName] = useState(storedName || profile?.username || '');
  const [editingName, setEditingName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  const avatarLetter = name?.trim()[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';

  const persistIdentity = async () => {
    if (!name.trim()) {
      toast.error('Enter your player name first');
      return false;
    }
    await setIdentity(name.trim(), 'P');
    return true;
  };

  const handleCreate = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    const ok = await persistIdentity();
    if (!ok) return;
    setLoading(true);
    connect('');
    setLoading(false);
  };

  const handleJoinTable = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    const ok = await persistIdentity();
    if (!ok) return;
    setScreen('JOIN');
  };

  const stats = [
    { value: '2-8', label: 'players' },
    { value: '10-15', label: 'minutes' },
    { value: 'live', label: 'tables' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 20% 15%, rgba(8,145,178,0.22), transparent 24%), radial-gradient(circle at 85% 20%, rgba(20,184,166,0.12), transparent 20%), linear-gradient(180deg, #06202a 0%, #031015 58%, #01080b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
      }}
    >
      <AuthDialog isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <div
        style={{
          position: 'absolute',
          inset: 'auto auto 10% -60px',
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(8,145,178,0.24), transparent 68%)',
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '14% -80px auto auto',
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(234,88,12,0.14), transparent 70%)',
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'absolute', top: 20, left: 20 }}>
        <button
          onClick={() => setScreen('EXPLORE')}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#9ca3af',
            fontSize: '0.82rem',
            fontWeight: 700,
            padding: '9px 14px',
            borderRadius: 12,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          ← Explore
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 26,
          padding: '28px 24px 22px',
          background: 'linear-gradient(160deg, rgba(3, 31, 39, 0.95), rgba(1, 10, 13, 0.96))',
          border: '1px solid rgba(8,145,178,0.26)',
          boxShadow: '0 28px 70px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
          backdropFilter: 'blur(16px)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 22,
          }}
        >
          <div>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '0.72rem',
                color: '#f59e0b',
                fontWeight: 800,
                letterSpacing: '0.16em',
              }}
            >
              BLUFF TABLE
            </p>
            <h1
              style={{
                margin: 0,
                fontSize: '2.3rem',
                lineHeight: 0.95,
                fontWeight: 900,
                letterSpacing: '-0.03em',
              }}
            >
              <span style={{ color: '#fff' }}>Play </span>
              <span
                style={{
                  background: 'linear-gradient(135deg,#a5f3fc,#6d28d9)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                The Bluff
              </span>
            </h1>
          </div>

          <div
            style={{
              width: 62,
              height: 62,
              borderRadius: '18px',
              background: 'linear-gradient(135deg,#f97316,#ea580c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.7rem',
              fontWeight: 900,
              color: '#fff',
              boxShadow: '0 0 0 4px rgba(249,115,22,0.12), 0 16px 30px rgba(249,115,22,0.22)',
              flex: '0 0 auto',
            }}
          >
            {avatarLetter}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 10,
            marginBottom: 18,
          }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: '12px 10px',
                borderRadius: 16,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.05)',
                textAlign: 'center',
              }}
            >
              <strong style={{ display: 'block', fontSize: '1rem', color: '#fff' }}>{stat.value}</strong>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 18 }}>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#6b7280',
              letterSpacing: '0.14em',
            }}
          >
            PLAYER NAME
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${editingName ? 'rgba(8,145,178,0.5)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 16,
              padding: '13px 14px',
              boxShadow: editingName ? '0 0 0 3px rgba(8,145,178,0.12)' : 'none',
            }}
          >
            <span style={{ color: '#6b7280' }}>👤</span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setEditingName(true)}
              onBlur={() => setEditingName(false)}
              placeholder="Enter your name"
              maxLength={12}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '0.98rem',
                fontWeight: 700,
                minWidth: 0,
              }}
            />
            <button
              onClick={() => {
                setEditingName(true);
                nameRef.current?.focus();
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6d28d9',
                fontSize: 15,
                padding: 0,
              }}
            >
              ✏️
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleCreate}
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px 18px',
              background: 'linear-gradient(135deg,#6d28d9,#4c1d95)',
              border: 'none',
              borderRadius: 16,
              color: '#fff',
              fontSize: '0.96rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              boxShadow: '0 10px 28px rgba(8,145,178,0.34)',
            }}
          >
            <span>👑 Create Private Table</span>
            <span>→</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleJoinTable}
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px 18px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              color: '#e5e7eb',
              fontSize: '0.96rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span>👥 Join Existing Table</span>
            <span>→</span>
          </motion.button>
        </div>

        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10,
          }}
        >
          {[
            ['Fast rounds', 'Quick bluff sessions'],
            ['Private rooms', 'Invite with code'],
          ].map(([title, text]) => (
            <div
              key={title}
              style={{
                padding: '10px 12px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 800, marginBottom: 4 }}>{title}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.74rem', lineHeight: 1.4 }}>{text}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
