const { SUITS, RANKS, RANK_VALUES, SUIT_VALUES, FACE_CARDS } = require('./constants');

// ─────────────────────────────────────────────────────────────────────────────
//  CARD HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${suit}_${rank}`);
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function getCardRank(cardId) {
  return cardId.split('_')[1];
}

function getCardSuit(cardId) {
  return cardId.split('_')[0];
}

function cardRankValue(cardId) {
  return RANK_VALUES[getCardRank(cardId)] || 0;
}

function cardSuitValue(cardId) {
  return SUIT_VALUES[getCardSuit(cardId)] || 0;
}

/**
 * Compare two cards by rank, then suit as tiebreaker.
 * Returns positive if cardA > cardB.
 */
function compareCards(cardA, cardB) {
  const rankDiff = cardRankValue(cardA) - cardRankValue(cardB);
  if (rankDiff !== 0) return rankDiff;
  return cardSuitValue(cardA) - cardSuitValue(cardB);
}

/**
 * Returns true if the card is a face card (J, Q, K, A).
 */
function isFaceCard(cardId) {
  return FACE_CARDS.includes(getCardRank(cardId));
}

/**
 * Returns true if the card is a Mendi (Rank 10).
 */
function isMendi(cardId) {
  return getCardRank(cardId) === '10';
}

// ─────────────────────────────────────────────────────────────────────────────
//  DEAL FUNCTIONS  (5-4-4 format)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * dealCards() — Stage 1 of the 5-4-4 deal.
 * Deals exactly 5 cards to the trump-caller. All other players get 0 cards yet.
 * Returns { hands, reserved } where reserved is the remaining 47-card deck.
 *
 * @param {string}   trumpCallerId  - socket id of the trump-caller
 * @param {Array}    players        - ordered players array
 * @param {Array}    deck           - shuffled 52-card deck
 * @returns {{ hands: Object, reserved: Array }}
 */
function dealCards(trumpCallerId, players, deck) {
  const hands = {};
  players.forEach(p => { hands[p.id] = []; });
  hands[trumpCallerId] = deck.slice(0, 5);
  const reserved = deck.slice(5); // 47 cards remaining
  return { hands, reserved };
}

/**
 * dealRemaining() — Stage 2 of the 5-4-4 deal.
 * After trump is selected, deals 4+4 more to all 4 players (including trump-caller).
 * Trump-caller already has 5, gets 4 more → 9 total? No — standard is 13 total.
 * Standard 5-4-4: trump-caller gets 5 first, then 4 more = 9? No.
 *
 * Correct standard deal per player:
 *   - Trump-caller: 5 (first batch) + 4 + 4 = 13
 *   - Others:       0 (first batch) + 5 + 4 + 4? No — others also get 13 total.
 *
 * Actual sequence:
 *   1. Deal 5 to trump-caller only.
 *   2. Trump is declared.
 *   3. Deal 4 to each player (including trump-caller) = 16 cards → caller has 9
 *   4. Deal 4 more to each = 16 more → caller has 13, others have 8? Still wrong.
 *
 * Clarification: 5-4-4 format means the DEALER deals in batches:
 *   - Batch 1: 5 cards to trump-caller (only)
 *   - After trump: Batch 2: 4 cards to EACH of 4 players (16 cards total)
 *   - Batch 3: 4 cards to EACH of 4 players (16 cards total)
 *   Total: 5 + 4*4 + 4*4 = 5 + 16 + 16 = 37 cards for caller? Wrong.
 *
 * The correct standard interpretation of "5-4-4":
 *   Each player ultimately gets 13 cards.
 *   The 5-4-4 refers to the ROUNDS of dealing, NOT just for the caller:
 *   - Round 1: 5 cards to EACH player = 20 cards dealt
 *     (but trump-caller looks at their 5 and declares trump before anyone else sees theirs)
 *   - Round 2: 4 cards to EACH player = 16 cards
 *   - Round 3: 4 cards to EACH player = 16 cards
 *   Total: 5 + 4 + 4 = 13 cards per player ✓
 *
 * For online play, all cards can be pre-dealt privately. We deal:
 *   - All 52 cards assigned to all 4 players (13 each).
 *   - Only the trump-caller can see their hand (first 5 visible) before trump is declared.
 *   - After trump is declared, all players see their full 13 cards.
 *
 * @param {Object} existingHands  - { playerId: card[] } — trump-caller already has their 5
 * @param {Array}  reserved       - 47 remaining cards
 * @param {Array}  players        - ordered players array
 * @param {string} trumpCallerId  - to give them 8 more (total 13)
 * @returns {Object} complete hands { playerId: card[] }
 */
function dealRemaining(existingHands, reserved, players, trumpCallerId) {
  const hands = {};
  players.forEach(p => { hands[p.id] = [...(existingHands[p.id] || [])]; });

  // Distribute remaining 47 cards: trump-caller needs 8 more, others need 13 each
  // Total to distribute: 8 + 13 + 13 + 13 = 47 ✓
  let idx = 0;
  for (const p of players) {
    const needed = 13 - hands[p.id].length;
    for (let i = 0; i < needed; i++) {
      hands[p.id].push(reserved[idx++]);
    }
  }
  return hands;
}

/**
 * dealAll() — Deal all 52 cards evenly to 4 players (13 each).
 * Used when 5-4-4 staged dealing is not needed (e.g. internal resets).
 */
function dealAll(players, deck) {
  const hands = {};
  players.forEach(p => { hands[p.id] = []; });
  for (let i = 0; i < deck.length; i++) {
    hands[players[i % 4].id].push(deck[i]);
  }
  return hands;
}

module.exports = {
  createDeck,
  shuffleDeck,
  dealCards,
  dealRemaining,
  dealAll,
  getCardRank,
  getCardSuit,
  cardRankValue,
  cardSuitValue,
  compareCards,
  isFaceCard,
  isMendi,
};
