/**
 * Bot logic for the Bluff card game.
 */

/**
 * Determine the bot's turn action (PLAY_CARDS, CALL_BLUFF, or PASS_TURN).
 *
 * Heuristics used:
 * 1. Leading (empty pile):
 *    - Find the rank with the highest card count in the bot's hand.
 *    - Play all cards of that rank honestly to get rid of cards faster and safely.
 *
 * 2. Following (non-empty pile):
 *    - Check for bluff:
 *      - Perform card counting: count how many cards of the current round rank are in the bot's hand.
 *      - If the last player played more cards of that rank than are mathematically possible outside the bot's hand, suspicion is 100%.
 *      - Otherwise, calculate suspicion based on number of cards played, the bot's hand overlap, and how close the target is to winning (desperation).
 *      - If suspicion is high enough, call bluff with a weighted random chance.
 *    - Playing/Passing:
 *      - If not calling bluff, check if the bot has the matching round rank cards.
 *      - If yes, play all matching cards honestly.
 *      - If no, calculate bluff chance based on pile size (risk) and hand size (desperation). If bluffing, choose a single card from the rank with the lowest count in hand to preserve larger sets, and play it declaring the round rank. Otherwise, pass.
 */
function getBotPlayMove(hand, roundRank, pile, players, myPlayerId) {
  if (!hand || hand.length === 0) {
    return { action: 'PASS_TURN' };
  }

  // Group hand cards by rank
  const cardsByRank = {};
  hand.forEach(card => {
    const rank = card.split('_')[1];
    if (!cardsByRank[rank]) {
      cardsByRank[rank] = [];
    }
    cardsByRank[rank].push(card);
  });

  const pileCardsCount = pile.flatMap(m => m.cards || []).length;

  // CASE 1: Leading (Empty pile or no active roundRank)
  if (!roundRank || pile.length === 0) {
    // Find rank with maximum cards in hand
    let bestRank = null;
    let maxCount = -1;

    for (const rank of Object.keys(cardsByRank)) {
      if (cardsByRank[rank].length > maxCount) {
        maxCount = cardsByRank[rank].length;
        bestRank = rank;
      }
    }

    if (bestRank) {
      return {
        action: 'PLAY_CARDS',
        cardIds: cardsByRank[bestRank],
        declaredRank: bestRank
      };
    }

    // Fallback just in case
    const firstCard = hand[0];
    const firstCardRank = firstCard.split('_')[1];
    return {
      action: 'PLAY_CARDS',
      cardIds: [firstCard],
      declaredRank: firstCardRank
    };
  }

  // CASE 2: Following an active roundRank
  const lastPlayMove = [...pile].reverse().find(m => m.type === 'PLAY');

  if (lastPlayMove && lastPlayMove.playerId !== myPlayerId) {
    // Check if we should CALL BLUFF
    const targetId = lastPlayMove.playerId;
    const cardsPlayedCount = lastPlayMove.cards ? lastPlayMove.cards.length : 0;
    
    // How many cards of this rank do we have?
    const myMatchingCount = (cardsByRank[roundRank] || []).length;
    const maxPossibleOutside = 4 - myMatchingCount;

    let suspicion = 0;

    // Mathematical certainty of bluff
    if (cardsPlayedCount > maxPossibleOutside) {
      suspicion = 100;
    } else {
      // Heuristic suspicion:
      // More cards played = more suspicious
      suspicion += cardsPlayedCount * 20;

      // More cards in our hand of that rank = more suspicious
      if (myMatchingCount === 1) suspicion += 10;
      if (myMatchingCount === 2) suspicion += 35;
      if (myMatchingCount === 3) suspicion += 70;

      // Desperation of target (cards left in hand)
      const targetPlayer = players.find(p => p.id === targetId);
      if (targetPlayer) {
        const targetCardsLeft = targetPlayer.cardCount;
        if (targetCardsLeft === 0) suspicion += 35;
        else if (targetCardsLeft === 1) suspicion += 20;
        else if (targetCardsLeft === 2) suspicion += 10;
      }
    }

    // If suspicion is high, make a roll to call bluff
    if (suspicion >= 75) {
      const roll = Math.random() * 100;
      if (roll < suspicion) {
        console.log(`[BOT DEBUG] Bot suspicion on player ${targetId} is ${suspicion}%. Calling Bluff!`);
        return { action: 'CALL_BLUFF' };
      }
    }
  }

  // If we didn't call bluff, determine if we play matching cards honestly
  const honestCards = cardsByRank[roundRank] || [];
  if (honestCards.length > 0) {
    return {
      action: 'PLAY_CARDS',
      cardIds: honestCards,
      declaredRank: roundRank
    };
  }

  // No honest cards of roundRank. Can we bluff?
  // Bluffing heuristic:
  // If the pile has too many cards, risk is too high. Just pass.
  if (pileCardsCount >= 6) {
    return { action: 'PASS_TURN' };
  }

  let bluffChance = 20; // 20% base chance to bluff
  
  // If we are close to winning (few cards left), increase bluff chance
  if (hand.length <= 3) {
    bluffChance += 25;
  }

  const roll = Math.random() * 100;
  if (roll < bluffChance) {
    // Select 1 card to play as bluff. 
    // Select from a rank we have the LEAST cards of to keep sets intact.
    let bestBluffCard = null;
    let minRankCount = 99;

    for (const rank of Object.keys(cardsByRank)) {
      if (rank !== roundRank && cardsByRank[rank].length < minRankCount) {
        minRankCount = cardsByRank[rank].length;
        bestBluffCard = cardsByRank[rank][0];
      }
    }

    if (bestBluffCard) {
      console.log(`[BOT DEBUG] Bot deciding to bluff by playing 1 card under rank ${roundRank}`);
      return {
        action: 'PLAY_CARDS',
        cardIds: [bestBluffCard],
        declaredRank: roundRank
      };
    }
  }

  // Default: pass
  return { action: 'PASS_TURN' };
}

/**
 * Determine which card index to pick when resolving a bluff challenge.
 * Simple logic: pick a random index from the played cards.
 */
function getBotPickIndex(lastPlayedMoveCount) {
  if (lastPlayedMoveCount <= 1) return 0;
  return Math.floor(Math.random() * lastPlayedMoveCount);
}

module.exports = {
  getBotPlayMove,
  getBotPickIndex
};
