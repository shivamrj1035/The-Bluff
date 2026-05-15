import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, applyTheme } from '../games/bluff/store/useGameStore';
import { THEME_DEFAULTS } from '../games/bluff/store/useGameStore';
import {
  SettingsIcon, GridIcon, UsersIcon, TrophyIcon, 
  ArrowLeftIcon, EnergyIcon, TrashIcon, XIcon,
  PlayIcon, ShieldIcon, CrownIcon
} from '../components/common/Icons';
import { REGISTERED_GAMES } from '../constants/registeredGames';

const TABS = [
  { id: 'stats', label: 'Dashboard', icon: <EnergyIcon size={18} /> },
  { id: 'rooms', label: 'Live Rooms', icon: <GridIcon size={18} /> },
  { id: 'cms', label: 'CMS & Theme', icon: <SettingsIcon size={18} /> },
  { id: 'users', label: 'Players', icon: <UsersIcon size={18} /> },
];

export default function AdminPage() {
  const { setScreen, siteSettings, updateSettings, resetTheme, isAdmin, getAuthToken } = useGameStore();
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [cmsData, setCmsData] = useState(siteSettings || {});

  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
  const apiBase = SOCKET_URL.replace(/\/$/, '');

  // Sync cmsData when siteSettings arrive from store
  useEffect(() => {
    if (siteSettings) {
      setCmsData(siteSettings);
    }
  }, [siteSettings]);

  useEffect(() => {
    if (!isAdmin()) {
      setScreen('LANDING');
      return;
    }
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    const token = await getAuthToken();
    try {
      if (activeTab === 'stats') {
        const res = await fetch(`${apiBase}/api/admin/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setStats(await res.json());
      } else if (activeTab === 'rooms') {
        const res = await fetch(`${apiBase}/api/admin/rooms`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setRooms(Array.isArray(data) ? data : []);
      } else if (activeTab === 'users') {
        const res = await fetch(`${apiBase}/api/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    await updateSettings(cmsData);
    setLoading(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleResetTheme = async () => {
    setLoading(true);
    await resetTheme();
    setCmsData(prev => ({ ...prev, theme: {} }));
    setLoading(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleTerminateRoom = async (roomId) => {
    if (!window.confirm(`Are you sure you want to terminate room ${roomId}? This will kick all players.`)) return;
    const token = await getAuthToken();
    try {
      const res = await fetch(`${apiBase}/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRooms(prev => prev.filter(r => r.roomId !== roomId));
      }
    } catch (err) {
      console.error('Room termination error:', err);
    }
  };

  const handleToggleBlock = async (user) => {
    const action = user.is_blocked ? 'unblock' : 'block';
    if (!window.confirm(`Are you sure you want to ${action} user ${user.username}?`)) return;
    const token = await getAuthToken();
    try {
      const res = await fetch(`${apiBase}/api/admin/users/${user.id}/${action}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_blocked: !user.is_blocked } : u));
      }
    } catch (err) {
      console.error('User block toggle error:', err);
    }
  };

  const handleToggleGame = (gameId) => {
    const enabled = cmsData.enabled_games || [];
    const newEnabled = enabled.includes(gameId)
      ? enabled.filter(id => id !== gameId)
      : [...enabled, gameId];
    setCmsData({ ...cmsData, enabled_games: newEnabled });
  };

  return (
    <div className="landing-wrapper" style={{ overflowY: 'auto' }}>
      <div className="lp-bg-orb lp-bg-orb-left" />
      <div className="lp-bg-orb lp-bg-orb-right" />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 10 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="btn-outline btn-sm" onClick={() => setScreen('LANDING')} style={{ width: 'auto' }}>
              <ArrowLeftIcon size={16} /> Back
            </button>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 900 }}>Admin <span style={{ color: 'var(--primary)' }}>Panel</span></h1>
          </div>
          <div className="lp-panel-pill">
            <ShieldIcon size={16} /> Authorized Administrator
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '32px' }}>
          {/* Sidebar */}
          <aside className="panel" style={{ padding: '12px', height: 'fit-content' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === tab.id ? 'var(--border-bright)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--primary-light)' : 'var(--dim)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: '4px'
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </aside>

          {/* Main Content */}
          <main className="panel" style={{ minHeight: '600px' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'stats' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                    <div className="lp-metric-card" style={{ padding: '30px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>ACTIVE ROOMS</span>
                      <div style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '10px' }}>{stats?.activeRooms || 0}</div>
                    </div>
                    <div className="lp-metric-card" style={{ padding: '30px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>PLAYERS ONLINE</span>
                      <div style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '10px' }}>{stats?.totalPlayers || 0}</div>
                    </div>
                    <div className="lp-metric-card" style={{ padding: '30px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>TOTAL USERS</span>
                      <div style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '10px' }}>{stats?.registeredUsers || 0}</div>
                    </div>
                    <div className="lp-metric-card" style={{ padding: '30px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>TOTAL ROOMS</span>
                      <div style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '10px', color: 'var(--primary)' }}>{stats?.totalRoomsCreated || 0}</div>
                    </div>
                  </div>
                )}

                {activeTab === 'rooms' && (
                  <div>
                    <h3 style={{ marginBottom: '20px' }}>Live Game Tables</h3>
                    {!Array.isArray(rooms) || rooms.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No active rooms or access denied.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '12px' }}>Room ID</th>
                            <th style={{ padding: '12px' }}>State</th>
                            <th style={{ padding: '12px' }}>Players</th>
                            <th style={{ padding: '12px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rooms.map(room => (
                            <tr key={room.roomId} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '12px', fontWeight: 700 }}>{room.roomId}</td>
                              <td style={{ padding: '12px' }}><span className="lp-panel-pill" style={{ fontSize: '0.7rem' }}>{room.state}</span></td>
                              <td style={{ padding: '12px' }}>{room.players.length} online</td>
                              <td style={{ padding: '12px' }}>
                                <button 
                                  className="btn-red btn-sm" 
                                  style={{ width: 'auto' }}
                                  onClick={() => handleTerminateRoom(room.roomId)}
                                >
                                  <TrashIcon size={14} /> Close
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === 'cms' && (
                  <div className="admin-cms-container">
                    <div className="admin-grid">
                      {/* --- Site Content Card --- */}
                      <div className="admin-card">
                        <div className="admin-card-header">
                          <SettingsIcon size={20} />
                          <h3>Site Content</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div className="admin-form-group">
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>Header Title</label>
                            <input 
                              className="inp" 
                              placeholder="e.g. GameArena"
                              value={cmsData.header_title || ''} 
                              onChange={e => setCmsData({...cmsData, header_title: e.target.value})}
                            />
                          </div>
                          <div className="admin-form-group">
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>Hero Title</label>
                            <input 
                              className="inp" 
                              placeholder="e.g. The Ultimate Card Game Hub"
                              value={cmsData.hero_title || ''} 
                              onChange={e => setCmsData({...cmsData, hero_title: e.target.value})}
                            />
                          </div>
                          <div className="admin-form-group">
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>Hero Description</label>
                            <textarea 
                              className="inp" 
                              rows="3" 
                              style={{ resize: 'none' }}
                              placeholder="Enter sub-text for landing page..."
                              value={cmsData.hero_subtitle || ''} 
                              onChange={e => setCmsData({...cmsData, hero_subtitle: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>

                      {/* --- Registered Games Card --- */}
                      <div className="admin-card">
                        <div className="admin-card-header">
                          <GridIcon size={20} />
                          <h3>Registered Games</h3>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '16px' }}>
                          Enable or disable games globally on the landing page.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {REGISTERED_GAMES.map(game => (
                            <div key={game.id} className="player-row" style={{ 
                              justifyContent: 'space-between', 
                              background: 'rgba(255,255,255,0.02)',
                              padding: '12px 16px',
                              borderRadius: '12px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ 
                                  width: '32px', height: '32px', borderRadius: '8px', 
                                  background: game.accent + '22', display: 'flex', 
                                  alignItems: 'center', justifyContent: 'center' 
                                }}>
                                  <PlayIcon size={16} color={game.accent} />
                                </div>
                                <span style={{ fontWeight: 700 }}>{game.title}</span>
                              </div>
                              <label className="admin-switch">
                                <input 
                                  type="checkbox" 
                                  checked={cmsData.enabled_games?.includes(game.id)} 
                                  onChange={() => handleToggleGame(game.id)}
                                />
                                <span className="admin-slider"></span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* --- Color Theme Card --- */}
                    <div className="admin-card" style={{ width: '100%' }}>
                      <div className="admin-card-header" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <SettingsIcon size={20} />
                          <h3>Visual Branding & Theme</h3>
                        </div>
                        <button
                          onClick={handleResetTheme}
                          disabled={loading}
                          className="btn-outline btn-sm"
                          style={{ width: 'auto', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--red)' }}
                        >
                          Reset to Defaults
                        </button>
                      </div>

                      {/* Live preview swatch strip */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', height: '40px', borderRadius: '12px', overflow: 'hidden', padding: '4px', background: 'rgba(0,0,0,0.2)' }}>
                        {[
                          cmsData.theme?.primary       || THEME_DEFAULTS.primary,
                          cmsData.theme?.primaryLight  || THEME_DEFAULTS.primaryLight,
                          cmsData.theme?.secondary     || THEME_DEFAULTS.secondary,
                          cmsData.theme?.gold          || THEME_DEFAULTS.gold,
                          cmsData.theme?.green         || THEME_DEFAULTS.green,
                          cmsData.theme?.red           || THEME_DEFAULTS.red,
                          cmsData.theme?.bg2           || THEME_DEFAULTS.bg2,
                          cmsData.theme?.bg            || THEME_DEFAULTS.bg,
                        ].map((color, i) => (
                          <div key={i} style={{ flex: 1, background: color, borderRadius: '6px', transition: 'background 0.3s', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)' }} />
                        ))}
                      </div>

                      <div className="admin-grid">
                        {[
                          { label: 'Primary Brand',  key: 'primary' },
                          { label: 'Light Accent',   key: 'primaryLight' },
                          { label: 'Secondary',      key: 'secondary' },
                          { label: 'Main BG',        key: 'bg' },
                          { label: 'Surface/Card',   key: 'bg2' },
                          { label: 'Base Text',      key: 'text' },
                          { label: 'Muted Text',     key: 'muted' },
                          { label: 'Gold/Coins',     key: 'gold' },
                          { label: 'Success/Win',    key: 'green' },
                          { label: 'Danger/Error',   key: 'red' },
                        ].map(({ label, key }) => {
                          const currentVal = cmsData.theme?.[key] || THEME_DEFAULTS[key];
                          return (
                            <div key={key} style={{ 
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '12px', borderRadius: '12px',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                              <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                                <div style={{
                                  width: '100%', height: '100%', borderRadius: '8px',
                                  background: currentVal, border: '2px solid rgba(255,255,255,0.1)',
                                  boxShadow: `0 4px 12px ${currentVal}44`, cursor: 'pointer'
                                }}>
                                  <input
                                    type="color"
                                    value={currentVal}
                                    onChange={e => {
                                      const newTheme = { ...cmsData.theme, [key]: e.target.value };
                                      setCmsData({ ...cmsData, theme: newTheme });
                                      applyTheme(newTheme);
                                    }}
                                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                  />
                                </div>
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '2px' }}>{label}</div>
                                <code style={{ fontSize: '0.8rem', color: currentVal, fontWeight: 800 }}>{currentVal.toUpperCase()}</code>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* --- Sticky Action Footer --- */}
                    <div className="admin-sticky-footer">
                      <div className="admin-footer-info">
                        <ShieldIcon size={18} />
                        <span>You have unsaved changes in the CMS configuration.</span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          className="btn btn-primary"
                          onClick={handleSaveSettings}
                          disabled={loading}
                          style={{ minWidth: '200px' }}
                        >
                          {loading ? 'Saving...' : saveSuccess ? '✓ Settings Saved' : 'Save Configuration'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div>
                    <h3 style={{ marginBottom: '20px' }}>Registered Players</h3>
                    {!Array.isArray(users) || users.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No users found or access denied.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {users.map(u => (
                          <div key={u.id} className="player-row" style={{ padding: '16px', opacity: u.is_blocked ? 0.6 : 1, border: u.is_blocked ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border)' }}>
                            <div style={{
                              width: '40px', height: '40px', borderRadius: '50%', background: u.is_blocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.1)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
                            }}>
                              {u.avatar_url?.length <= 2 ? u.avatar_url : '👤'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {u.username}
                                {u.is_blocked && <span style={{ fontSize: '0.6rem', background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>BLOCKED</span>}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>ID: {u.id}</div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div>
                                <div style={{ fontWeight: 900, color: 'var(--gold)' }}>{u.coins} 💰</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Joined {new Date(u.created_at).toLocaleDateString()}</div>
                              </div>
                              <button 
                                onClick={() => handleToggleBlock(u)}
                                className={u.is_blocked ? "btn-outline btn-sm" : "btn-red btn-sm"}
                                style={{ width: 'auto', minWidth: '100px' }}
                              >
                                {u.is_blocked ? 'Unblock' : 'Block User'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
