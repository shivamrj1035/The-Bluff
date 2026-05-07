// Avatar definitions used globally throughout the app
export const AVATAR_OPTIONS = [
  { id: 'crazy1', name: 'Crazy', emoji: '🤪', animation: 'bounce', gradient: 'linear-gradient(135deg, #7c3aed, #4c1d95)' },
  { id: 'wink', name: 'Wink', emoji: '😉', animation: 'wink', gradient: 'linear-gradient(135deg, #6d28d9, #7c3aed)' },
  { id: 'cool', name: 'Cool', emoji: '😎', animation: 'swing', gradient: 'linear-gradient(135deg, #06d6a0, #7c3aed)' },
  { id: 'rocket', name: 'Rocket', emoji: '🚀', animation: 'fly', gradient: 'linear-gradient(135deg, #7c3aed, #4c1d95)' },
  { id: 'genius', name: 'Genius', emoji: '🧐', animation: 'pulse', gradient: 'linear-gradient(135deg, #7c3aed, #2e1065)' },
  { id: 'party', name: 'Party', emoji: '🥳', animation: 'wiggle', gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)' },
  { id: 'alien', name: 'Alien', emoji: '👽', animation: 'float', gradient: 'linear-gradient(135deg, #7c3aed, #6d28d9)' },
  { id: 'devil', name: 'Devil', emoji: '😈', animation: 'shake', gradient: 'linear-gradient(135deg, #7c3aed, #003049)' },
  { id: 'ghost', name: 'Ghost', emoji: '👻', animation: 'fade-bounce', gradient: 'linear-gradient(135deg, #caf0f8, #7c3aed)' },
  { id: 'robot', name: 'Bot', emoji: '🤖', animation: 'mechanical', gradient: 'linear-gradient(135deg, #94a3b8, #7c3aed)' },
  { id: 'crown', name: 'Royal', emoji: '👑', animation: 'shine', gradient: 'linear-gradient(135deg, #7c3aed, #6d28d9)' },
  { id: 'ninja', name: 'Ninja', emoji: '🥷', animation: 'sneak', gradient: 'linear-gradient(135deg, #4c1d95, #2e1065)' },
];

export const AVATAR_COLORS = ['#7c3aed', '#4c1d95', '#6d28d9', '#5b21b6', '#4c1d95', '#4c1d95', '#2e1065', '#6d28d9'];

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
