import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClerk } from '@clerk/clerk-react';
import { useGameStore } from '../games/bluff/store/useGameStore';
import {
  SpadeIcon, HeartIcon, DiamondIcon,
  GridIcon, EnergyIcon, LockIcon,
  ShieldIcon, GiftIcon, PlayIcon,
  ArrowRightIcon, UsersIcon, TrophyIcon,
  ChevronDownIcon, CrownIcon, LogOutIcon
} from '../components/common/Icons';
import AvatarDisplay from '../components/common/AvatarDisplay';

export default function LandingPage() {
  const { setScreen, playerName, avatar, user, profile } = useGameStore();
  const { openSignIn, signOut } = useClerk();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const requireAuth = (onSuccess) => {
    if (!user) {
      openSignIn();
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
        <div className="lp-logo" onClick={() => setScreen('LANDING')}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SpadeIcon size={20} color="#fff" />
          </div>
          <span>The Bluff</span>
        </div>

        <nav className="lp-nav">
          <a href="#games">Games</a>
          <a href="#about">About</a>
          <a href="#leaderboard">Leaderboard</a>
        </nav>

        <div className="lp-auth">
          {user ? (
            <div className="user-profile-trigger" onClick={() => setShowProfileMenu(!showProfileMenu)} style={{ position: 'relative' }}>
              <div className="user-avatar-pill">
                <AvatarDisplay
                  avatarId={avatar}
                  playerName={playerName || profile?.username}
                  size={32}
                  animated={true}
                />
                <span className="user-name">{playerName || profile?.username || 'User'}</span>
                <ChevronDownIcon size={14} color="#64748b" />
              </div>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    className="glass-panel profile-dropdown"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{ top: '100%', right: 0, marginTop: '8px', position: 'absolute', zIndex: 100 }}
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
          ) : (
            <button className="lp-btn-login" onClick={() => openSignIn()}>
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="lp-main">
        {/* Hero Section */}
        <section className="lp-hero">
          <motion.div
            className="hero-badge"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <EnergyIcon size={14} color="#a78bfa" />
            <span>Multiplayer Card Hub</span>
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Where Skills Meet <br />
            <span>Strategic Bluff</span>
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Join the most thrilling multiplayer card platform. Challenge friends,
            climb leaderboards, and master the art of the bluff.
          </motion.p>

          <motion.div
            className="hero-cta"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <button className="lp-btn-primary" onClick={() => setScreen('EXPLORE')}>
              Explore Games <ArrowRightIcon size={18} />
            </button>
            <div className="hero-metrics">
              {metrics.map((m, i) => (
                <div key={i} className="metric-item">
                  <span className="metric-val">{m.value}</span>
                  <span className="metric-label">{m.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Feature Highlights */}
        <section className="lp-highlights">
          {highlights.map((h, i) => (
            <motion.div
              key={i}
              className="highlight-card glass-panel"
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="highlight-icon">{h.icon}</div>
              <h3>{h.title}</h3>
              <p>{h.text}</p>
            </motion.div>
          ))}
        </section>

        {/* Games Section */}
        <section id="games" className="lp-games">
          <div className="section-header">
            <h2>Featured <span>Games</span></h2>
            <p>Our collection of classic and modern card games.</p>
          </div>

          <div className="game-grid">
            {games.map((game, i) => (
              <motion.div
                key={i}
                className={`game-card glass-panel ${game.active ? 'active' : ''}`}
                initial={{ scale: 0.95, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                onClick={() => game.active && setScreen('EXPLORE')}
              >
                <div className="game-card-icon">{game.icon}</div>
                <h3>{game.title}</h3>
                <p>{game.desc}</p>
                <div className="game-status" style={{ color: game.statusColor }}>
                  <span className="status-dot" style={{ backgroundColor: game.statusColor }} />
                  {game.status}
                </div>
                {game.active && (
                  <button className="game-play-btn">
                    <PlayIcon size={16} />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </section>

        {/* Community Section */}
        <section id="about" className="lp-community glass-panel">
          <div className="community-content">
            <div className="community-text">
              <div className="badge-promo">
                <GiftIcon size={14} />
                <span>Beta Season Rewards</span>
              </div>
              <h2>Join the <span>Elite Club</span></h2>
              <p>
                Create your profile today and get 500 free coins to start your journey.
                Participate in tournaments and win exclusive card skins.
              </p>
              <button className="lp-btn-outline" onClick={() => requireAuth(() => setScreen('PROFILE'))}>
                {user ? 'View My Profile' : 'Create Your Account'}
              </button>
            </div>
            <div className="community-visual">
              <div className="avatar-stack">
                <AvatarDisplay avatarId="S" size={60} />
                <AvatarDisplay avatarId="P" size={60} />
                <AvatarDisplay avatarId="G" size={60} />
                <div className="avatar-more">+4k</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <SpadeIcon size={24} color="#7c3aed" />
            <span>The Bluff</span>
          </div>
          <div className="footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Support</a>
          </div>
          <div className="footer-copy">
            © 2025 The Bluff. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
