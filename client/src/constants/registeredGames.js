/**
 * REGISTERED GAMES
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the single source of truth for every game that has an actual
 * implementation inside client/src/games/.
 *
 * Adding a new game here is the ONLY thing required for it to appear in:
 *   - ExploreGamesPage (game grid)
 *   - AdminPage (enable/disable toggle)
 *
 * The admin controls which of these are ENABLED via siteSettings.enabled_games.
 * Games not in enabled_games are shown as "Coming Soon / Disabled" on the explore page.
 */

export const REGISTERED_GAMES = [
  {
    id: 'bluff',
    title: 'The Bluff',
    desc: 'Lie, bluff and win it all!',
    players: '2-8 Players',
    time: '15-30 min',
    image: '/bluff_thumbnail.png',
    accent: '#7c3aed',
    isNew: true,
    isPopular: true,
    category: 'Strategy',
    entryScreen: 'BLUFF_ENTRY',
    isImplemented: true,
  },
  {
    id: 'courtpiece',
    title: 'Court Piece',
    desc: 'Rang · Trump tricks · 2v2 team battle!',
    players: '4 Players',
    time: '20-40 min',
    image: '/court_piece_thumbnail.png',
    accent: '#f59e0b',
    isNew: true,
    isPopular: false,
    category: 'Classic',
    entryScreen: 'CP_ENTRY',
    isImplemented: true,
  },
  {
    id: 'mendicoat',
    title: 'MendiCoat',
    desc: 'Capture 10s (Mendis) to win! 2v2 Team Battle.',
    players: '4 Players',
    time: '20-40 min',
    image: '/mendi_coat_thumbnail.png',
    accent: '#10b981',
    isNew: true,
    isPopular: false,
    category: 'Classic',
    entryScreen: 'MC_ENTRY',
    isImplemented: true,
  },
  {
    id: 'joker',
    title: 'Joker Game',
    desc: 'Old Maid style. Avoid the wildcard Joker!',
    players: '2-6 Players',
    time: '20-40 min',
    image: '/joker_thumbnail.png',
    accent: '#ef4444',
    category: 'Strategy',
    entryScreen: 'JK_ENTRY',
    isImplemented: true,
  },
  {
    id: 'uno',
    title: 'UNO',
    desc: 'The classic card game!',
    players: '2-10 Players',
    time: '10-20 min',
    image: '/uno_thumbnail.png',
    accent: '#ef4444',
    category: 'Party',
    isImplemented: false,
  },
];

/**
 * Helper to determine if a game should be playable.
 * A game is "Active" if it is both implemented and enabled by admin.
 */
export const DEFAULT_ENABLED_GAMES = ['bluff', 'courtpiece', 'mendicoat', 'joker'];

export const isGameActive = (gameId, enabledGames) => {
  const game = REGISTERED_GAMES.find(g => g.id === gameId);
  if (!game || !game.isImplemented) return false;
  
  if (!enabledGames || enabledGames.length === 0) {
    return DEFAULT_ENABLED_GAMES.includes(gameId);
  }
  
  return enabledGames.includes(gameId) || DEFAULT_ENABLED_GAMES.includes(gameId);
};
