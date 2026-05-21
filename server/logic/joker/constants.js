const JK_GAME_STATES = {
  WAITING:   'WAITING',
  PLAYING:   'PLAYING',
  GAME_OVER: 'GAME_OVER',
};

const SUITS = ['H', 'D', 'C', 'S'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

const JK_EVENTS = {
  JK_JOIN_ROOM:       'jk_join_room',
  JK_START_GAME:      'jk_start_game',
  JK_PICK_CARD:       'jk_pick_card',
  JK_KICK_PLAYER:     'jk_kick_player',
  JK_CLOSE_GAME:      'jk_close_game',
  JK_RESTART_GAME:    'jk_restart_game',
  JK_LEAVE_ROOM:      'jk_leave_room',
  JK_REORDER_PLAYERS: 'jk_reorder_players',
  JK_ADD_BOT:         'jk_add_bot',
  JK_DISCARD_PAIR:    'jk_discard_pair',
  CHAT_MESSAGE:       'chat_message',

  JK_GAME_STATE:       'jk_game_state',
  JK_ERROR:            'jk_error',
  JK_ROOM_INFO:        'jk_room_info',
  JK_GAME_STARTED:     'jk_game_started',
  JK_HOST_TRANSFERRED: 'jk_host_transferred',
  JK_KICKED:           'jk_kicked',
  CHAT_BROADCAST:      'chat_broadcast',
};

module.exports = {
  JK_GAME_STATES,
  SUITS,
  RANKS,
  JK_EVENTS,
};
