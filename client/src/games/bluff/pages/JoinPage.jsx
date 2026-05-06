import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { toast } from '../../../components/common/Toast';

export default function JoinPage() {
  const { setIdentity, connect, playerName: storedName, error } = useGameStore();
  const [name, setName] = useState(storedName || '');
  const [roomId, setRoomId] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (error) toast.error(error);
    const roomFromUrl = new URLSearchParams(window.location.search).get('room');
    if (roomFromUrl) setRoomId(roomFromUrl.toUpperCase());
  }, [error]);

  const avatarLetter = name?.trim()[0]?.toUpperCase() || '?';

  const getRoomLookupUrl = (rid) => {
    const base = import.meta.env.VITE_SOCKET_URL;
    if (!base || base === '/') return `/room/${rid}`;
    return `${String(base).replace(/\/$/, '')}/room/${rid}`;
  };

  const handleJoin = async () => {
    if (!name.trim()) return toast.error('Enter your name');
    if (!roomId.trim()) return toast.error('Enter Room ID');

    const rid = roomId.trim().toUpperCase();
    setChecking(true);

    try {
      const response = await fetch(getRoomLookupUrl(rid));
      if (!response.ok) {
        toast.error('Table not found or expired');
        return;
      }
    } catch (_err) {
      toast.error('Unable to verify table right now');
      return;
    } finally {
      setChecking(false);
    }

    const newUrl = `${window.location.origin}${window.location.pathname}?room=${rid}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    await setIdentity(name.trim(), 'P');
    connect(rid);
  };

  const joinDisabled = checking || !roomId.trim() || !name.trim();

  return (
    <div className="auth-shell join-shell">
      <div className="join-orb join-orb-left" />
      <div className="join-orb join-orb-right" />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="join-card"
      >
        <div className="join-card-top">
          <div className="join-chip">Join Table</div>
          <div className="join-avatar">{avatarLetter}</div>
        </div>

        <h1>Enter Room</h1>
        <p className="join-subtitle">Use a valid table code and jump straight into the lobby.</p>

        <div className="join-field-group">
          <label className="join-label" htmlFor="room-id">Room Code</label>
          <div className="join-field">
            <span className="join-prefix">#</span>
            <input
              id="room-id"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="AIXDV1"
              maxLength={8}
            />
          </div>
        </div>

        <div className="join-field-group">
          <label className="join-label" htmlFor="player-name">Your Name</label>
          <div className="join-field">
            <span className="join-prefix">👤</span>
            <input
              id="player-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="Enter your name"
              maxLength={12}
            />
          </div>
        </div>

        <motion.button
          whileHover={{ scale: joinDisabled ? 1 : 1.01 }}
          whileTap={{ scale: joinDisabled ? 1 : 0.99 }}
          onClick={handleJoin}
          disabled={joinDisabled}
          className="join-primary-btn"
        >
          {checking ? 'Checking Table...' : 'Connect to Table'}
          {!checking && <span>→</span>}
        </motion.button>

        <div className="join-footer">
          <button
            onClick={() => useGameStore.getState().setScreen('BLUFF_ENTRY')}
            className="join-back-btn"
          >
            ← Back to Bluff
          </button>
          <p>Private rooms only. Enter the exact host code.</p>
        </div>
      </motion.div>
    </div>
  );
}
