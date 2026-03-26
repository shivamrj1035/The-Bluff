import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { toast } from '../components/Toast';
import Avatar from '../components/Icons';

export default function JoinPage() {
  const { setIdentity, connect, playerName: storedName, error } = useGameStore();
  const [name, setName] = useState(storedName);
  const [roomId, setRoomId] = useState('');

  // Show server errors as toasts & handle URL Room ID
  React.useEffect(() => {
    if (error) toast.error(error);
    
    // Auto-fill from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setRoomId(roomFromUrl.toUpperCase());
    }
  }, [error]);

  const handleJoin = async () => {
    if (!name.trim()) return toast.error('Enter your name');
    if (!roomId.trim()) return toast.error('Enter Room ID');
    
    setIdentity(name, 'P'); 
    connect(roomId);
  };

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, #1a0a3d 0%, #0c0c1a 60%, #060614 100%)',
      padding: '0 20px'
    }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="panel" style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
        
        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '6px', color: '#fff' }}>Join Game</h1>
        <p style={{ color: '#9ca3af', marginBottom: '24px', fontSize: '0.9rem' }}>Enter the room code and your name</p>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <Avatar name={name || '?'} size={64} fontSize="2rem" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>Room ID</label>
            <input className="inp" placeholder="e.g. ROOM-123" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} />
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>Your Name</label>
            <input className="inp" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={12} />
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleJoin} style={{ padding: '15px' }}>
          Connect to Table &rarr;
        </button>

        <p style={{ marginTop: '20px', fontSize: '0.8rem', color: '#4b5563' }}>By joining, you agree to play fair.</p>
      </motion.div>
    </div>
  );
}
