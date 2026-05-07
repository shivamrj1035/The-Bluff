import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../games/bluff/store/useGameStore';
import { LogOutIcon } from '../components/common/Icons';
import { AVATAR_OPTIONS } from '../constants/avatars';
import AvatarDisplay from '../components/common/AvatarDisplay';

export default function ProfilePage() {
  const { playerName, avatar, setIdentity, setScreen, user, signOut } = useGameStore();
  const [name, setName] = useState(playerName || '');
  // selectedAvatar stores the avatar ID string (e.g., 'crazy1') or 'P' for letter
  const [selectedAvatar, setSelectedAvatar] = useState(avatar || 'P');

  const handleSave = async () => {
    const finalName = name.trim() || 'Player';
    await setIdentity(finalName, selectedAvatar);
    setScreen('EXPLORE');
  };

  // Render a single avatar option in the grid
  const renderAvatarOption = (avatarData) => {
    const isSelected = selectedAvatar === avatarData.id;

    return (
      <motion.div
        key={avatarData.id}
        whileHover={{ scale: 1.08, y: -3 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setSelectedAvatar(avatarData.id)}
        style={{ cursor: 'pointer' }}
      >
        <div style={{
          position: 'relative',
          padding: '3px',
          borderRadius: '50%',
          border: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
          transition: 'all 0.2s ease',
        }}>
          <AvatarDisplay
            avatarId={avatarData.id}
            size={52}
            animated={isSelected}
          />
        </div>
        <p style={{
          textAlign: 'center',
          fontSize: '0.6rem',
          color: isSelected ? 'var(--primary)' : 'var(--muted)',
          margin: '4px 0 0',
          fontWeight: 600,
        }}>
          {avatarData.name}
        </p>
      </motion.div>
    );
  };

  return (
    <div className="profile-page" style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 12px',
      position: 'relative',
      overflowX: 'hidden',
    }}>
      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
        @keyframes swing { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
        @keyframes fly { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-10px) rotate(-5deg); } 75% { transform: translateY(-10px) rotate(5deg); } }
        @keyframes wiggle { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
        @keyframes fade-bounce { 0%, 100% { opacity: 0.75; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-8px); } }
        @keyframes mechanical { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(4deg); } 75% { transform: rotate(-4deg); } }
        @keyframes shine { 0%, 100% { box-shadow: 0 0 15px #f59e0b66; } 50% { box-shadow: 0 0 30px #fbbf2499; } }
        @keyframes sneak { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(8px); } }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '95vh',
          overflowY: 'auto',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          marginBottom: '40px',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
          <div>
            <h1 style={{
              fontSize: '1.4rem',
              fontWeight: 900,
              color: '#fff',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Profile
            </h1>
            <p style={{
              fontSize: '0.75rem',
              color: '#9ca3af',
              fontWeight: 500,
              margin: '4px 0 0',
            }}>
              Customize your identity
            </p>
          </div>
          <button
            onClick={() => setScreen('EXPLORE')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            ← Back
          </button>
        </div>

        {/* Preview */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          padding: '14px',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <AvatarDisplay
            avatarId={selectedAvatar}
            size={90}
            showBorder={true}
            animated={true}
          />
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontSize: '1.1rem',
              fontWeight: 900,
              color: '#fff',
              margin: 0,
            }}>
              {name || 'Player'}
            </p>
            <p style={{
              fontSize: '0.65rem',
              color: 'var(--primary)',
              fontWeight: 700,
              margin: '3px 0 0',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {user ? 'LOGGED IN' : 'GUEST'}
            </p>
          </div>
        </div>

        {/* Name Input */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{
            display: 'block',
            fontSize: '0.65rem',
            fontWeight: 900,
            color: 'var(--primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '8px',
          }}>
            Display Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#fff',
              background: 'rgba(0,0,0,0.3)',
              border: '2px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              outline: 'none',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary)';
              e.target.style.boxShadow = '0 0 0 3px var(--shadow-p)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255,255,255,0.1)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Avatar Grid */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{
            display: 'block',
            fontSize: '0.65rem',
            fontWeight: 900,
            color: 'var(--primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '14px',
          }}>
            Choose Avatar
          </label>
          <div
            style={{
              display: 'flex',
              gap: '14px',
              overflowX: 'auto',
              overflowY: 'hidden',
              padding: '6px 2px 12px',
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {AVATAR_OPTIONS.map((avatarData) => (
              <div
                key={avatarData.id}
                style={{
                  flex: '0 0 auto',
                }}
              >
                {renderAvatarOption(avatarData)}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            style={{
              flex: 1,
              minWidth: '160px',
              padding: '14px 24px',
              fontSize: '0.85rem',
              fontWeight: 900,
              color: '#fff',
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Save
          </motion.button>

          {user && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={signOut}
              style={{
                flex: 1,
                minWidth: '160px',
                padding: '14px 24px',
                fontSize: '0.85rem',
                fontWeight: 900,
                color: '#ef4444',
                background: 'rgba(239,68,68,0.1)',
                border: '1.5px solid rgba(239,68,68,0.4)',
                borderRadius: '10px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <LogOutIcon size={16} /> Sign Out
              </span>
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Background glow orbs */}
      <div style={{
        position: 'fixed',
        top: '8%',
        left: '4%',
        width: '80px',
        height: '80px',
        background: 'radial-gradient(circle, var(--shadow-p) 0%, transparent 70%)',
        filter: 'blur(30px)',
        zIndex: -1,
      }} />
      <div style={{
        position: 'fixed',
        bottom: '12%',
        right: '8%',
        width: '120px',
        height: '120px',
        background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
        filter: 'blur(40px)',
        zIndex: -1,
      }} />
    </div>
  );
}
