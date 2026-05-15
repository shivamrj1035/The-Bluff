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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>Header Title</label>
                      <input 
                        className="inp" 
                        value={cmsData.header_title || ''} 
                        onChange={e => setCmsData({...cmsData, header_title: e.target.value})}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>Hero Title</label>
                      <input 
                        className="inp" 
                        value={cmsData.hero_title || ''} 
                        onChange={e => setCmsData({...cmsData, hero_title: e.target.value})}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>Hero Description</label>
                      <textarea 
                        className="inp" 
                        rows="3" 
                        style={{ resize: 'none' }}
                        value={cmsData.hero_subtitle || ''} 
                        onChange={e => setCmsData({...cmsData, hero_subtitle: e.target.value})}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.9rem', fontWeight: 700 }}>Enabled Games</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        {REGISTERED_GAMES.map(game => (
                          <div key={game.id} className="player-row" style={{ justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: game.accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <PlayIcon size={16} color={game.accent} />
                              </div>
                              <span style={{ fontWeight: 700 }}>{game.title}</span>
                            </div>
                            <input 
                              type="checkbox" 
                              checked={cmsData.enabled_games?.includes(game.id)} 
                              onChange={() => handleToggleGame(game.id)}
                              style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ─── Color Theme ─────────────────────────────────── */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '1rem', fontWeight: 800, marginBottom: '4px' }}>🎨 Color Theme</label>
                          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>Changes apply live across the entire application</p>
                        </div>
                        <button
                          onClick={handleResetTheme}
                          disabled={loading}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.35)',
                            background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 700,
                            fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                          }}
                        >
                          ↺ Reset Defaults
                        </button>
                      </div>

                      {/* Live preview swatch strip */}
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', height: '32px', borderRadius: '10px', overflow: 'hidden' }}>
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
                          <div key={i} style={{ flex: 1, background: color, borderRadius: '4px', transition: 'background 0.3s' }} />
                        ))}
                      </div>

                      {/* Color pickers grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        {[
                          { label: 'Primary Color',  key: 'primary',      icon: '●' },
                          { label: 'Primary Light',  key: 'primaryLight', icon: '◑' },
                          { label: 'Secondary',      key: 'secondary',    icon: '◎' },
                          { label: 'Background',     key: 'bg',           icon: '▪' },
                          { label: 'Surface',        key: 'bg2',          icon: '□' },
                          { label: 'Text Color',     key: 'text',         icon: 'T' },
                          { label: 'Muted Text',     key: 'muted',        icon: 'T' },
                          { label: 'Gold Accent',    key: 'gold',         icon: '★' },
                          { label: 'Success',        key: 'green',        icon: '✓' },
                          { label: 'Danger',         key: 'red',          icon: '✕' },
                        ].map(({ label, key, icon }) => {
                          const currentVal = cmsData.theme?.[key] || THEME_DEFAULTS[key];
                          return (
                            <div
                              key={key}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '10px 14px', borderRadius: '10px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                transition: 'border-color 0.2s',
                              }}
                            >
                              {/* Color swatch button */}
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{
                                  width: '36px', height: '36px', borderRadius: '8px',
                                  background: currentVal,
                                  border: '2px solid rgba(255,255,255,0.15)',
                                  boxShadow: `0 2px 8px ${currentVal}66`,
                                  cursor: 'pointer', overflow: 'hidden',
                                  transition: 'box-shadow 0.2s',
                                }}>
                                  <input
                                    type="color"
                                    value={currentVal}
                                    onChange={e => {
                                      const newTheme = { ...cmsData.theme, [key]: e.target.value };
                                      setCmsData({ ...cmsData, theme: newTheme });
                                      applyTheme(newTheme);
                                    }}
                                    style={{
                                      position: 'absolute', inset: '-4px', width: 'calc(100% + 8px)',
                                      height: 'calc(100% + 8px)', border: 'none',
                                      background: 'none', cursor: 'pointer', opacity: 0,
                                    }}
                                  />
                                </div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--dim)', marginBottom: '2px' }}>{label}</div>
                                <code style={{
                                  fontSize: '0.72rem', color: currentVal,
                                  background: 'rgba(0,0,0,0.3)',
                                  padding: '1px 6px', borderRadius: '4px',
                                  fontWeight: 700, letterSpacing: '0.04em',
                                }}>
                                  {currentVal}
                                </code>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                      <button
                        className="btn btn-primary"
                        onClick={handleSaveSettings}
                        disabled={loading}
                        style={{ flex: 1 }}
                      >
                        {loading ? 'Saving...' : saveSuccess ? '✓ Saved!' : 'Save Configuration'}
                      </button>
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
