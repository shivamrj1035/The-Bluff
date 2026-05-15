import React from 'react';
import { motion } from 'framer-motion';

const SUIT_SYMBOL = { H: '♥', D: '♦', C: '♣', S: '♠' };
const SUIT_NAME   = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades' };

/**
 * ScoreBoard — displays team tricks and coats.
 * Props:
 *  teams      { A: { tricks, coats }, B: { tricks, coats } }
 *  teamANames string[]  player names on Team A
 *  teamBNames string[]  player names on Team B
 *  trumpSuit  string
 *  targetCoats number
 *  trickCount  number  (tricks played so far this round)
 */
export default function ScoreBoard({ teams, teamANames = [], teamBNames = [], trumpSuit, targetCoats = 5, trickCount = 0 }) {
  const tricksLeft = 13 - trickCount;
  const teamA = teams?.A || { tricks: 0, coats: 0 };
  const teamB = teams?.B || { tricks: 0, coats: 0 };

  return (
    <div style={{
      background: 'linear-gradient(160deg, rgba(15,10,40,0.94), rgba(8,5,25,0.96))',
      border: '1px solid rgba(167,139,250,0.2)',
      borderRadius: 18,
      padding: '14px 18px',
      minWidth: 200,
    }}>
      {/* Trump indicator */}
      {trumpSuit && (
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', color: '#6b7280' }}>TRUMP (RANG)</span>
          <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>
            {SUIT_SYMBOL[trumpSuit]}
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a78bfa' }}>
            {SUIT_NAME[trumpSuit]}
          </div>
        </div>
      )}

      {/* Trick counter */}
      <div style={{ textAlign: 'center', marginBottom: 10, padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.12em', color: '#6b7280' }}>TRICKS LEFT</span>
        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#e2e8f0' }}>{tricksLeft}</div>
      </div>

      {/* Team rows */}
      {[
        { label: 'A', team: teamA, names: teamANames, color: '#f59e0b' },
        { label: 'B', team: teamB, names: teamBNames, color: '#a78bfa' },
      ].map(({ label, team, names, color }) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color, textTransform: 'uppercase' }}>
              Team {label}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Tricks</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.62rem', color: '#6b7280', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {names.join(' & ')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', minWidth: 28, textAlign: 'center' }}>
                {team.tricks}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
