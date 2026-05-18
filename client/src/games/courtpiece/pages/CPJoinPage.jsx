import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCPStore } from '../store/useCPStore';
import { useGameStore } from '../../bluff/store/useGameStore';
import { toast } from '../../../components/common/Toast';

export default function CPJoinPage() {
  const { connectCP, setCPScreen } = useCPStore();
  const { playerName: storedName, avatar, user, setIdentity } = useGameStore();
  const [name, setName] = useState(storedName || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const roomFromUrl = new URLSearchParams(window.location.search).get('room');
    if (roomFromUrl) {
      setCode(roomFromUrl.toUpperCase());
    }
  }, []);

  const handleJoin = async () => {
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean || clean.length < 4) { toast.error('Enter a valid room code'); return; }
    if (!name.trim()) { toast.error('Enter your player name first'); return; }
    setLoading(true);
    await setIdentity(name.trim(), avatar || 'P');
    connectCP(clean, name.trim(), avatar || 'P', user?.id);
  };

  return (
    <div style={{
      minHeight: '100vh', width: '100vw',
      background: 'radial-gradient(circle at 25% 20%, rgba(251,146,60,0.16), transparent 30%), linear-gradient(180deg, #0f0a1a 0%, #030208 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ position: 'absolute', top: 20, left: 20 }}>
        <button
          onClick={() => {
            window.history.pushState({}, '', window.location.pathname);
            setCPScreen('CP_ENTRY');
          }}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af', fontSize: '0.82rem', fontWeight: 700, padding: '9px 14px', borderRadius: 12, cursor: 'pointer' }}
        >
          ← Back
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          width: '100%', maxWidth: 400, padding: '32px 28px',
          background: 'linear-gradient(160deg, rgba(15,10,35,0.97), rgba(5,3,12,0.98))',
          border: '1px solid rgba(251,146,60,0.22)', borderRadius: 26,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        }}
      >
        <p style={{ margin: '0 0 6px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.16em', color: '#fb923c' }}>JOIN TABLE</p>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.8rem', fontWeight: 900, color: '#fff' }}>Enter Room Code</h1>
        <p style={{ margin: '0 0 28px', fontSize: '0.82rem', color: '#6b7280' }}>
          Ask your friend for the 6-character Court Piece room code.
        </p>

        <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#6b7280', letterSpacing: '0.14em', display: 'block', marginBottom: 8 }}>
          YOUR NAME
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="Enter your name"
          maxLength={12}
          style={{
            width: '100%', padding: '14px 16px', marginBottom: 20,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, color: '#fff', fontSize: '1rem', fontWeight: 700,
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#6b7280', letterSpacing: '0.14em', display: 'block', marginBottom: 8 }}>
          ROOM CODE
        </label>
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().slice(0, 8))}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="e.g. AB3K9M"
          style={{
            width: '100%', padding: '14px 16px', marginBottom: 20,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(251,146,60,0.3)',
            borderRadius: 14, color: '#fff', fontSize: '1.4rem', fontWeight: 800,
            letterSpacing: '0.24em', textAlign: 'center', outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleJoin} disabled={loading || !code.trim() || !name.trim()}
          style={{
            width: '100%', padding: '15px', borderRadius: 16,
            background: (code.trim() && name.trim()) ? 'linear-gradient(135deg,#c2410c,#9a3412)' : 'rgba(255,255,255,0.06)',
            border: 'none', color: (code.trim() && name.trim()) ? '#fff' : '#4b5563',
            fontSize: '0.96rem', fontWeight: 800, cursor: (code.trim() && name.trim()) ? 'pointer' : 'not-allowed',
            boxShadow: (code.trim() && name.trim()) ? '0 10px 28px rgba(251,146,60,0.28)' : 'none',
          }}
        >
          {loading ? 'Joining...' : 'Join Table →'}
        </motion.button>

        <p style={{ margin: '16px 0 0', fontSize: '0.75rem', color: '#4b5563', textAlign: 'center' }}>
          Court Piece requires exactly 4 players to start.
        </p>
      </motion.div>
    </div>
  );
}
