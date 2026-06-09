const MC_GAME_STATES = {
  WAITING:          'WAITING',
  TRUMP_SELECTION:  'TRUMP_SELECTION',
  DEALING:          'DEALING',
  PLAYING:          'PLAYING',
  TRICK_RESOLUTION: 'TRICK_RESOLUTION',
  ROUND_END:        'ROUND_END',
  GAME_OVER:        'GAME_OVER',
};

const SUITS      = ['H', 'D', 'C', 'S'];
const RANKS      = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VALUES = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,
};
const SUIT_VALUES  = { S: 4, H: 3, D: 2, C: 1 };
const SUIT_NAMES   = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades' };
const SUIT_SYMBOLS = { H: '♥', D: '♦', C: '♣', S: '♠' };

const FACE_CARDS = ['J', 'Q', 'K', 'A'];

const MC_EVENTS = {
  MC_JOIN_ROOM:       'mc_join_room',
  MC_START_GAME:      'mc_start_game',
  MC_SELECT_TRUMP:    'mc_select_trump',
  MC_REQUEST_REDEAL:  'mc_request_redeal',
  MC_PLAY_CARD:       'mc_play_card',
  MC_KICK_PLAYER:     'mc_kick_player',
  MC_CLOSE_GAME:      'mc_close_game',
  MC_RESTART_GAME:    'mc_restart_game',
  MC_LEAVE_ROOM:      'mc_leave_room',
  MC_REORDER_PLAYERS: 'mc_reorder_players',
  MC_ADD_BOT:         'mc_add_bot',
  MC_RESHUFFLE:       'mc_reshuffle',
  CHAT_MESSAGE:       'chat_message',

  MC_GAME_STATE:       'mc_game_state',
  MC_ERROR:            'mc_error',
  MC_ROOM_INFO:        'mc_room_info',
  MC_GAME_STARTED:     'mc_game_started',
  MC_HOST_TRANSFERRED: 'mc_host_transferred',
  MC_KICKED:           'mc_kicked',
  CHAT_BROADCAST:      'chat_broadcast',
};

const TARGET_COATS = 5;
const MAX_REDEALS = 2;

module.exports = {
  MC_GAME_STATES,
  SUITS,
  RANKS,
  RANK_VALUES,
  SUIT_VALUES,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  FACE_CARDS,
  MC_EVENTS,
  TARGET_COATS,
  MAX_REDEALS,
};
