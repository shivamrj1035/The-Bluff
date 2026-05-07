import React from 'react';
import { motion } from 'framer-motion';
import { getAvatarData, getLetterColor } from '../../constants/avatars';

/**
 * Renders a player's avatar - either as an emoji or as a letter
 * Supports different sizes and animation styles
 */
const AvatarDisplay = ({ 
  avatarId = 'S', 
  playerName = 'Player',
  size = 48, // default size in pixels
  animated = true, // enable animation
  interactive = false, // add hover effects
  showBorder = false,
}) => {
  const avatarData = getAvatarData(avatarId);
  
  // Get emoji avatar
  if (avatarData) {
    const emojiSize = Math.round(size * 0.55); // emoji is ~55% of container size
    
    let animationProps = {};
    if (animated) {
      switch (avatarData.animation) {
        case 'bounce':
          animationProps = { animate: { y: [0, -4, 0] }, transition: { duration: 0.7, repeat: Infinity, ease: 'easeInOut' } };
          break;
        case 'wink':
          animationProps = { animate: { scale: [1, 1.04, 1] }, transition: { duration: 1.3, repeat: Infinity, ease: 'easeInOut' } };
          break;
        case 'swing':
          animationProps = { animate: { rotate: [-3, 3, -3] }, transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } };
          break;
        case 'fly':
          animationProps = { animate: { y: [0, -6, 0], rotate: [0, 4, -4, 0] }, transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' } };
          break;
        case 'pulse':
          animationProps = { animate: { scale: [1, 1.08, 1] }, transition: { duration: 1, repeat: Infinity, ease: 'easeInOut' } };
          break;
        case 'wiggle':
          animationProps = { animate: { rotate: [-4, 4, -4] }, transition: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } };
          break;
        case 'float':
          animationProps = { animate: { y: [0, -4, 0] }, transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } };
          break;
        case 'shake':
          animationProps = { animate: { x: [-1, 1, -1] }, transition: { duration: 0.4, repeat: Infinity, ease: 'easeInOut' } };
          break;
        case 'fade-bounce':
          animationProps = { animate: { opacity: [0.8, 1, 0.8], y: [0, -4, 0] }, transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } };
          break;
        case 'mechanical':
          animationProps = { animate: { rotate: [0, 2, -2, 0] }, transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } };
          break;
        case 'shine':
          animationProps = { animate: { boxShadow: ['0 0 8px rgba(245,158,11,0.4)', '0 0 16px rgba(251,191,36,0.6)', '0 0 8px rgba(245,158,11,0.4)'] }, transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } };
          break;
        case 'sneak':
          animationProps = { animate: { x: [0, 4, 0] }, transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } };
          break;
        default:
          animationProps = { animate: { scale: [1, 1.04, 1] }, transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } };
      }
    }

    const hoverProps = interactive ? { whileHover: { scale: 1.1 }, whileTap: { scale: 0.95 } } : {};

    return (
      <motion.div
        {...hoverProps}
        {...animationProps}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          background: avatarData.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${emojiSize}px`,
          boxShadow: showBorder ? `0 0 12px ${avatarData.gradient.split(',')[0].match(/#[\da-f]+/i)?.[0] || '#7c3aed'}66` : 'none',
          border: showBorder ? `2px solid rgba(255,255,255,0.15)` : 'none',
          flexShrink: 0,
        }}
        title={playerName}
      >
        {avatarData.emoji}
      </motion.div>
    );
  }

  // Fallback: Letter avatar
  const letter = avatarId.charAt(0).toUpperCase();
  const color = getLetterColor(letter);
  const fontSize = Math.round(size * 0.45);

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${color}, ${color}dd)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${fontSize}px`,
        fontWeight: 900,
        color: '#fff',
        boxShadow: showBorder ? `0 0 8px ${color}66` : 'none',
        border: showBorder ? `2px solid rgba(255,255,255,0.15)` : 'none',
        flexShrink: 0,
      }}
      title={playerName}
    >
      {letter}
    </div>
  );
};

export default AvatarDisplay;
