import React from 'react';

const colors = ['#7c3aed', '#db2777', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#f97316'];

export default function Avatar({ name, size = 40, fontSize = '1rem' }) {
  const char = name ? name.charAt(0).toUpperCase() : '?';
  const color = name ? colors[name.length % colors.length] : '#333';

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${color}, ${color}dd)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 900, fontSize, flexShrink: 0,
      boxShadow: `0 4px 12px ${color}66`,
      border: '0.5px solid rgba(255,255,255,0.2)',
      textShadow: '0 1px 2px rgba(0,0,0,0.2)',
      userSelect: 'none'
    }}>
      {char}
    </div>
  );
}

export const TrophyIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f59e0b' }}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-2.34" /><path d="M4.61 9.23c.32 4.18 1.83 6.94 4.5 8.12a2.94 2.94 0 0 0 5.78 0c2.67-1.18 4.18-3.94 4.5-8.12a2 2 0 0 0-1.99-2.23H6.6a2 2 0 0 0-2 2.23Z" />
  </svg>
);

export const TrashIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const MaskIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a78bfa' }}>
    <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01" /><path d="M15 9h.01" />
  </svg>
);
