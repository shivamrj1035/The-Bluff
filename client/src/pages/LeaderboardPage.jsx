import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../games/bluff/store/useGameStore';
import { TrophyIcon, SpadeIcon, CrownIcon, UsersIcon, ArrowLeftIcon, EnergyIcon, ShieldIcon } from '../components/common/Icons';
import AvatarDisplay from '../components/common/AvatarDisplay';

export default function LeaderboardPage() {
  const { setScreen, apiBase, getAuthToken } = useGameStore();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('ALL'); // ALL, WEEKLY

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const token = await getAuthToken();
        const res = await fetch(`${apiBase}/api/leaderboard`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [apiBase, getAuthToken]);

  const topThree = data.slice(0, 3);
  const remaining = data.slice(3);

  return (
    <div className="landing-wrapper" style={{ overflowY: 'auto', minHeight: '100vh', padding: '100px 20px 40px' }}>
      <div className="lp-bg-orb lp-bg-orb-left" />
      <div className="lp-bg-orb lp-bg-orb-right" />
      
      {/* Back Button */}
      <div style={{ position: 'fixed', top: '24px', left: '24px', zIndex: 100 }}>
        <button 
          className="btn-outline" 
          onClick={() => setScreen('LANDING')}
          style={{ padding: '8px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}
        >
          <ArrowLeftIcon size={16} /> Back to Hub
        </button>
      </div>

      <div className="container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '60px' }}>
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(124, 58, 237, 0.1)', padding: '8px 16px', borderRadius: '100px', color: 'var(--primary-light)', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '16px' }}
          >
            <TrophyIcon size={16} /> GLOBAL RANKINGS
          </motion.div>
          <motion.h1 
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '12px' }}
          >
            The <span style={{ color: 'var(--primary-light)' }}>Champions</span> Lounge
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ color: 'var(--muted)', maxWidth: '600px', margin: '0 auto' }}
          >
            Track the world's most elite card players. Rankings are updated in real-time based on tournament wins and coin dominance.
          </motion.p>
        </header>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0' }}>
            <div className="loader" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '20px', color: 'var(--muted)' }}>Calculating standings...</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px', alignItems: 'flex-end' }}>
              {/* 2nd Place */}
              {topThree[1] && (
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="lp-game-card"
                  style={{ textAlign: 'center', padding: '24px', height: 'fit-content' }}
                >
                  <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 16px' }}>
                    <AvatarDisplay avatarId={topThree[1].avatar_url} size={80} animated={true} />
                    <div style={{ position: 'absolute', bottom: '-5px', right: '-5px', background: '#94a3b8', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.9rem', border: '4px solid #01080b' }}>2</div>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{topThree[1].username}</h3>
                  <div style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '0.9rem', marginBottom: '12px' }}>{topThree[1].coins} 💰</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <div className="lp-panel-pill" style={{ fontSize: '0.65rem' }}>{topThree[1].wins} Wins</div>
                    <div className="lp-panel-pill" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)' }}>{topThree[1].total_games} Played</div>
                  </div>
                </motion.div>
              )}

              {/* 1st Place */}
              {topThree[0] && (
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="lp-game-card"
                  style={{ textAlign: 'center', padding: '40px 24px', border: '1px solid var(--primary-light)', boxShadow: '0 0 40px rgba(124, 58, 237, 0.2)' }}
                >
                  <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 20px' }}>
                    <CrownIcon size={32} color="var(--gold)" style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)' }} />
                    <AvatarDisplay avatarId={topThree[0].avatar_url} size={100} animated={true} />
                    <div style={{ position: 'absolute', bottom: '-5px', right: '-5px', background: 'var(--gold)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.1rem', border: '4px solid #01080b', color: '#000' }}>1</div>
                  </div>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{topThree[0].username}</h3>
                  <div style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '16px' }}>{topThree[0].coins} 💰</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <div className="lp-panel-pill" style={{ fontSize: '0.75rem', background: 'var(--primary)', color: '#fff' }}>{topThree[0].wins} Wins</div>
                    <div className="lp-panel-pill" style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)' }}>{topThree[0].total_games} Matches</div>
                  </div>
                </motion.div>
              )}

              {/* 3rd Place */}
              {topThree[2] && (
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="lp-game-card"
                  style={{ textAlign: 'center', padding: '24px', height: 'fit-content' }}
                >
                  <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 16px' }}>
                    <AvatarDisplay avatarId={topThree[2].avatar_url} size={80} animated={true} />
                    <div style={{ position: 'absolute', bottom: '-5px', right: '-5px', background: '#b45309', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.9rem', border: '4px solid #01080b' }}>3</div>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{topThree[2].username}</h3>
                  <div style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '0.9rem', marginBottom: '12px' }}>{topThree[2].coins} 💰</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <div className="lp-panel-pill" style={{ fontSize: '0.65rem' }}>{topThree[2].wins} Wins</div>
                    <div className="lp-panel-pill" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)' }}>{topThree[2].total_games} Played</div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* List for the rest */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="lp-hero-panel" 
              style={{ padding: '0', overflow: 'hidden' }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '20px 24px', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800 }}>RANK</th>
                    <th style={{ padding: '20px 24px', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800 }}>PLAYER</th>
                    <th style={{ padding: '20px 24px', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800 }}>WINS</th>
                    <th style={{ padding: '20px 24px', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800 }}>TOTAL GAMES</th>
                    <th style={{ padding: '20px 24px', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800, textAlign: 'right' }}>COINS</th>
                  </tr>
                </thead>
                <tbody>
                  {remaining.map((user, idx) => (
                    <tr key={user.id} className="player-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'all 0.2s' }}>
                      <td style={{ padding: '16px 24px', fontWeight: 900, color: 'var(--muted)' }}>#{idx + 4}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <AvatarDisplay avatarId={user.avatar_url} size={36} />
                          <span style={{ fontWeight: 800 }}>{user.username}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
                          <ShieldIcon size={14} color="var(--primary-light)" />
                          {user.wins}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--muted)', fontSize: '0.9rem' }}>{user.total_games}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 900, color: 'var(--gold)' }}>{user.coins} 💰</td>
                    </tr>
                  ))}
                  {remaining.length === 0 && !loading && (
                    <tr>
                      <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                        Join a game and start winning to climb the ranks!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </motion.div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .lp-game-card:hover { transform: translateY(-5px); border-color: var(--primary-light); }
        .player-row:hover { background: rgba(255,255,255,0.03); }
      `}</style>
    </div>
  );
}
