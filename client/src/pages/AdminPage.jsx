import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../games/bluff/store/useGameStore';
import {
  SettingsIcon, GridIcon, UsersIcon, TrophyIcon, 
  ArrowLeftIcon, EnergyIcon, TrashIcon, XIcon,
  PlayIcon, ShieldIcon, CrownIcon
} from '../components/common/Icons';

const TABS = [
  { id: 'stats', label: 'Dashboard', icon: <EnergyIcon size={18} /> },
  { id: 'rooms', label: 'Live Rooms', icon: <GridIcon size={18} /> },
  { id: 'cms', label: 'CMS & Theme', icon: <SettingsIcon size={18} /> },
  { id: 'users', label: 'Players', icon: <UsersIcon size={18} /> },
];

export default function AdminPage() {
  const { setScreen, siteSettings, updateSettings, isAdmin, getAuthToken } = useGameStore();
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cmsData, setCmsData] = useState(siteSettings || {});

  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
  const apiBase = SOCKET_URL.replace(/\/$/, '');

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
                  background: activeTab === tab.id ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
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
                                <button className="btn-red btn-sm" style={{ width: 'auto' }}>
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
                        {['bluff', 'joker', 'uno', 'uno-flip'].map(game => (
                          <div key={game} className="player-row" style={{ justifyContent: 'space-between' }}>
                            <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{game}</span>
                            <input 
                              type="checkbox" 
                              checked={cmsData.enabled_games?.includes(game)} 
                              onChange={() => handleToggleGame(game)}
                              style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>Primary Color</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <input 
                            type="color" 
                            value={cmsData.theme?.primary || '#7c3aed'} 
                            onChange={e => setCmsData({...cmsData, theme: { ...cmsData.theme, primary: e.target.value }})}
                            style={{ width: '40px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }}
                          />
                          <code style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>{cmsData.theme?.primary || '#7c3aed'}</code>
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>Background Color</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <input 
                            type="color" 
                            value={cmsData.theme?.bg || '#010409'} 
                            onChange={e => setCmsData({...cmsData, theme: { ...cmsData.theme, bg: e.target.value }})}
                            style={{ width: '40px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }}
                          />
                          <code style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>{cmsData.theme?.bg || '#010409'}</code>
                        </div>
                      </div>
                    </div>

                    <button className="btn btn-primary" onClick={handleSaveSettings} disabled={loading} style={{ marginTop: '20px' }}>
                      {loading ? 'Saving...' : 'Save Configuration'}
                    </button>
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
                        <div key={u.id} className="player-row" style={{ padding: '16px' }}>
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
                          }}>
                            {u.avatar_url?.length <= 2 ? u.avatar_url : '👤'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800 }}>{u.username}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>ID: {u.id}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900, color: 'var(--gold)' }}>{u.coins} 💰</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Joined {new Date(u.created_at).toLocaleDateString()}</div>
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
