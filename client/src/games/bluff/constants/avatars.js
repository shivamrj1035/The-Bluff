// Avatar definitions used globally throughout the app
export const AVATAR_OPTIONS = [
  { id: 'crazy1', name: 'Crazy', emoji: '🤪', animation: 'bounce', gradient: 'linear-gradient(135deg, #f97316, #db2777)' },
  { id: 'wink', name: 'Wink', emoji: '😉', animation: 'wink', gradient: 'linear-gradient(135deg, #6d28d9, #7c3aed)' },
  { id: 'cool', name: 'Cool', emoji: '😎', animation: 'swing', gradient: 'linear-gradient(135deg, #10b981, #8b5cf6)' },
  { id: 'rocket', name: 'Rocket', emoji: '🚀', animation: 'fly', gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
  { id: 'genius', name: 'Genius', emoji: '🧐', animation: 'pulse', gradient: 'linear-gradient(135deg, #8b5cf6, #d946ef)' },
  { id: 'party', name: 'Party', emoji: '🥳', animation: 'wiggle', gradient: 'linear-gradient(135deg, #ec4899, #f97316)' },
  { id: 'alien', name: 'Alien', emoji: '👽', animation: 'float', gradient: 'linear-gradient(135deg, #8b5cf6, #10b981)' },
  { id: 'devil', name: 'Devil', emoji: '😈', animation: 'shake', gradient: 'linear-gradient(135deg, #dc2626, #7c3aed)' },
  { id: 'ghost', name: 'Ghost', emoji: '👻', animation: 'fade-bounce', gradient: 'linear-gradient(135deg, #e0e7ff, #6366f1)' },
  { id: 'robot', name: 'Bot', emoji: '🤖', animation: 'mechanical', gradient: 'linear-gradient(135deg, #94a3b8, #475569)' },
  { id: 'crown', name: 'Royal', emoji: '👑', animation: 'shine', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
  { id: 'ninja', name: 'Ninja', emoji: '🥷', animation: 'sneak', gradient: 'linear-gradient(135deg, #1f2937, #111827)' },
];

export const AVATAR_COLORS = ['#6d28d9', '#db2777', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#f97316', '#8b5cf6'];

/**
 * Get avatar data by ID or fallback to letter
 * Returns avatar object with id, name, emoji, animation, gradient
 * If ID not found, returns null (use letter fallback)
 */
export const getAvatarData = (avatarId) => {
  return AVATAR_OPTIONS.find(a => a.id === avatarId) || null;
};

/**
 * Get a color for a letter-based avatar
 * Uses the first character's length to pick a color
 */
export const getLetterColor = (letter) => {
  const idx = (letter.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};
