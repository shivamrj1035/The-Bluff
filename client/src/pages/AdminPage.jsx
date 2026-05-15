import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { useGameStore, applyTheme } from '../games/bluff/store/useGameStore';
import { THEME_DEFAULTS } from '../games/bluff/store/useGameStore';
import {
  SettingsIcon, GridIcon, UsersIcon, TrophyIcon,
  ArrowLeftIcon, EnergyIcon, TrashIcon, XIcon,
  PlayIcon, ShieldIcon, CrownIcon, LayoutIcon,
  SearchIcon, BellIcon, LogOutIcon, MoreVerticalIcon
} from '../components/common/Icons';
import { REGISTERED_GAMES } from '../constants/registeredGames';

const TABS = [
  { id: 'stats', label: 'Dashboard', icon: <LayoutIcon size={20} /> },
  { id: 'rooms', label: 'Game Rooms', icon: <GridIcon size={20} /> },
  { id: 'games', label: 'Games Management', icon: <PlayIcon size={20} /> },
  { id: 'cms', label: 'CMS Settings', icon: <SettingsIcon size={20} /> },
  { id: 'users', label: 'Player Database', icon: <UsersIcon size={20} /> },
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

  const chartData = useMemo(() => [
    { name: 'Mon', players: 45, rooms: 12 },
    { name: 'Tue', players: 52, rooms: 15 },
    { name: 'Wed', players: 48, rooms: 14 },
    { name: 'Thu', players: 61, rooms: 18 },
    { name: 'Fri', players: 55, rooms: 16 },
    { name: 'Sat', players: 80, rooms: 22 },
    { name: 'Sun', players: 72, rooms: 20 },
  ], []);

  const pieData = useMemo(() => [
    { name: 'Bluff', value: 400, color: '#6366f1' },
    { name: 'Court Piece', value: 300, color: '#f59e0b' },
    { name: 'Rummy', value: 300, color: '#10b981' },
    { name: 'Teen Patti', value: 200, color: '#ef4444' },
  ], []);

  return (
    <div className="admin-v2-wrapper">
      {/* Sidebar */}
      <aside className="admin-v2-sidebar">
        <div className="admin-v2-logo">
          <div className="logo-icon">G</div>
          <span>GameArena <small>Admin</small></span>
        </div>

        <nav className="admin-v2-nav">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`admin-v2-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
              {activeTab === tab.id && <motion.div layoutId="nav-glow" className="nav-glow" />}
            </button>
          ))}
        </nav>

        <div className="admin-v2-sidebar-footer">
          <button className="admin-v2-nav-item logout" onClick={() => setScreen('LANDING')}>
            <span className="nav-icon"><LogOutIcon size={20} /></span>
            <span className="nav-label">Exit Dashboard</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-v2-main">
        {/* Header */}
        <header className="admin-v2-header">
          <div className="header-search">
            <SearchIcon size={18} />
            <input
              type="text"
              placeholder="Search for players, rooms, or transactions..."
              onChange={(e) => {
                if (activeTab === 'users') {
                  // Trigger local filtering or search
                }
              }}
            />
          </div>
          <div className="header-actions">
            <button className="header-icon-btn refresh" onClick={fetchData} title="Refresh Data">
              <EnergyIcon size={20} className={loading ? 'spinning' : ''} />
            </button>
            <div className="header-icon-btn">
              <BellIcon size={20} />
              <span className="badge">3</span>
            </div>
            <div className="user-profile-pill">
              <div className="avatar">A</div>
              <div className="user-info">
                <span className="name">Super Admin</span>
                <span className="role">Platform Owner</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="admin-v2-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Dashboard Tab */}
              {activeTab === 'stats' && (
                <div className="admin-dashboard-view">
                  <div className="section-header">
                    <div>
                      <h1>Platform Overview</h1>
                      <p>Real-time analytics and performance metrics</p>
                    </div>
                    <div className="date-pill">
                      {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>

                  <div className="admin-metrics-grid">
                    <div className="admin-v2-card metric-card">
                      <div className="metric-icon players"><UsersIcon size={24} /></div>
                      <div className="metric-info">
                        <span className="label">Total Players</span>
                        <h2 className="value">{stats?.registeredUsers || 0}</h2>
                        <span className="trend positive">+12% from last week</span>
                      </div>
                    </div>
                    <div className="admin-v2-card metric-card">
                      <div className="metric-icon rooms"><GridIcon size={24} /></div>
                      <div className="metric-info">
                        <span className="label">Active Tables</span>
                        <h2 className="value">{stats?.activeRooms || 0}</h2>
                        <span className="trend positive">+5 active now</span>
                      </div>
                    </div>
                    <div className="admin-v2-card metric-card">
                      <div className="metric-icon revenue"><TrophyIcon size={24} /></div>
                      <div className="metric-info">
                        <span className="label">Platform Activity</span>
                        <h2 className="value">{stats?.totalRoomsCreated || 0}</h2>
                        <span className="label-sub">Total Sessions</span>
                      </div>
                    </div>
                  </div>

                  <div className="admin-charts-grid">
                    <div className="admin-v2-card chart-card main-chart">
                      <div className="card-header">
                        <h3>Player Engagement</h3>
                        <div className="chart-legend">
                          <span className="dot players"></span> Players
                          <span className="dot rooms"></span> Rooms
                        </div>
                      </div>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorPlayers" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <Tooltip
                              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                              itemStyle={{ color: '#f8fafc' }}
                            />
                            <Area type="monotone" dataKey="players" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPlayers)" />
                            <Area type="monotone" dataKey="rooms" stroke="#f59e0b" strokeWidth={3} fill="transparent" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="admin-v2-card chart-card pie-chart">
                      <div className="card-header">
                        <h3>Game Distribution</h3>
                      </div>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pie-legend">
                          {pieData.map(item => (
                            <div key={item.name} className="legend-item">
                              <span className="dot" style={{ background: item.color }}></span>
                              <span className="name">{item.name}</span>
                              <span className="val">{((item.value / 1200) * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Game Rooms Tab */}
              {activeTab === 'rooms' && (
                <div className="admin-rooms-view">
                  <div className="section-header">
                    <div>
                      <h1>Live Game Rooms</h1>
                      <p>Monitor and manage active game sessions</p>
                    </div>
                    <div className="badge-pill pulse">
                      <span className="pulse-dot"></span>
                      {rooms.length} Active Rooms
                    </div>
                  </div>

                  <div className="admin-v2-card table-card">
                    <table className="admin-v2-table">
                      <thead>
                        <tr>
                          <th>Room ID</th>
                          <th>Game State</th>
                          <th>Players</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rooms.length === 0 ? (
                          <tr><td colSpan="4" className="empty-state">No active rooms found</td></tr>
                        ) : (
                          rooms.map(room => (
                            <tr key={room.roomId}>
                              <td className="room-id">
                                <code>{room.roomId}</code>
                              </td>
                              <td>
                                <span className={`status-pill ${room.state.toLowerCase()}`}>
                                  {room.state}
                                </span>
                              </td>
                              <td>
                                <div className="player-avatars">
                                  {room.players.map((p, i) => (
                                    <div key={i} className="mini-avatar" title={p.username}>{p.username[0]}</div>
                                  ))}
                                  <span className="count">{room.players.length} Players</span>
                                </div>
                              </td>
                              <td>
                                <button className="action-btn delete" onClick={() => handleTerminateRoom(room.roomId)}>
                                  <TrashIcon size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Games Management Tab */}
              {activeTab === 'games' && (
                <div className="admin-games-view">
                  <div className="section-header">
                    <div>
                      <h1>Games Management</h1>
                      <p>Configure and toggle available games</p>
                    </div>
                    <button className="btn-v2-primary save-btn" onClick={handleSaveSettings} disabled={loading}>
                      {loading ? <i className="fas fa-spinner spinning"></i> : null}
                      {saveSuccess ? '✓ Changes Saved' : 'Update Enabled Games'}
                    </button>
                  </div>

                  <div className="admin-v2-grid">
                    {REGISTERED_GAMES.map(game => (
                      <div key={game.id} className="admin-v2-card game-config-card">
                        <div className="game-preview" style={{ background: `linear-gradient(135deg, ${game.accent}33, ${game.accent}11)` }}>
                          <PlayIcon size={32} color={game.accent} />
                        </div>
                        <div className="game-info">
                          <h3>{game.title}</h3>
                          <p>{game.description || 'Global multiplayer card game'}</p>
                          <div className="game-footer">
                            <span className={`status ${cmsData.enabled_games?.includes(game.id) ? 'active' : 'inactive'}`}>
                              {cmsData.enabled_games?.includes(game.id) ? 'Live' : 'Maintenance'}
                            </span>
                            <label className="admin-switch">
                              <input
                                type="checkbox"
                                checked={cmsData.enabled_games?.includes(game.id)}
                                onChange={() => handleToggleGame(game.id)}
                              />
                              <span className="admin-slider"></span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CMS Settings Tab */}
              {activeTab === 'cms' && (
                <div className="admin-cms-view">
                  <div className="section-header">
                    <div>
                      <h1>CMS & Branding</h1>
                      <p>Customize site content and visual identity</p>
                    </div>
                    <button className="btn-v2-primary save-btn" onClick={handleSaveSettings} disabled={loading}>
                      {loading ? <i className="fas fa-spinner spinning"></i> : null}
                      {saveSuccess ? '✓ Settings Saved' : 'Update Changes'}
                    </button>
                  </div>

                  <div className="admin-v2-grid-3">
                    <div className="admin-v2-card cms-form-card">
                      <div className="card-header"><h3>Site Information</h3></div>
                      <div className="card-body">
                        <div className="form-group">
                          <label>Header Title</label>
                          <input
                            type="text"
                            value={cmsData.header_title || ''}
                            onChange={e => setCmsData({ ...cmsData, header_title: e.target.value })}
                            placeholder="e.g. GameArena"
                          />
                        </div>
                        <div className="form-group">
                          <label>Hero Title</label>
                          <input
                            type="text"
                            value={cmsData.hero_title || ''}
                            onChange={e => setCmsData({ ...cmsData, hero_title: e.target.value })}
                            placeholder="Welcome Message"
                          />
                        </div>
                        <div className="form-group">
                          <label>Hero Description</label>
                          <textarea
                            rows="4"
                            value={cmsData.hero_subtitle || ''}
                            onChange={e => setCmsData({ ...cmsData, hero_subtitle: e.target.value })}
                            placeholder="Sub-headline text"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="admin-v2-card theme-config-card" style={{ gridColumn: 'span 2' }}>
                      <div className="card-header">
                        <h3>Theme & Visuals</h3>
                        <button className="text-btn red" onClick={handleResetTheme}>Reset Defaults</button>
                      </div>

                      <div className="card-body">
                        <div className="theme-grid">
                          {[
                            { label: 'Primary Brand', key: 'primary' },
                            { label: 'Light Accent', key: 'primaryLight' },
                            { label: 'Secondary', key: 'secondary' },
                            { label: 'Background', key: 'bg' },
                            { label: 'Card Surface', key: 'bg2' },
                            { label: 'Gold/Coins', key: 'gold' },
                            { label: 'Success', key: 'green' },
                            { label: 'Danger', key: 'red' },
                          ].map(({ label, key }) => {
                            const currentVal = cmsData.theme?.[key] || THEME_DEFAULTS[key];
                            return (
                              <div key={key} className="color-input-group">
                                <div className="color-preview" style={{ background: currentVal }}>
                                  <input
                                    type="color"
                                    value={currentVal}
                                    onChange={e => {
                                      const newTheme = { ...cmsData.theme, [key]: e.target.value };
                                      setCmsData({ ...cmsData, theme: newTheme });
                                      applyTheme(newTheme);
                                    }}
                                  />
                                </div>
                                <div className="color-meta">
                                  <span>{label}</span>
                                  <code>{currentVal}</code>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Players Tab */}
              {activeTab === 'users' && (
                <div className="admin-players-view">
                  <div className="section-header">
                    <div>
                      <h1>Player Database</h1>
                      <p>Search and manage registered users</p>
                    </div>
                    <div className="header-search compact">
                      <SearchIcon size={16} />
                      <input type="text" placeholder="Filter by username..." />
                    </div>
                  </div>

                  <div className="admin-v2-card table-card">
                    <table className="admin-v2-table">
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Platform ID</th>
                          <th>Wealth</th>
                          <th>Status</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} className={u.is_blocked ? 'row-blocked' : ''}>
                            <td>
                              <div className="player-cell">
                                <div className="avatar" style={{ background: u.is_blocked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)' }}>
                                  {u.avatar_url?.length <= 2 ? u.avatar_url : '👤'}
                                </div>
                                <span className="username">{u.username}</span>
                              </div>
                            </td>
                            <td><code className="id-code">{u.id.substring(0, 8)}...</code></td>
                            <td><span className="coins-pill">{u.coins.toLocaleString()} 💰</span></td>
                            <td>
                              <span className={`status-badge ${u.is_blocked ? 'blocked' : 'active'}`}>
                                {u.is_blocked ? 'Blocked' : 'Active'}
                              </span>
                            </td>
                            <td>{new Date(u.created_at).toLocaleDateString()}</td>
                            <td>
                              <div className="action-group">
                                <button className={`action-btn ${u.is_blocked ? 'unblock' : 'block'}`} onClick={() => handleToggleBlock(u)}>
                                  {u.is_blocked ? <ShieldIcon size={14} /> : <ShieldIcon size={14} />}
                                </button>
                                <button className="action-btn more"><MoreVerticalIcon size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

