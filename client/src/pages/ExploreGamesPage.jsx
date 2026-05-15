import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../games/bluff/store/useGameStore';
import { useCPStore } from '../games/courtpiece/store/useCPStore';
import { useMCStore } from '../games/mendicoat/store/useMCStore';
import AuthDialog from '../components/common/AuthDialog';
import AvatarDisplay from '../components/common/AvatarDisplay';
import { REGISTERED_GAMES, isGameActive } from '../constants/registeredGames';
import {
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
  const { setScreen, playerName, avatar, user, profile, signOut, siteSettings, isAdmin } = useGameStore();
  const { setCPScreen } = useCPStore();
  const { setMCScreen } = useMCStore();
  const [activeTab, setActiveTab] = useState('All Games');
  const [sortBy, setSortBy] = useState('Popular');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [pendingScreen, setPendingScreen] = useState(null);
  const [pendingGameType, setPendingGameType] = useState('bluff');

  const goToProtectedScreen = (screen, gameType = 'bluff') => {
    if (!user) {
      setPendingScreen(screen);
      setPendingGameType(gameType);
      setIsAuthOpen(true);
      return;
    }
    
    if (gameType === 'courtpiece') setCPScreen(screen);
    else if (gameType === 'mendicoat') setMCScreen(screen);
    else setScreen(screen);
  };

  useEffect(() => {
    if (!user || !pendingScreen) return;
    
    if (pendingGameType === 'courtpiece') setCPScreen(pendingScreen);
    else if (pendingGameType === 'mendicoat') setMCScreen(pendingScreen);
    else setScreen(pendingScreen);

    setPendingScreen(null);
  }, [pendingScreen, setScreen, setCPScreen, setMCScreen, user, pendingGameType]);

  const tabs = ['All Games', 'Popular', 'Classic', 'Strategy', 'Party', 'Quick Play'];

  // Map registry to UI-ready game objects
  const games = REGISTERED_GAMES.map(g => {
    const active = isGameActive(g.id, siteSettings?.enabled_games);
    return {
      ...g,
      active,
      status: active ? 'READY TO PLAY' : 'COMING SOON'
    };
  });

  return (
    <div className="explore-container">
      <AuthDialog isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {/* Sidebar */}
      <aside className="explore-sidebar">
        <div className="sidebar-logo" onClick={() => setScreen('LANDING')}>
          <img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }} />
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
          <div className="nav-item" onClick={() => setScreen('LEADERBOARD')}>
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
            <TrophyIcon size={24} color="var(--primary-light)" />
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
                  <AvatarDisplay
                    avatarId={avatar}
                    playerName={playerName || profile?.username}
                    size={36}
                    animated={true}
                  />
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
                        {isAdmin() && (
                          <button className="dropdown-item" onClick={() => { setScreen('ADMIN'); setShowProfileMenu(false); }} style={{ color: 'var(--primary-light)' }}>
                            <SettingsIcon size={16} /> Admin Panel
                          </button>
                        )}
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
            <h1>EXPLORE <span style={{ color: 'var(--primary)' }}>GAMES</span> <span className="hero-stars">✨</span></h1>
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
              onClick={() => {
                if (!game.active) return;
                if (game.entryScreen === 'BLUFF_ENTRY') goToProtectedScreen('BLUFF_ENTRY', 'bluff');
                else if (game.entryScreen === 'CP_ENTRY') goToProtectedScreen('CP_ENTRY', 'courtpiece');
                else if (game.entryScreen === 'MC_ENTRY') goToProtectedScreen('MC_ENTRY', 'mendicoat');
              }}
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
