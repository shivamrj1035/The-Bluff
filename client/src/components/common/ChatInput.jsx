import React, { useState, useRef } from 'react';
import { useGameStore } from '../../games/bluff/store/useGameStore';

/**
 * ChatInput — Compact chat input bar.
 * Renders as a small icon button that expands to an input on press/click.
 * Works in both LobbyPage and GameBoard.
 */
export default function ChatInput({ compact = false, onSend, mode }) {
  const bluffStore = useGameStore();
  const isCompact = compact || mode === 'compact';
  const [open, setOpen] = useState(!isCompact);
  const [msg, setMsg] = useState('');
  const inputRef = useRef(null);

  const send = () => {
    const text = msg.trim();
    if (!text) return;
    
    if (onSend) {
      onSend(text);
    } else {
      bluffStore.sendChat(text);
    }

    setMsg('');
    if (isCompact) setOpen(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setMsg('');
    }
  };

  const toggle = () => {
    setOpen(v => !v);
    if (!open) setTimeout(() => inputRef.current?.focus(), 60);
  };

  if (isCompact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        {/* Expand/collapse chat button */}
        <button
          onClick={toggle}
          title="Chat"
          style={{
            width: isCompact ? 48 : 36, 
            height: isCompact ? 48 : 36, 
            borderRadius: '50%', 
            border: 'none',
            background: open ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#fff',
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: isCompact ? '1.4rem' : '1.1rem', 
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
            flexShrink: 0,
            boxShadow: open ? 'none' : '0 8px 24px rgba(217, 119, 6, 0.4)',
            transform: open ? 'rotate(90deg)' : 'none',
          }}
        >
          {open ? '✕' : '💬'}
        </button>

        {open && (
          <div style={{
            position: 'absolute', bottom: '110%', right: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(15,10,25,0.98)', border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: 14, padding: '8px 12px', backdropFilter: 'blur(20px)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)', width: 280, zIndex: 300,
          }}>
            <input
              ref={inputRef}
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={handleKey}
              maxLength={120}
              placeholder="Say something..."
              autoFocus
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#fff', fontSize: '0.8rem', fontWeight: 600,
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={send}
              disabled={!msg.trim()}
              style={{
                background: msg.trim() ? 'rgba(245,158,11,0.9)' : 'rgba(255,255,255,0.05)',
                border: 'none', borderRadius: 8, color: '#fff', cursor: msg.trim() ? 'pointer' : 'default',
                padding: '4px 10px', fontSize: '0.75rem', fontWeight: 900,
                transition: 'all 0.15s',
              }}
            >
              ↑
            </button>
          </div>
        )}
      </div>
    );
  }

  // Non-compact: inline input bar (for lobby)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '8px 12px',
    }}>
      <span style={{ fontSize: '1rem' }}>💬</span>
      <input
        ref={inputRef}
        value={msg}
        onChange={e => setMsg(e.target.value)}
        onKeyDown={handleKey}
        maxLength={120}
        placeholder="Chat with the table..."
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: '#fff', fontSize: '0.82rem', fontWeight: 600,
          fontFamily: 'inherit',
        }}
      />
      <button
        onClick={send}
        disabled={!msg.trim()}
        style={{
          background: msg.trim() ? 'rgba(8,145,178,0.8)' : 'transparent',
          border: 'none', borderRadius: 8, color: '#fff', cursor: msg.trim() ? 'pointer' : 'default',
          padding: '4px 12px', fontSize: '0.8rem', fontWeight: 900,
          transition: 'all 0.15s',
        }}
      >
        SEND
      </button>
    </div>
  );
}
