import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../games/bluff/store/useGameStore';
import { useCPStore } from '../games/courtpiece/store/useCPStore';
import { useMCStore } from '../games/mendicoat/store/useMCStore';
import { useJKStore } from '../games/joker/store/useJKStore';
import AuthDialog from '../components/common/AuthDialog';
import {
  GridIcon, EnergyIcon, LockIcon,
  ShieldIcon, GiftIcon, PlayIcon,
  ArrowRightIcon, UsersIcon, TrophyIcon,
  ChevronDownIcon, CrownIcon, LogOutIcon, SettingsIcon
} from '../components/common/Icons';
import AvatarDisplay from '../components/common/AvatarDisplay';
import { REGISTERED_GAMES, isGameActive } from '../constants/registeredGames';

export default function LandingPage() {
  const { setScreen, playerName, avatar, user, profile, signOut, siteSettings, isAdmin } = useGameStore();
  const { setCPScreen } = useCPStore();
  const { setMCScreen } = useMCStore();
  const { setJKScreen } = useJKStore();
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
    else if (gameType === 'joker') setJKScreen(screen);
    else setScreen(screen);
  };

  useEffect(() => {
    if (!user || !pendingScreen) return;
    
    if (pendingGameType === 'courtpiece') setCPScreen(pendingScreen);
    else if (pendingGameType === 'mendicoat') setMCScreen(pendingScreen);
    else if (pendingGameType === 'joker') setJKScreen(pendingScreen);
    else setScreen(pendingScreen);

    setPendingScreen(null);
  }, [pendingScreen, setScreen, setCPScreen, setMCScreen, setJKScreen, user, pendingGameType]);

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

  const games = REGISTERED_GAMES.map(g => {
    const active = isGameActive(g.id, siteSettings?.enabled_games);
    return {
      ...g,
      active: active,
      status: active ? 'READY TO PLAY' : 'COMING SOON',
      statusColor: active ? '#10b981' : '#f59e0b',
      avatars: ['S', 'P', 'G']
    };
  });


  return (
    <div className="landing-wrapper">
      <div className="lp-bg-orb lp-bg-orb-left" />
      <div className="lp-bg-orb lp-bg-orb-right" />
      <div className="lp-bg-curve" />

      <header className="lp-header">
        <div className="lp-logo" onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
          <img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'contain' }} />
          {siteSettings?.header_title || 'MULTIPLAYER GAMING HUB'}
        </div>

        <nav className="lp-nav">
          <div className="lp-nav-item active">Home</div>
          <div className="lp-nav-item" onClick={() => setScreen('EXPLORE')}>Games</div>
          <div className="lp-nav-item" onClick={() => setScreen('LEADERBOARD')}>Leaderboard</div>
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
          <h1>{siteSettings?.hero_title?.split('.').map((part, i, arr) => (
            <React.Fragment key={i}>
              {i === arr.length - 1 ? <span>{part}</span> : part + (i < arr.length - 1 ? '.' : '')}
            </React.Fragment>
          )) || <>Compact. Fast. <span>Ready to play.</span></>}</h1>
          <p>
            {siteSettings?.hero_subtitle || 'A tighter landing experience for card players who want instant access, live tables and a cleaner multiplayer hub.'}
          </p>
          <div className="lp-hero-btns">
            {/* <button className="lp-btn-primary" onClick={() => goToProtectedScreen('BLUFF_ENTRY')}>
              <PlayIcon size={20} />
              Play Bluff Now
            </button> */}
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
                Crafted by Shivam, Prachi
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
              onClick={() => {
                if (!game.active) return;
                if (game.entryScreen === 'BLUFF_ENTRY') goToProtectedScreen('BLUFF_ENTRY', 'bluff');
                else if (game.entryScreen === 'CP_ENTRY') goToProtectedScreen('CP_ENTRY', 'courtpiece');
                else if (game.entryScreen === 'MC_ENTRY') goToProtectedScreen('MC_ENTRY', 'mendicoat');
                else if (game.entryScreen === 'JK_ENTRY') goToProtectedScreen('JK_ENTRY', 'joker');
              }}
            >
              <div className="lp-game-media">
                <img src={game.image} alt={game.title} className="lp-game-thumbnail" />
                <div className="lp-card-overlay" />
                <div className="lp-game-badge" style={{ color: game.statusColor }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: game.statusColor }} />
                  {game.status}
                </div>
              </div>

              <div className="lp-card-body">
                <h4>{game.title}</h4>
                <p>{game.desc}</p>

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
                    <div style={{ color: 'var(--primary-light)', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Play Now <ArrowRightIcon size={16} />
                    </div>
                  ) : (
                    <div style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800 }}>
                      Coming Soon <LockIcon size={16} />
                    </div>
                  )}
                </div>
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
        <div className="lp-feature" onClick={() => setScreen('LEADERBOARD')} style={{ cursor: 'pointer' }}>
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
        © 2026 Card Nexus Multiplayer Platform. All rights reserved.
      </footer>
    </div>
  );
}
