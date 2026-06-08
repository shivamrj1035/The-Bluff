const assert = require('assert');
const { getBotPlayCard } = require('../logic/mendicoat/bot');
const { createDeck } = require('../logic/mendicoat/deck');

// Mock players info
const players = [
  { id: 'p1', name: 'Player 1', isBot: false },
  { id: 'p2', name: 'Bot 1', isBot: true, difficulty: 'Easy' }, // Team B
  { id: 'p3', name: 'Player 2', isBot: false },
  { id: 'p4', name: 'Bot 2', isBot: true, difficulty: 'Expert' } // Team B
];

// Team mapping:
// p1 (Team A)
// p2 (Team B)
// p3 (Team A)
// p4 (Team B)

function runTests() {
  console.log('🧪 Running Mendicoat Bot Upgraded Heuristics Tests...\n');

  // ─────────────────────────────────────────────────────────────────────────
  //  TEST 1: Easy Bot plays legal moves only
  // ─────────────────────────────────────────────────────────────────────────
  console.log('▶ Test 1: Easy Bot');
  const handEasy = ['H_A', 'D_10', 'D_2', 'S_3'];
  const playersEasy = players.map(p => p.id === 'p2' ? { ...p, difficulty: 'Easy' } : p);
  
  // Follow suit when we have lead suit cards (D_10, D_2)
  // Easy bot should play the lowest lead card: D_2
  const playEasyFollow = getBotPlayCard(handEasy, [{ playerId: 'p1', card: 'D_5', team: 'A' }], 'H', 'D', 'p2', playersEasy, {});
  assert.strictEqual(playEasyFollow, 'D_2', 'Easy bot should follow suit with lowest lead card');
  
  // Lead when leading
  // Easy bot should play the lowest card in hand: D_2
  const playEasyLead = getBotPlayCard(handEasy, [], 'H', null, 'p2', playersEasy, {});
  assert.strictEqual(playEasyLead, 'D_2', 'Easy bot leading should play lowest card in hand');
  console.log('✅ Test 1 Passed!');

  // ─────────────────────────────────────────────────────────────────────────
  //  TEST 2: Medium Bot basic trump conservation
  // ─────────────────────────────────────────────────────────────────────────
  console.log('▶ Test 2: Medium Bot');
  const handMedium = ['H_A', 'H_5', 'D_2', 'C_Q']; // H is trump
  const playersMedium = players.map(p => p.id === 'p2' ? { ...p, difficulty: 'Medium' } : p);

  // Out of lead suit (S is led). Opponent plays S_A.
  // Medium bot should cut with lowest trump: H_5
  const playMediumCut = getBotPlayCard(
    handMedium, 
    [{ playerId: 'p1', card: 'S_A', team: 'A' }], 
    'H', 'S', 'p2', playersMedium, {}
  );
  assert.strictEqual(playMediumCut, 'H_5', 'Medium bot should cut with lowest trump card');

  // Leading: highest non-trump non-mendi (C_Q)
  const playMediumLead = getBotPlayCard(
    handMedium,
    [],
    'H', null, 'p2', playersMedium, {}
  );
  assert.strictEqual(playMediumLead, 'C_Q', 'Medium bot leading should play highest non-trump non-mendi card');
  console.log('✅ Test 2 Passed!');

  // ─────────────────────────────────────────────────────────────────────────
  //  TEST 3: Hard Bot partner awareness and Mendi protection
  // ─────────────────────────────────────────────────────────────────────────
  console.log('▶ Test 3: Hard Bot');
  const handHard = ['H_A', 'H_5', 'D_10', 'D_3']; // H is trump
  const playersHard = players.map(p => p.id === 'p4' ? { ...p, difficulty: 'Hard' } : p);

  // Partner is winning the trick with C_A. We are out of C.
  // Hard bot should discard lowest non-trump non-Mendi: D_3 (saving trump H_5 and protecting Mendi D_10)
  const playHardPartnerWin = getBotPlayCard(
    handHard,
    [{ playerId: 'p2', card: 'C_A', team: 'B' }], // Partner p2 is winning
    'H', 'C', 'p4', playersHard, {}
  );
  assert.strictEqual(playHardPartnerWin, 'D_3', 'Hard bot should discard lowest non-trump non-Mendi when partner wins');

  // Partner is winning, we are out of suit, and we have a Mendi in hand: H_A, H_5, D_10
  // Hard bot should discard the non-trump Mendi D_10 to let the partner win it!
  const handHardWithMendi = ['H_A', 'H_5', 'D_10'];
  const playHardFeedMendi = getBotPlayCard(
    handHardWithMendi,
    [{ playerId: 'p2', card: 'C_A', team: 'B' }], // Partner winning
    'H', 'C', 'p4', playersHard, {}
  );
  assert.strictEqual(playHardFeedMendi, 'D_10', 'Hard bot should feed its Mendi to the winning partner');
  console.log('✅ Test 3 Passed!');

  // ─────────────────────────────────────────────────────────────────────────
  //  TEST 4: Expert Bot card memory and void-suit tracking
  // ─────────────────────────────────────────────────────────────────────────
  console.log('▶ Test 4: Expert Bot');
  const handExpert = ['S_A', 'H_K', 'H_2']; // H is trump
  const playersExpert = players.map(p => p.id === 'p4' ? { ...p, difficulty: 'Expert' } : p);

  // Simulated tricks history: Opponent p1 is void in Spades (played D_10 on a Spades lead previously)
  const roomMock = {
    tricksHistory: [
      [
        { playerId: 'p3', card: 'S_5', team: 'A' },
        { playerId: 'p4', card: 'S_Q', team: 'B' },
        { playerId: 'p1', card: 'D_10', team: 'A' }, // p1 plays Diamond on Spades lead -> void in Spades!
        { playerId: 'p2', card: 'S_K', team: 'B' }
      ]
    ]
  };

  // We are leading. We have S_A (Ace of Spades) and trumps (H_K, H_2).
  // Under standard play, we might lead S_A.
  // But because opponent p1 is void in Spades, playing S_A is unsafe as they will cut it.
  // So the Expert bot should avoid leading Spades and lead its lowest trump: H_2
  const playExpertLead = getBotPlayCard(
    handExpert,
    [],
    'H', null, 'p4', playersExpert, roomMock
  );
  assert.strictEqual(playExpertLead, 'H_2', 'Expert bot should avoid leading a suit that opponents are void in');

  // Mendi Chase Mode: Opponent team has captured a Mendi, and we want to win tricks.
  // Hand: H_K (trump), H_2 (trump), D_5 (non-trump). Trump is H. Lead is C. Opponent plays C_A.
  // Since we are in Chase Mode, we want to cut even though there is no Mendi in the trick yet.
  const handExpertChase = ['H_K', 'H_2', 'D_5'];
  const roomMockChase = {
    teams: {
      A: { tricks: 1, mendis: 1 }, // Opponent Team A has a Mendi!
      B: { tricks: 0, mendis: 0 }
    },
    tricksHistory: []
  };
  const playExpertChase = getBotPlayCard(
    handExpertChase,
    [{ playerId: 'p1', card: 'C_A', team: 'A' }], // Opponent winning with C_A
    'H', 'C', 'p4', playersExpert, roomMockChase
  );
  assert.strictEqual(playExpertChase, 'H_2', 'Expert bot should cut in Chase Mode when opponent has a Mendi');
  console.log('✅ Test 4 Passed!');

  console.log('\n🎉 All Mendicoat Bot Heuristics Tests Passed Successfully!');
}

runTests();
