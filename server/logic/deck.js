const { SUITS, RANKS } = require("./constants");

/**
 * Creates a standard 52-card deck.
 * Format: "SUIT_RANK" (e.g., "H_A" for Ace of Hearts)
 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${suit}_${rank}`);
    }
  }
  return deck;
}

/**
 * Shuffles an array in place using Durstenfeld shuffle (Fisher-Yates variation).
 */
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deals cards evenly among players.
 */
function dealCards(players, deck) {
  const hands = {};
  players.forEach((player) => {
    hands[player.id] = [];
  });

  deck.forEach((card, index) => {
    const playerIndex = index % players.length;
    const playerId = players[playerIndex].id;
    hands[playerId].push(card);
  });

  return hands;
}

module.exports = {
  createDeck,
  shuffleDeck,
  dealCards,
};
