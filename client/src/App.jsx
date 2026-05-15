import React, { lazy, Suspense } from 'react';
import { Toaster } from './components/common/Toast';
import LandingPage from './pages/LandingPage';
import JoinPage from './games/bluff/pages/JoinPage';
import LobbyPage from './games/bluff/pages/LobbyPage';
import GameBoard from './games/bluff/pages/GameBoard';
import ExploreGamesPage from './pages/ExploreGamesPage';
import BluffEntryPage from './games/bluff/pages/BluffEntryPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ClerkSync from './components/common/ClerkSync';
import Preloader from './components/common/Preloader';
import { useGameStore } from './games/bluff/store/useGameStore';
import { useCPStore } from './games/courtpiece/store/useCPStore';
import { useMCStore } from './games/mendicoat/store/useMCStore';

// Court Piece pages — lazy loaded so they don't affect Bluff bundle
const CourtPieceEntryPage = lazy(() => import('./games/courtpiece/pages/CourtPieceEntryPage'));
const CPJoinPage = lazy(() => import('./games/courtpiece/pages/CPJoinPage'));
const CPLobbyPage = lazy(() => import('./games/courtpiece/pages/CPLobbyPage'));
const CPGameBoard = lazy(() => import('./games/courtpiece/pages/CPGameBoard'));

// MendiCoat pages
const MendiCoatEntryPage = lazy(() => import('./games/mendicoat/pages/MendiCoatEntryPage'));
const MCJoinPage = lazy(() => import('./games/mendicoat/pages/MCJoinPage'));
const MCLobbyPage = lazy(() => import('./games/mendicoat/pages/MCLobbyPage'));
const MCGameBoard = lazy(() => import('./games/mendicoat/pages/MCGameBoard'));

const Spinner = () => (
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: '20px' }}>
    <div style={{ position: 'relative', width: '60px', height: '60px' }}>
      <img src="/logo.png" alt="Loading" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px', zIndex: 2, position: 'relative' }} />
      <div style={{ 
        position: 'absolute', inset: '-10px', borderRadius: '50%', 
        border: '3px solid transparent', borderTopColor: 'var(--primary)', 
        animation: 'spin 1s linear infinite' 
      }} />
    </div>
    <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
  </div>
);

export default function App() {
  const [loading, setLoading] = React.useState(true);
  const [exiting, setExiting] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => setLoading(false), 600); // Match CSS transition
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  const { status, gameState, screen, fetchSettings } = useGameStore();

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);
  const { cpStatus, cpGameState, cpScreen } = useCPStore();
  const { mcStatus, mcGameState, mcScreen } = useMCStore();

  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  const gameParam = (params.get('game') || 'bluff').toLowerCase();
  const shouldOpenBluffJoin = Boolean(roomParam) && (gameParam === 'bluff');
  const shouldOpenCPJoin = Boolean(roomParam) && (gameParam === 'courtpiece');
  const shouldOpenMCJoin = Boolean(roomParam) && (gameParam === 'mendicoat');

  // ── Court Piece is active (connected to a CP room) ──────────────────────
  if (cpStatus === 'CONNECTING' || cpStatus === 'RECONNECTING') {
    return (
      <Suspense fallback={<Spinner />}>
        <Toaster /><ClerkSync />
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 24 }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: 'var(--text)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            {cpStatus === 'RECONNECTING' ? 'Reconnecting...' : 'Connecting...'}
          </p>
          <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
        </div>
      </Suspense>
    );
  }

  if (cpStatus === 'CONNECTED') {
    const isInCPGame = cpGameState && cpGameState.state !== 'WAITING';
    return (
      <Suspense fallback={<Spinner />}>
        <Toaster /><ClerkSync />
        {isInCPGame ? <CPGameBoard /> : <CPLobbyPage />}
      </Suspense>
    );
  }

  // ── Court Piece entry/join (idle state, CP screens) ─────────────────────
  if (cpStatus === 'IDLE' || cpStatus === 'ERROR') {
    if (shouldOpenCPJoin) {
      return (
        <Suspense fallback={<Spinner />}>
          <Toaster /><ClerkSync />
          <CPJoinPage />
        </Suspense>
      );
    }
    if (cpScreen === 'CP_ENTRY') {
      return (
        <Suspense fallback={<Spinner />}>
          <Toaster /><ClerkSync />
          <CourtPieceEntryPage />
        </Suspense>
      );
    }
    if (cpScreen === 'CP_JOIN') {
      return (
        <Suspense fallback={<Spinner />}>
          <Toaster /><ClerkSync />
          <CPJoinPage />
        </Suspense>
      );
    }
  }

  // ── MendiCoat is active (connected to an MC room) ───────────────────────
  if (mcStatus === 'CONNECTING' || mcStatus === 'RECONNECTING') {
    return (
      <Suspense fallback={<Spinner />}>
        <Toaster /><ClerkSync />
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 24 }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: 'var(--text)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            {mcStatus === 'RECONNECTING' ? 'Reconnecting...' : 'Connecting...'}
          </p>
          <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
        </div>
      </Suspense>
    );
  }

  if (mcStatus === 'CONNECTED') {
    const isInMCGame = mcGameState && mcGameState.state !== 'WAITING';
    return (
      <Suspense fallback={<Spinner />}>
        <Toaster /><ClerkSync />
        {isInMCGame ? <MCGameBoard /> : <MCLobbyPage />}
      </Suspense>
    );
  }

  // ── MendiCoat entry/join (idle state, MC screens) ──────────────────────
  if (mcStatus === 'IDLE' || mcStatus === 'ERROR') {
    if (shouldOpenMCJoin) {
      return (
        <Suspense fallback={<Spinner />}>
          <Toaster /><ClerkSync />
          <MCJoinPage />
        </Suspense>
      );
    }
    if (mcScreen === 'MC_ENTRY') {
      return (
        <Suspense fallback={<Spinner />}>
          <Toaster /><ClerkSync />
          <MendiCoatEntryPage />
        </Suspense>
      );
    }
    if (mcScreen === 'MC_JOIN') {
      return (
        <Suspense fallback={<Spinner />}>
          <Toaster /><ClerkSync />
          <MCJoinPage />
        </Suspense>
      );
    }
  }

  // ── Bluff game (original routing — unchanged) ────────────────────────────
  return (
    <>
      {loading && <Preloader isExiting={exiting} />}
      <Toaster />
      <ClerkSync />

      {(status === 'IDLE' || status === 'ERROR') && (
        shouldOpenBluffJoin && status !== 'ERROR'
          ? <JoinPage />
          : screen === 'BLUFF_ENTRY' ? <BluffEntryPage />
            : screen === 'JOIN' ? <JoinPage />
              : screen === 'EXPLORE' ? <ExploreGamesPage />
                : screen === 'PROFILE' ? <ProfilePage />
                  : screen === 'ADMIN' ? <AdminPage />
                    : screen === 'LEADERBOARD' ? <LeaderboardPage />
                      : <LandingPage />
      )}

      {(status === 'CONNECTING' || status === 'RECONNECTING') && (
        <div style={{
          height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg)',
          gap: '24px',
        }}>
          <div className="panel" style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '40px', height: '40px', border: '3px solid var(--primary-light)',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: 'var(--text)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              {status === 'RECONNECTING' ? 'Reconnecting...' : 'Connecting...'}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>Establishing secure session</p>
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
