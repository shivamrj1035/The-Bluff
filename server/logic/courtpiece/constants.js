const CP_GAME_STATES = {
  WAITING:          'WAITING',
  TRUMP_SELECTION:  'TRUMP_SELECTION',   // trump-caller sees first 5 cards, picks trump suit
  DEALING:          'DEALING',           // brief animation state after trump picked (4+4 deal)
  PLAYING:          'PLAYING',           // trick-taking gameplay
  TRICK_RESOLUTION: 'TRICK_RESOLUTION',  // brief pause after all 4 cards played
  ROUND_END:        'ROUND_END',         // round complete — show scores
  GAME_OVER:        'GAME_OVER',         // match won (TARGET_COATS reached)
};

const SUITS      = ['H', 'D', 'C', 'S'];
const RANKS      = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VALUES = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,
};
const SUIT_VALUES  = { S: 4, H: 3, D: 2, C: 1 };
const SUIT_NAMES   = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades' };
const SUIT_SYMBOLS = { H: '♥', D: '♦', C: '♣', S: '♠' };

/** Cards that count as "face cards" for the under-ten (redeal) rule */
const FACE_CARDS = ['J', 'Q', 'K', 'A'];

const CP_EVENTS = {
  // Client → Server
  CP_JOIN_ROOM:       'cp_join_room',
  CP_START_GAME:      'cp_start_game',
  CP_SELECT_TRUMP:    'cp_select_trump',
  CP_REQUEST_REDEAL:  'cp_request_redeal',  // trump-caller has no face cards in first 5
  CP_PLAY_CARD:       'cp_play_card',
  CP_KICK_PLAYER:     'cp_kick_player',
  CP_CLOSE_GAME:      'cp_close_game',
  CP_RESTART_GAME:    'cp_restart_game',
  CP_LEAVE_ROOM:      'cp_leave_room',
  CP_REORDER_PLAYERS: 'cp_reorder_players',
  CP_ADD_BOT:         'cp_add_bot',
  CHAT_MESSAGE:       'chat_message',

  // Server → Client
  CP_GAME_STATE:       'cp_game_state',
  CP_ERROR:            'cp_error',
  CP_ROOM_INFO:        'cp_room_info',
  CP_GAME_STARTED:     'cp_game_started',
  CP_HOST_TRANSFERRED: 'cp_host_transferred',
  CP_KICKED:           'cp_kicked',
  CHAT_BROADCAST:      'chat_broadcast',
};

/** First team to reach this many coats wins the match */
const TARGET_COATS = 5;

/** Maximum consecutive redeals allowed per hand */
const MAX_REDEALS = 2;

module.exports = {
  CP_GAME_STATES,
  SUITS,
  RANKS,
  RANK_VALUES,
  SUIT_VALUES,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  FACE_CARDS,
  CP_EVENTS,
  TARGET_COATS,
  MAX_REDEALS,
};
