import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../games/bluff/store/useGameStore';
import { XIcon, MailIcon, LockIcon, ArrowRightIcon } from './Icons';

// Inline UserIcon to avoid dependency issues
const UserIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// Spade logo for branding
const SpadeIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8 6 4 8 4 12a4 4 0 0 0 7 2.6V17H8v2h8v-2h-3v-2.4A4 4 0 0 0 20 12c0-4-4-6-8-10z" />
  </svg>
);

export default function AuthDialog({ isOpen, onClose }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const { login, signup } = useGameStore();

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setUsername('');
      setError(null);
      setSuccess(null);
      setLoading(false);
    }
  }, [isOpen, mode]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'login') {
        const { error } = await login(email, password);
        if (error) throw error;
        onClose();
      } else {
        const { error } = await signup(email, password, username);
        if (error) throw error;
        setSuccess('Account created! Please check your email to confirm, then sign in.');
        setMode('login');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const dialog = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="auth-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '20px',
          }}
        >
          <motion.div
            key="auth-card"
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'linear-gradient(135deg, rgba(15, 10, 30, 0.98) 0%, rgba(20, 15, 40, 0.98) 100%)',
              border: '1px solid rgba(124, 58, 237, 0.25)',
              borderRadius: '24px',
              padding: '40px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background glow */}
            <div style={{
              position: 'absolute', top: '-60px', right: '-60px',
              width: '200px', height: '200px',
              background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: '-40px', left: '-40px',
              width: '160px', height: '160px',
              background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute', top: '20px', right: '20px',
                width: '32px', height: '32px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              <XIcon size={16} />
            </button>

            {/* Logo & Title */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{
                width: '48px', height: '48px',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                borderRadius: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '20px',
                boxShadow: '0 8px 20px rgba(124,58,237,0.35)',
              }}>
                <SpadeIcon size={24} />
              </div>
              <h2 style={{
                fontSize: '1.7rem', fontWeight: 800, margin: '0 0 6px 0',
                background: 'linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {mode === 'login' ? 'Welcome Back' : 'Join the Hub'}
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                {mode === 'login'
                  ? 'Sign in to your account to continue playing'
                  : 'Create your account and start competing'}
              </p>
            </div>

            {/* Tab switcher */}
            <div style={{
              display: 'flex', gap: '4px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px', padding: '4px',
              marginBottom: '28px',
            }}>
              {['login', 'signup'].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                  style={{
                    flex: 1, padding: '10px',
                    borderRadius: '10px',
                    fontWeight: 700, fontSize: '0.9rem',
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: mode === m ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'transparent',
                    color: mode === m ? '#fff' : '#64748b',
                    border: mode === m ? '1px solid rgba(124,58,237,0.5)' : '1px solid transparent',
                    boxShadow: mode === m ? '0 4px 12px rgba(124,58,237,0.25)' : 'none',
                  }}
                >
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {/* Success message */}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '12px',
                  color: '#34d399',
                  fontSize: '0.85rem',
                  marginBottom: '20px',
                  lineHeight: 1.5,
                }}
              >
                ✓ {success}
              </motion.div>
            )}

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '12px',
                  color: '#f87171',
                  fontSize: '0.85rem',
                  marginBottom: '20px',
                  lineHeight: 1.5,
                }}
              >
                ✕ {error}
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {mode === 'signup' && (
                <InputField
                  label="Username"
                  icon={<UserIcon size={18} />}
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              )}

              <InputField
                label="Email Address"
                icon={<MailIcon size={18} />}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <InputField
                label="Password"
                icon={<LockIcon size={18} />}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '8px',
                  padding: '14px 20px',
                  background: loading
                    ? 'rgba(124,58,237,0.5)'
                    : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '14px',
                  fontWeight: 800,
                  fontSize: '1rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '10px',
                  transition: 'all 0.2s',
                  boxShadow: loading ? 'none' : '0 6px 20px rgba(124,58,237,0.35)',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: '18px', height: '18px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'auth-spin 0.7s linear infinite',
                      display: 'inline-block',
                    }} />
                    Processing...
                  </>
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRightIcon size={18} />
                  </>
                )}
              </button>
            </form>

            {/* Divider + social hint */}
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <p style={{ color: '#475569', fontSize: '0.85rem', margin: 0 }}>
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setSuccess(null); }}
                  style={{
                    color: '#a78bfa', fontWeight: 700, fontSize: '0.85rem',
                    cursor: 'pointer', background: 'none', border: 'none',
                    textDecoration: 'underline', textUnderlineOffset: '3px',
                  }}
                >
                  {mode === 'login' ? 'Sign Up free' : 'Sign In'}
                </button>
              </p>
            </div>

            {/* Spinner keyframe */}
            <style>{`
              @keyframes auth-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render into document.body to avoid stacking context issues
  return createPortal(dialog, document.body);
}

// Reusable input field component
function InputField({ label, icon, type, placeholder, value, onChange, required }) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '0.8rem',
        fontWeight: 700,
        color: '#94a3b8',
        marginBottom: '8px',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        {label}
      </label>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 16px',
        background: focused ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${focused ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '14px',
        transition: 'all 0.2s',
        boxShadow: focused ? '0 0 0 4px rgba(124,58,237,0.1)' : 'none',
        height: '50px',
      }}>
        <span style={{ color: focused ? '#a78bfa' : '#475569', flexShrink: 0, display: 'flex' }}>
          {icon}
        </span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '0.95rem',
            fontFamily: 'inherit',
            lineHeight: 1,
          }}
          autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'username'}
        />
      </div>
    </div>
  );
}
