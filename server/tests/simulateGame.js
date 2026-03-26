const { createRoom, reducer } = require("../logic/gameState");
const { validateAction } = require("../logic/validator");
const { GAME_STATES } = require("../logic/constants");

function simulate() {
  console.log("🚀 Starting The Bluff Game Engine Simulation...\n");

  let room = createRoom("room-101");
  const p1 = { id: "p1", name: "Shivam" };
  const p2 = { id: "p2", name: "Alice" };
  const p3 = { id: "p3", name: "Bob" };

  room.players = [p1, p2, p3];

  // 1. Start Game
  console.log("--- Action: START_GAME ---");
  const startValidation = validateAction(room, p1.id, "START_GAME", {});
  if (!startValidation.valid) throw new Error(startValidation.message);
  
  room = reducer(room, { type: "START_GAME", playerId: p1.id });
  console.log(`State: ${room.state}`);
  console.log(`Hands: ${Object.keys(room.hands).map(id => `${id}: ${room.hands[id].length} cards`).join(", ")}`);
  console.log(`Current Turn: ${room.currentTurn}\n`);

  // 2. P1 Plays cards
  const p1_cards = [room.hands["p1"][0], room.hands["p1"][1]];
  console.log(`--- Action: P1 plays 2 cards as "A" ---`);
  const playValidation = validateAction(room, "p1", "PLAY_CARDS", { cardIds: p1_cards, declaredRank: "A" });
  if (!playValidation.valid) throw new Error(playValidation.message);

  room = reducer(room, { type: "PLAY_CARDS", playerId: "p1", payload: { cardIds: p1_cards, declaredRank: "A" } });
  console.log(`State: ${room.state}`);
  console.log(`Pile Count: ${room.pile.length}`);
  console.log(`P1 Hand Count: ${room.hands["p1"].length}\n`);

  // 3. P2 Calls Bluff
  console.log("--- Action: P2 calls Bluff! ---");
  const bluffValidation = validateAction(room, "p2", "CALL_BLUFF", {});
  if (!bluffValidation.valid) throw new Error(bluffValidation.message);

  room = reducer(room, { type: "RESOLVE_BLUFF", playerId: "p2", payload: { callerId: "p2" } });
  console.log(`Bluff Result: ${room.bluffResult.wasBluff ? "CAUGHT!" : "TRUTHFUL!"}`);
  console.log(`Liar: ${room.bluffResult.liarId || "None"}`);
  console.log(`New Turn: ${room.currentTurn}`);
  console.log(`New Hand Counts: ${room.players.map(p => `${p.name}: ${p.cardCount}`).join(", ")}\n`);

  console.log("✅ Simulation complete. Engine is working as expected.");
}

try {
  simulate();
} catch (error) {
  console.error("❌ Simulation Failed:", error.message);
  process.exit(1);
}
