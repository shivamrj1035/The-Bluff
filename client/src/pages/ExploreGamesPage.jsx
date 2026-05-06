import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../games/bluff/store/useGameStore';
import AuthDialog from '../components/common/AuthDialog';
import {
  SpadeIcon,
  GridIcon, EnergyIcon,
  UsersIcon, TrophyIcon,
  ChevronDownIcon, CrownIcon, HomeIcon,
  SearchIcon, BellIcon, SettingsIcon, StoreIcon,
  LogOutIcon
} from '../components/common/Icons';

/**
 * ExploreGamesPage — Detailed game discovery interface.
 * Implements the premium dark UI from the provided mockup.
 */
export default function ExploreGamesPage() {
  const { setScreen, playerName, avatar, user, profile, signOut } = useGameStore();
  const [activeTab, setActiveTab] = useState('All Games');
  const [sortBy, setSortBy] = useState('Popular');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const requireAuth = (onSuccess) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    onSuccess();
  };

  const tabs = ['All Games', 'Popular', 'Classic', 'Strategy', 'Party', 'Quick Play'];

  const games = [
    {
      id: 'bluff',
      title: 'Bluff Jokker',
      desc: 'Lie, bluff and win it all!',
      players: '2-6 Players',
      time: '15-30 min',
      status: 'READY TO PLAY',
      isNew: true,
      image: '/tash_thumbnail.png',
      active: true,
      accent: '#7c3aed'
    },
    {
      id: 'joker',
      title: 'Joker Game',
      desc: 'Master the wild card!',
      players: '2-4 Players',
      time: '20-40 min',
      status: 'UNDER DEVELOPMENT',
      image: '/tash_thumbnail.png',
      active: false,
      accent: '#f59e0b'
    },
    {
      id: 'uno',
      title: 'UNO',
      desc: 'The classic card game!',
      players: '2-10 Players',
      time: '10-20 min',
      status: 'UNDER DEVELOPMENT',
      isPopular: true,
      image: '/uno_thumbnail.png',
      active: false,
      accent: '#ef4444'
    },
    {
      id: 'uno-flip',
      title: 'UNO Flip',
      desc: 'Flip the deck, change the game!',
      players: '2-10 Players',
      time: '15-30 min',
      status: 'UNDER DEVELOPMENT',
      image: '/uno_thumbnail.png',
      active: false,
      accent: '#06b6d4'
    },
    {
      id: 'plan',
      title: 'Plan Game',
      desc: 'Strategize and outsmart your opponents!',
      players: '2-4 Players',
      time: '20-40 min',
      status: 'UNDER DEVELOPMENT',
      image: '/tash_thumbnail.png',
      active: false,
      accent: '#8b5cf6'
    },
    {
      id: 'sircoat',
      title: 'SirCoat',
      desc: 'Trick, play and rule the court!',
      players: '3-6 Players',
      time: '20-40 min',
      status: 'UNDER DEVELOPMENT',
      image: '/tash_thumbnail.png',
      active: false,
      accent: '#f59e0b'
    },
    {
      id: 'teen-patti',
      title: 'Teen Patti',
      desc: 'India\'s most loved card game!',
      players: '3-6 Players',
      time: '20-30 min',
      status: 'UNDER DEVELOPMENT',
      image: '/tash_thumbnail.png',
      active: false,
      accent: '#7c3aed'
    }
  ];

  return (
    <div className="explore-container">
      <AuthDialog isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {/* Sidebar */}
      <aside className="explore-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <SpadeIcon size={24} color="#fff" />
          </div>
          <span>GAMING HUB</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-item" onClick={() => setScreen('LANDING')}>
            <HomeIcon size={20} />
            <span>Home</span>
          </div>
          <div className="nav-item active">
            <GridIcon size={20} />
            <span>Explore Games</span>
          </div>
          <div className="nav-item">
            <TrophyIcon size={20} />
            <span>My Tables</span>
          </div>
          <div className="nav-item">
            <UsersIcon size={20} />
            <span>Friends</span>
          </div>
          <div className="nav-item">
            <TrophyIcon size={20} />
            <span>Leaderboard</span>
          </div>
          <div className="nav-item">
            <StoreIcon size={20} />
            <span>Store</span>
          </div>
          <div className="nav-item">
            <SettingsIcon size={20} />
            <span>Settings</span>
          </div>
        </nav>

        <div className="sidebar-promo">
          <div className="promo-icon">
            <TrophyIcon size={24} color="#a78bfa" />
          </div>
          <h5>Invite & Earn</h5>
          <p>Invite your friends and earn exciting rewards</p>
          <button className="promo-btn">Invite Now</button>
        </div>

        <div className="sidebar-footer">
          <p>© 2025 The Bluff</p>
          <p>All rights reserved.</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="explore-main">
        <header className="explore-header">
          <div className="search-bar">
            <SearchIcon size={18} color="#64748b" />
            <input type="text" placeholder="Search games..." />
            <kbd>⌘</kbd>
          </div>

          <div className="header-actions">
            <div className="header-stats">
              <div className="stat-pill">
                <EnergyIcon size={16} color="#f97316" />
                <span>{profile?.coins || 0}</span>
              </div>
              <div className="icon-btn">
                <BellIcon size={20} color="#64748b" />
                <span className="notification-dot" />
              </div>
            </div>

            <div className="header-user">
              {user ? (
                <div
                  className="user-avatar-pill"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  style={{ position: 'relative', cursor: 'pointer' }}
                >
                  <div className="user-avatar" style={{ background: '#f97316' }}>
                    {avatar || (profile?.username?.charAt(0)) || 'U'}
                  </div>
                  <div className="user-info">
                    <span className="user-name">{playerName || profile?.username || 'User'}</span>
                    <span className="user-status"><span className="status-dot" /> Online</span>
                  </div>
                  <ChevronDownIcon size={14} color="#64748b" />

                  <AnimatePresence>
                    {showProfileMenu && (
                      <motion.div
                        className="glass-panel profile-dropdown"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        style={{ top: '100%', right: 0, marginTop: '12px', position: 'absolute', zIndex: 100 }}
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
                <button className="lp-btn-login" onClick={() => setIsAuthOpen(true)}>
                  Sign In
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="explore-hero">
          <div className="hero-text">
            <h1>EXPLORE <span>GAMES</span> <span className="hero-stars">✨</span></h1>
            <p>Choose your game, challenge your friends and show your game skills.</p>
          </div>

          <div className="filter-bar">
            <div className="tab-group">
              {tabs.map(tab => (
                <button
                  key={tab}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="sort-dropdown">
              <span className="sort-label">Sort by:</span>
              <div className="sort-select">
                <span className="sort-value">{sortBy}</span>
                <ChevronDownIcon size={16} />
              </div>
            </div>
          </div>
        </section>

        <div className="explore-grid">
          {games.map((game, idx) => (
            <motion.div
              key={game.id}
              className={`game-explore-card ${game.active ? 'active' : ''}`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => game.active && requireAuth(() => setScreen('BLUFF_ENTRY'))}
            >
              <div className="card-media">
                <img src={game.image} alt={game.title} />
                {game.isNew && <span className="badge-new">NEW</span>}
                {game.isPopular && <span className="badge-popular">POPULAR</span>}
              </div>

              <div className="card-body">
                <h3>{game.title}</h3>
                <p className="card-desc">{game.desc}</p>

                <div className="card-stats">
                  <div className="stat-item">
                    <UsersIcon size={14} />
                    <span>{game.players}</span>
                  </div>
                  <div className="stat-item">
                    <EnergyIcon size={14} />
                    <span>{game.time}</span>
                  </div>
                </div>

                <button
                  className={`card-action-btn ${game.active ? 'active' : 'disabled'}`}
                  disabled={!game.active}
                >
                  {game.status}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="coming-soon-banner">
          <div className="banner-icon">
            <CrownIcon size={24} color="#f59e0b" />
          </div>
          <div className="banner-content">
            <h4>More games coming soon!</h4>
            <p>We are working hard to bring more exciting games for you.</p>
          </div>
          <button className="banner-btn">
            <BellIcon size={16} />
            Stay Tuned
          </button>
        </div>
      </main>
    </div>
  );
}
