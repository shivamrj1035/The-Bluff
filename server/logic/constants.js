const GAME_STATES = {
  WAITING: "WAITING",
  DEALING: "DEALING",      // NEW: show shuffle + deal animation
  PLAYER_TURN: "PLAYER_TURN",
  BLUFF_WINDOW: "BLUFF_WINDOW",
  BLUFF_PICKING: "BLUFF_PICKING", // NEW: caller is picking a specific card
  ROUND_RESOLUTION: "ROUND_RESOLUTION",
  GAME_OVER: "GAME_OVER",
  ENDED: "ENDED",                  // NEW: final ranking screen
};

const SUITS = ["H", "D", "C", "S"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const SUIT_NAMES = { H: "Hearts", D: "Diamonds", C: "Clubs", S: "Spades" };

const EVENTS = {
  // Client -> Server
  JOIN_ROOM: "join_room",
  START_GAME: "start_game",
  PLAY_CARDS: "play_cards",
  CALL_BLUFF: "call_bluff",
  PICK_BLUFF_CARD: "pick_bluff_card", // NEW: caller chooses card index
  SELECT_BLUFF_CARD: "select_bluff_card", // NEW: real-time hover sync
  PASS_TURN: "pass_turn",
  LEAVE_ROOM: "leave_room",
  KICK_PLAYER: "kick_player",         // NEW: host removes player
  RESTART_GAME: "restart_game",       // NEW: host restarts from ranking
  CLOSE_GAME: "close_game",           // NEW: host closes room

  // Server -> Client
  GAME_STATE: "game_state",
  ERROR: "error",
  PLAYER_JOINED: "player_joined",
  PLAYER_LEFT: "player_left",
  KICKED: "kicked",                   // NEW: specific event for kicked player
  GAME_STARTED: "game_started",
  DEALING_START: "dealing_start",
  BLUFF_RESULT: "bluff_result",
  ROOM_INFO: "room_info",
  GAME_OVER: "game_over",             // NEW: total game ended
};

module.exports = {
  GAME_STATES,
  SUITS,
  RANKS,
  SUIT_NAMES,
  EVENTS,
};
