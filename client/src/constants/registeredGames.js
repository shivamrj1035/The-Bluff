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
    cpScreen: null,           // null = uses Bluff routing
    entryScreen: 'BLUFF_ENTRY',
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
    cpScreen: 'CP_ENTRY',     // non-null = uses CP routing
    entryScreen: 'CP_ENTRY',
  },
];

/** Default enabled games when no settings exist in DB yet */
export const DEFAULT_ENABLED_GAMES = ['bluff'];
