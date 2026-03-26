import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { toast } from '../components/Toast';
import Avatar from '../components/Icons';

export default function LandingPage() {
  const { setIdentity, connect, playerName: storedName } = useGameStore();
  const [name, setName] = useState(storedName);

  const handleCreate = () => {
    if (!name.trim()) return toast.error('Enter your name');
    
    // Create random room ID
    const rid = Math.random().toString(36).substring(2, 8).toUpperCase();
    setIdentity(name, 'P');
    connect(rid);
  };

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 0%, #1a013d 0%, #0c0c1a 70%, #000 100%)',
      padding: '0 20px'
    }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="panel" style={{ width: '100%', maxWidth: '440px', textAlign: 'center' }}>
        
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 900, color: '#7c3aed', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: '12px' }}>Welcome To</h2>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '0.1em', background: 'linear-gradient(135deg, #fff 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 16px rgba(124,58,237,0.4))' }}>THE BLUFF</h1>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
          <Avatar name={name || '?'} size={80} fontSize="2.5rem" />
        </div>

        <div style={{ textAlign: 'left', marginBottom: '40px' }}>
           <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>Your Player Identity</label>
           <input className="inp" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={12} style={{ textAlign: 'center', fontSize: '1.2rem', padding: '16px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button className="btn btn-primary" onClick={handleCreate} style={{ padding: '20px', fontSize: '1.1rem' }}>
            Create Private Table
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '10px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
          </div>

          <a href="/join" className="btn btn-outline" style={{ textDecoration: 'none', padding: '18px' }}>
            Join with Room ID
          </a>
        </div>

      </motion.div>
    </div>
  );
}
