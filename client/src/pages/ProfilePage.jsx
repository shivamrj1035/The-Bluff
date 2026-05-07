import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClerk } from '@clerk/clerk-react';
import { useGameStore } from '../games/bluff/store/useGameStore';
import AvatarDisplay from '../components/common/AvatarDisplay';
import { avatarConfigs } from '../games/bluff/constants/avatars';
import {
  ChevronDownIcon, ArrowLeftIcon, CameraIcon,
  LogOutIcon, TrophyIcon, UsersIcon, EnergyIcon,
  SpadeIcon, SettingsIcon, BellIcon, ShieldIcon, HelpIcon
} from '../components/common/Icons';

/**
 * ProfilePage — User profile management with Clerk & Neon integration.
 */
export default function ProfilePage() {
  const {
    playerName,
    avatar,
    setIdentity,
    setScreen,
    user,
    profile,
    updateProfile
  } = useGameStore();

  const { signOut } = useClerk();

  const [activeTab, setActiveTab] = useState('Overview');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName || '');
  const [showAvatarGrid, setShowAvatarGrid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTempName(playerName || profile?.username || '');
  }, [playerName, profile]);

  const handleSaveProfile = async (newName, newAvatar) => {
    setIsSaving(true);
    try {
      await updateProfile({
        username: newName || playerName,
        avatar_id: newAvatar || avatar
      });
      setIdentity(newName || playerName, newAvatar || avatar);
      setEditingName(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarSelect = (avatarId) => {
    handleSaveProfile(playerName, avatarId);
    setShowAvatarGrid(false);
  };

  const stats = [
    { label: 'Games Played', value: profile?.stats?.games_played || 0, icon: <SpadeIcon size={20} /> },
    { label: 'Total Wins', value: profile?.stats?.wins || 0, icon: <TrophyIcon size={20} color="#f59e0b" /> },
    { label: 'Win Rate', value: `${profile?.stats?.games_played ? Math.round((profile?.stats?.wins / profile?.stats?.games_played) * 100) : 0}%`, icon: <EnergyIcon size={20} color="#7c3aed" /> },
    { label: 'Total Coins', value: profile?.coins || 0, icon: <EnergyIcon size={20} color="#f59e0b" /> }
  ];

  const tabs = ['Overview', 'Match History', 'Achievements', 'Settings'];

  return (
    <div className="profile-container">
      {/* Top Navigation */}
      <nav className="profile-nav">
        <button className="nav-back" onClick={() => setScreen('EXPLORE')}>
          <ArrowLeftIcon size={20} />
          <span>Back to Explore</span>
        </button>

        <div className="nav-actions">
          <div className="icon-btn">
            <BellIcon size={20} />
          </div>
          <div className="icon-btn">
            <SettingsIcon size={20} />
          </div>
        </div>
      </nav>

      <main className="profile-content">
        {/* Profile Header */}
        <section className="profile-header">
          <div className="profile-main-info">
            <div className="avatar-wrapper">
              <AvatarDisplay
                avatarId={avatar}
                playerName={playerName}
                size={120}
                animated={true}
              />
              <button
                className="edit-avatar-btn"
                onClick={() => setShowAvatarGrid(true)}
              >
                <CameraIcon size={18} />
              </button>
            </div>

            <div className="name-wrapper">
              {editingName ? (
                <div className="edit-name-group">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    autoFocus
                    className="name-input"
                    maxLength={15}
                  />
                  <div className="edit-actions">
                    <button
                      className="save-btn"
                      onClick={() => handleSaveProfile(tempName, avatar)}
                      disabled={isSaving}
                    >
                      {isSaving ? '...' : 'Save'}
                    </button>
                    <button
                      className="cancel-btn"
                      onClick={() => { setEditingName(false); setTempName(playerName); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="display-name-group">
                  <h1>{playerName || profile?.username || 'Gamer'}</h1>
                  <button className="edit-icon-btn" onClick={() => setEditingName(true)}>
                    <SettingsIcon size={16} />
                  </button>
                </div>
              )}
              <div className="user-meta">
                <span className="user-id">#{user?.id?.slice(-6).toUpperCase() || 'HUB'}</span>
                <span className="member-since">Member since 2025</span>
              </div>
            </div>
          </div>

          <div className="profile-stats-grid">
            {stats.map((stat, idx) => (
              <div key={idx} className="stat-card glass-panel">
                <div className="stat-icon">{stat.icon}</div>
                <div className="stat-info">
                  <span className="stat-value">{stat.value}</span>
                  <span className="stat-label">{stat.label}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Profile Tabs */}
        <section className="profile-tabs-section">
          <div className="tabs-header">
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
            <button className="sign-out-btn" onClick={() => signOut()}>
              <LogOutIcon size={18} />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="tab-content glass-panel">
            {activeTab === 'Overview' && (
              <div className="overview-tab">
                <div className="overview-row">
                  <div className="overview-col main-col">
                    <div className="recent-activity">
                      <h3>Recent Activity</h3>
                      <div className="activity-list">
                        <div className="activity-item">
                          <div className="activity-icon win"><TrophyIcon size={16} /></div>
                          <div className="activity-info">
                            <p>Won a match in <strong>The Bluff</strong></p>
                            <span>2 hours ago</span>
                          </div>
                          <div className="activity-reward">+50 Coins</div>
                        </div>
                        <div className="activity-item">
                          <div className="activity-icon"><SpadeIcon size={16} /></div>
                          <div className="activity-info">
                            <p>Played <strong>Teen Patti</strong></p>
                            <span>5 hours ago</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overview-col sidebar-col">
                    <div className="achievements-preview">
                      <div className="section-header">
                        <h3>Achievements</h3>
                        <button className="view-all">View All</button>
                      </div>
                      <div className="achievements-grid">
                        <div className="achievement-badge locked"><ShieldIcon size={24} /></div>
                        <div className="achievement-badge"><CrownIcon size={24} /></div>
                        <div className="achievement-badge locked"><TrophyIcon size={24} /></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Settings' && (
              <div className="settings-tab">
                <div className="settings-list">
                  <div className="settings-item">
                    <div className="item-info">
                      <h4>Account Security</h4>
                      <p>Manage your password and security settings via Clerk</p>
                    </div>
                    <button className="settings-action-btn">Manage Account</button>
                  </div>
                  <div className="settings-item">
                    <div className="item-info">
                      <h4>Privacy Settings</h4>
                      <p>Control who can see your profile and activity</p>
                    </div>
                    <button className="settings-action-btn">Edit</button>
                  </div>
                  <div className="settings-item">
                    <div className="item-info">
                      <h4>Help & Support</h4>
                      <p>Need help? Contact our support team</p>
                    </div>
                    <button className="settings-action-btn">Get Help</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Avatar Selection Modal */}
      <AnimatePresence>
        {showAvatarGrid && (
          <div className="modal-overlay" onClick={() => setShowAvatarGrid(false)}>
            <motion.div
              className="glass-panel avatar-selection-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Select Your Avatar</h2>
                <button className="close-btn" onClick={() => setShowAvatarGrid(false)}>×</button>
              </div>
              <div className="avatar-grid-scroll">
                {Object.entries(avatarConfigs).map(([id, config]) => (
                  <button
                    key={id}
                    className={`avatar-option ${avatar === id ? 'selected' : ''}`}
                    onClick={() => handleAvatarSelect(id)}
                  >
                    <div className="avatar-preview">
                      <AvatarDisplay avatarId={id} size={80} animated={false} />
                    </div>
                    <span>{config.label}</span>
                    {avatar === id && <div className="selected-badge">✓</div>}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components used in Profile
function CrownIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
  );
}
