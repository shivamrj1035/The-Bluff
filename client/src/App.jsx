import React from 'react';
import { Toaster } from './components/Toast';
import { useGameStore } from './store/useGameStore';
import LandingPage from './pages/LandingPage';
import JoinPage from './pages/JoinPage';
import LobbyPage from './pages/LobbyPage';
import GameBoard from './pages/GameBoard';

export default function App() {
  const { status, gameState, screen } = useGameStore();

  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');

  // Inlined rendering logic for stability
  return (
    <>
      <Toaster />
      
      {(status === 'IDLE' || status === 'ERROR') && (
        roomParam && status !== 'ERROR'
          ? <JoinPage />
          : screen === 'JOIN' ? <JoinPage /> : <LandingPage />
      )}

      {(status === 'CONNECTING' || status === 'RECONNECTING') && (
        <div style={{
          height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(ellipse at 50% 0%, #1a0a3d 0%, #0c0c1a 60%, #060614 100%)',
          gap: '24px',
        }}>
          <div className="panel" style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '40px', height: '40px', border: '3px solid #a78bfa',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              {status === 'RECONNECTING' ? 'Reconnecting...' : 'Connecting...'}
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>Establishing secure session</p>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {status === 'CONNECTED' && (
        !gameState || gameState.state === 'WAITING' ? <LobbyPage /> : <GameBoard />
      )}

      {status !== 'IDLE' && status !== 'ERROR' && status !== 'CONNECTING' && status !== 'RECONNECTING' && status !== 'CONNECTED' && (
        <LandingPage />
      )}
    </>
  );
}
