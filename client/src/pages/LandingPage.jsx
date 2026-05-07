import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../games/bluff/store/useGameStore';
import AuthDialog from '../components/common/AuthDialog';
import {
  SpadeIcon, HeartIcon, DiamondIcon,
  GridIcon, EnergyIcon, LockIcon,
  ShieldIcon, GiftIcon, PlayIcon,
  ArrowRightIcon, UsersIcon, TrophyIcon,
  ChevronDownIcon, CrownIcon, LogOutIcon
} from '../components/common/Icons';
import AvatarDisplay from '../components/common/AvatarDisplay';

export default function LandingPage() {
  const { setScreen, playerName, avatar, user, profile, signOut } = useGameStore();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const requireAuth = (onSuccess) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    onSuccess();
  };

  const metrics = [
    { value: '2.3K+', label: 'players online' },
    { value: '120+', label: 'live rooms' },
    { value: '4', label: 'card titles' }
  ];

  const highlights = [
    {
      icon: <UsersIcon size={20} />,
      title: 'Quick multiplayer',
      text: 'Jump into active tables in seconds.'
    },
    {
      icon: <ShieldIcon size={20} />,
      title: 'Smooth fair play',
      text: 'Clean rounds, secure rooms and balanced flow.'
    },
    {
      icon: <TrophyIcon size={20} />,
      title: 'Competitive climb',
      text: 'Track wins and build your table reputation.'
    }
  ];

  const games = [
    {
      id: 'bluff',
      title: 'Bluff',
      desc: 'Classic Bluff Card Game',
      icon: <SpadeIcon size={48} color="#a78bfa" />,
      status: 'READY TO PLAY',
      statusColor: '#10b981',
      active: true,
      avatars: ['S', 'P', 'G']
    },
    {
      id: 'joker',
      title: 'Joker Game',
      desc: 'Strategy Card Game',
      icon: <CrownIcon size={48} color="#f59e0b" />,
      status: 'UNDER DEVELOPMENT',
      statusColor: '#f59e0b',
      active: false
    },
    {
      id: 'uno',
      title: 'Uno',
      desc: 'Classic Family Game',
      icon: <HeartIcon size={48} color="#ef4444" />,
      status: 'UNDER DEVELOPMENT',
      statusColor: '#f59e0b',
      active: false
    },
    {
      id: 'uno-flip',
      title: 'Uno Flip',
      desc: 'Uno with a Twist',
      icon: <DiamondIcon size={48} color="#c084fc" />,
      status: 'UNDER DEVELOPMENT',
      statusColor: '#f59e0b',
      active: false
    }
  ];


  return (
    <div className="landing-wrapper">
      <div className="lp-bg-orb lp-bg-orb-left" />
      <div className="lp-bg-orb lp-bg-orb-right" />
      <div className="lp-bg-curve" />

      <header className="lp-header">
        <div className="lp-logo">
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SpadeIcon size={20} color="#fff" />
          </div>
          MULTIPLAYER GAMING HUB
        </div>

        <nav className="lp-nav">
          <div className="lp-nav-item active">Home</div>
          <div className="lp-nav-item" onClick={() => setScreen('EXPLORE')}>Games</div>
          <div className="lp-nav-item">Leaderboard</div>
          <div className="lp-nav-item">About Us</div>
        </nav>

        <div className="lp-header-actions">
          {user ? (
            <>
              <div className="glass-panel" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px' }}>
                <EnergyIcon size={18} />
                <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{profile?.coins || 0}</span>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', position: 'relative' }}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <AvatarDisplay
                  avatarId={avatar}
                  playerName={playerName || profile?.username}
                  size={36}
                  animated={true}
                />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{playerName || profile?.username || 'User'}</span>
                <ChevronDownIcon size={16} />

                <AnimatePresence>
                  {showProfileMenu && (
                    <motion.div
                      className="glass-panel profile-dropdown"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                    >
                      <button className="dropdown-item" onClick={() => { setScreen('PROFILE'); setShowProfileMenu(false); }}>
                        <UsersIcon size={16} /> My Profile
                      </button>
                      <button className="dropdown-item" onClick={() => { signOut(); setShowProfileMenu(false); }}>
                        <LogOutIcon size={16} /> Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <button className="lp-btn-login" onClick={() => setIsAuthOpen(true)}>
              Sign In
            </button>
          )}
        </div>
      </header>

      <AuthDialog isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <section className="lp-hero">
        <motion.div
          className="lp-hero-content"
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="lp-kicker">
            <div className="lp-dot" />
            Premium social card lounge
          </div>
          <h1>Compact. Fast. <span>Ready to play.</span></h1>
          <p>
            A tighter landing experience for card players who want instant access,
            live tables and a cleaner multiplayer hub.
          </p>
          <div className="lp-hero-btns">
            <button className="lp-btn-primary" onClick={() => requireAuth(() => setScreen('BLUFF_ENTRY'))}>
              <PlayIcon size={20} />
              Play Bluff Now
            </button>
            <button className="lp-btn-outline" onClick={() => setScreen('EXPLORE')}>
              <GridIcon size={20} />
              Explore Games
            </button>
          </div>
          <div className="lp-metrics-row">
            {metrics.map((metric) => (
              <div key={metric.label} className="lp-metric-card">
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="lp-hero-visual"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="lp-hero-panel">
            <div className="lp-panel-top">
              <div>
                <span className="lp-panel-label">Featured table</span>
                <h3>Game Arena</h3>
              </div>
              <div className="lp-panel-pill">
                <UsersIcon size={16} />
                developed by Shivam
              </div>
            </div>

            <div className="lp-hero-image">
              <img src="/landing_hero_premium.png" alt="Cards" />
            </div>

            <div className="lp-panel-bottom">
              {highlights.map((item, idx) => (
                <motion.div
                  key={item.title}
                  className="lp-highlight-card"
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25 + idx * 0.08 }}
                >
                  <div className="lp-highlight-icon">{item.icon}</div>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.text}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      <section className="lp-games-section">
        <div className="header lp-section-header">
          <div className="lp-section-title">
            <h2>Our Games</h2>
            <p>Shortlist your next table and jump straight in.</p>
          </div>
          <div className="lp-filter-pill">
            <span>All Games</span>
            <ChevronDownIcon size={16} />
          </div>
        </div>

        <div className="lp-game-grid">
          {games.map((game, idx) => (
            <motion.div
              key={game.id}
              className={`lp-game-card ${game.active ? 'active' : ''}`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + idx * 0.1 }}
              onClick={() => game.active && requireAuth(() => setScreen('BLUFF_ENTRY'))}
            >
              <div className="lp-game-badge" style={{ color: game.statusColor }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: game.statusColor }} />
                {game.status}
              </div>

              <div className="lp-game-icon-container">
                {game.icon}
              </div>

              <h4>{game.title}</h4>
              <p>{game.desc}</p>

              <div style={{ flex: 1 }} />

              <div className="lp-card-footer">
                <div style={{ display: 'flex', gap: '4px' }}>
                  {game.avatars?.map((a, i) => (
                    <div key={i} style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: i === 0 ? '#f97316' : i === 1 ? '#10b981' : '#64748b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 800, border: '1.5px solid #01080b'
                    }}>
                      {a}
                    </div>
                  ))}
                </div>
                {game.active ? (
                  <div style={{ color: '#a78bfa', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Play Now <ArrowRightIcon size={16} />
                  </div>
                ) : (
                  <div style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800 }}>
                    Coming Soon <LockIcon size={16} />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <motion.div
        className="lp-features-bar"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <div className="lp-feature">
          <div className="lp-feature-icon"><UsersIcon size={24} /></div>
          <div className="lp-feature-text">
            <h5>Real Players</h5>
            <p>Play with real people from around the world</p>
          </div>
        </div>
        <div className="lp-feature">
          <div className="lp-feature-icon"><ShieldIcon size={24} /></div>
          <div className="lp-feature-text">
            <h5>Fair Play</h5>
            <p>Our games are 100% fair and secure</p>
          </div>
        </div>
        <div className="lp-feature">
          <div className="lp-feature-icon"><TrophyIcon size={24} /></div>
          <div className="lp-feature-text">
            <h5>Leaderboards</h5>
            <p>Compete and climb the global rankings</p>
          </div>
        </div>
        <div className="lp-feature">
          <div className="lp-feature-icon"><GiftIcon size={24} /></div>
          <div className="lp-feature-text">
            <h5>Rewards</h5>
            <p>Win games and earn exciting rewards</p>
          </div>
        </div>
      </motion.div>

      <footer className="lp-footer">
        © 2026 THE BLUFF Multiplayer Platform. All rights reserved.
      </footer>
    </div>
  );
}
