const { getPreviousActivePlayer } = require('./deck');

/**
 * Initializes or updates memory for all bots in the room.
 */
function updateJKBotMemory(room, action) {
  room.botMemory = room.botMemory || {};

  // Initialize bot memories
  room.players.forEach(p => {
    if (p.isBot || !p.isConnected) {
      if (!room.botMemory[p.id]) {
        room.botMemory[p.id] = {
          seenCards: {},          // playerId -> array of card IDs the bot has seen
          jokerProbabilities: {}, // playerId -> probability (0 to 1)
          opponentPatterns: {},   // tracks picking behavior
        };
      }
    }
  });

  if (action.type === 'deal') {
    room.players.forEach(bot => {
      if (!bot.isBot && bot.isConnected) return;
      const mem = room.botMemory[bot.id];
      const myHand = room.hands[bot.id] || [];

      mem.seenCards = {};
      mem.jokerProbabilities = {};

      if (myHand.includes('JK_JOKER')) {
        // Bot has the Joker.
        room.players.forEach(other => {
          mem.jokerProbabilities[other.id] = other.id === bot.id ? 1 : 0;
        });
      } else {
        // Distribute probability among other players based on card counts
        mem.jokerProbabilities[bot.id] = 0;
        let totalOtherCards = 0;
        room.players.forEach(other => {
          if (other.id !== bot.id) {
            totalOtherCards += (room.hands[other.id] || []).length;
          }
        });
        room.players.forEach(other => {
          if (other.id !== bot.id) {
            const count = (room.hands[other.id] || []).length;
            mem.jokerProbabilities[other.id] = totalOtherCards > 0 ? (count / totalOtherCards) : 0;
          }
        });
      }
    });
    return;
  }

  if (action.type === 'JK_PICK_CARD') {
    const { playerId: pickerId, payload } = action;
    const { targetPlayerId, cardIndex, card, removedPair } = payload;

    room.players.forEach(bot => {
      if (!bot.isBot && bot.isConnected) return;
      const mem = room.botMemory[bot.id];

      // Markov transition update for Joker probabilities
      const pY = mem.jokerProbabilities[targetPlayerId] || 0;
      const countY = (room.hands[targetPlayerId] || []).length + 1; // Count prior to drawing
      const pDrawn = pY * (1 / countY);

      mem.jokerProbabilities[targetPlayerId] = Math.max(0, pY - pDrawn);
      mem.jokerProbabilities[pickerId] = Math.min(1, (mem.jokerProbabilities[pickerId] || 0) + pDrawn);

      // If Joker card identity is explicitly confirmed:
      if (card === 'JK_JOKER') {
        room.players.forEach(p => {
          mem.jokerProbabilities[p.id] = p.id === pickerId ? 1 : 0;
        });
      }

      // Players with 0 cards have 0 probability
      room.players.forEach(p => {
        const len = (room.hands[p.id] || []).length;
        if (len === 0) {
          mem.jokerProbabilities[p.id] = 0;
        }
      });

      // Normalize probabilities
      let sum = 0;
      room.players.forEach(p => { sum += mem.jokerProbabilities[p.id] || 0; });
      if (sum > 0) {
        room.players.forEach(p => {
          mem.jokerProbabilities[p.id] = (mem.jokerProbabilities[p.id] || 0) / sum;
        });
      }

      // Update seen cards:
      // Picker sees what card was picked
      if (bot.id === pickerId) {
        mem.seenCards[targetPlayerId] = mem.seenCards[targetPlayerId] || [];
        // Track card inside target's list so we know it left target's hand
        mem.seenCards[targetPlayerId] = mem.seenCards[targetPlayerId].filter(c => c !== card);

        // Add to our own hand seen list
        mem.seenCards[pickerId] = mem.seenCards[pickerId] || [];
        if (!mem.seenCards[pickerId].includes(card)) {
          mem.seenCards[pickerId].push(card);
        }
      }

      // Target remembers losing the card
      if (bot.id === targetPlayerId) {
        if (mem.seenCards[targetPlayerId]) {
          mem.seenCards[targetPlayerId] = mem.seenCards[targetPlayerId].filter(c => c !== card);
        }
      }

      // If a pair was removed, remove those cards from all memory lists
      if (removedPair) {
        room.players.forEach(p => {
          if (mem.seenCards[p.id]) {
            mem.seenCards[p.id] = mem.seenCards[p.id].filter(c => c !== removedPair[0] && c !== removedPair[1]);
          }
        });
      }

      // Opponent patterns tracking
      mem.opponentPatterns[pickerId] = mem.opponentPatterns[pickerId] || { pickIndices: [] };
      mem.opponentPatterns[pickerId].pickIndices.push(cardIndex);
    });
  }
}

