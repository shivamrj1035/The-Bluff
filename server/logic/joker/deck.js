const { SUITS, RANKS } = require('./constants');

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${suit}_${rank}`);
    }
  }
  deck.push('JK_JOKER');
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

function dealAll(players, deck) {
  const hands = {};
  players.forEach(p => { hands[p.id] = []; });
  for (let i = 0; i < deck.length; i++) {
    const player = players[i % players.length];
    hands[player.id].push(deck[i]);
  }
  return hands;
}

function removePairsFromHand(hand) {
  const rankGroups = {};
  for (const card of hand) {
    if (card === 'JK_JOKER') continue;
    const rank = card.split('_')[1];
    if (!rankGroups[rank]) rankGroups[rank] = [];
    rankGroups[rank].push(card);
  }

  const keptCards = [];
  const removedPairs = [];

  if (hand.includes('JK_JOKER')) {
    keptCards.push('JK_JOKER');
  }

  for (const rank in rankGroups) {
    const cards = rankGroups[rank];
    const keepCount = cards.length % 2;
    if (keepCount === 1) {
      keptCards.push(cards[0]);
    }
    for (let i = keepCount; i < cards.length; i += 2) {
      removedPairs.push([cards[i], cards[i+1]]);
    }
  }

  // Filter to keep only the cards that survived pairing (maintaining original relative order)
  const resultHand = hand.filter(c => keptCards.includes(c));
  return { hand: resultHand, removedPairs };
}

function getNextActivePlayer(players, currentId, hands) {
  const idx = players.findIndex(p => p.id === currentId);
  if (idx === -1) return null;
  for (let i = 1; i < players.length; i++) {
    const nextIdx = (idx + i) % players.length;
    const nextPlayer = players[nextIdx];
    if (hands[nextPlayer.id] && hands[nextPlayer.id].length > 0) {
      return nextPlayer.id;
    }
  }
  return null;
}

module.exports = {
  createDeck,
  shuffleDeck,
  dealAll,
  removePairsFromHand,
  getNextActivePlayer,
};