/**
 * Main function to retrieve play action for a bot.
 */
function getJKBotPlayAction(room, botId) {
  const targetPlayerId = getPreviousActivePlayer(room.players, botId, room.hands);
  if (!targetPlayerId) return null;

  const targetHand = room.hands[targetPlayerId] || [];
  if (targetHand.length === 0) return null;

  const botPlayer = room.players.find(p => p.id === botId);
  const difficulty = botPlayer?.difficulty || 'easy';

  // Easy bot logic (completely random picking)
  if (difficulty === 'easy') {
    const cardIndex = Math.floor(Math.random() * targetHand.length);
    return { targetPlayerId, cardIndex };
  }

  // Medium / Hard Bot Logic
  const mem = room.botMemory?.[botId] || { seenCards: {}, jokerProbabilities: {} };
  const seenTargetCards = mem.seenCards[targetPlayerId] || [];
  const myHand = room.hands[botId] || [];

  // Generate score weights for each index in target's hand
  const weights = targetHand.map((card, idx) => {
    // Determine if bot remembers/knows this card
    let knowsCard = false;
    if (difficulty === 'hard') {
      knowsCard = seenTargetCards.includes(card) || card === 'JK_JOKER' && mem.jokerProbabilities[targetPlayerId] === 1;
    } else if (difficulty === 'medium') {
      // 70% memory recall for Medium
      knowsCard = seenTargetCards.includes(card) && Math.random() < 0.70;
    }

    if (knowsCard) {
      if (card === 'JK_JOKER') {
        return 0; // Avoid drawing the Joker if we know where it is!
      }
      
      // Check if this card forms a pair in our hand
      const rank = card.split('_')[1];
      const hasMatch = myHand.some(c => c !== 'JK_JOKER' && c.split('_')[1] === rank);
      if (hasMatch) {
        return 100; // Prioritize making pairs
      }

      return 10; // General safe card
    }

    // Default weight for unknown cards
    return 5;
  });

  // Pick index with max weight
  let bestIdx = 0;
  let maxWeight = -1;
  const candidates = [];

  weights.forEach((w, idx) => {
    if (w > maxWeight) {
      maxWeight = w;
      bestIdx = idx;
      candidates.length = 0; // Clear array
      candidates.push(idx);
    } else if (w === maxWeight) {
      candidates.push(idx);
    }
  });

  const cardIndex = candidates[Math.floor(Math.random() * candidates.length)];

  // Debug statement for tracing bot decisions
  const jokerProb = mem.jokerProbabilities[targetPlayerId] || 0;
  console.log(`[JK BOT DEBUG] Bot ${botPlayer.name} (${difficulty.toUpperCase()}): Target ${room.players.find(p => p.id === targetPlayerId)?.name}. Estimating Joker probability of target: ${(jokerProb * 100).toFixed(1)}%. Chosen CardIndex: ${cardIndex} (weight: ${maxWeight})`);

  return { targetPlayerId, cardIndex };
}

module.exports = {
  updateJKBotMemory,
  getJKBotPlayAction
};
