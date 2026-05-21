import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

let jkSocket = null;

function getJKSocket() {
  if (!jkSocket) {
    jkSocket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    });
  }
  return jkSocket;
}

export const useJKStore = create((set, get) => ({
  // Connection state
  jkStatus: 'IDLE',  // 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'
  jkSocket: null,
  jkPlayerId: localStorage.getItem('jk_userId') || `u_${Math.floor(Math.random() * 1000000)}`,
  jkRoomId: localStorage.getItem('jk_roomId') || '',
  jkError: null,

  // Game state from server
  jkGameState: null,

  // UI state
  jkScreen: 'LANDING', // 'LANDING' | 'JK_ENTRY' | 'JK_JOIN'
  jkHostTransferredName: null,
  jkChatMessages: [],

  setJKScreen: (screen) => set({ jkScreen: screen }),

  // Connect to a Joker room
  connectJK: (roomId, playerName, avatar, userId) => {
    const s = getJKSocket();
    const pName = playerName || get().jkPlayerName || '';
    const av    = avatar    || get().jkAvatar     || 'P';
    const uId   = userId || get().jkPlayerId;
    
    if (userId) set({ jkPlayerId: userId });
    if (uId) localStorage.setItem('jk_userId', uId);

    s.off('jk_game_state');
    s.off('jk_error');
    s.off('jk_room_info');
    s.off('jk_kicked');
    s.off('jk_host_transferred');
    s.off('chat_broadcast');
    s.off('disconnect');
    s.off('reconnect');
    s.off('connect');
    s.off('room_closed');

    set({ jkStatus: 'CONNECTING', jkRoomId: roomId, jkError: null, jkSocket: s, jkChatMessages: [] });

    s.on('connect', () => {
      set({ jkStatus: 'CONNECTED', jkError: null });
      if (roomId) localStorage.setItem('jk_roomId', roomId);
      s.emit('jk_join_room', { roomId, playerName: pName, avatar: av, userId: uId });
    });

    s.on('jk_game_state', (state) => {
      if (state.roomId) localStorage.setItem('jk_roomId', state.roomId);
      set({
        jkGameState: state,
        jkRoomId: state.roomId || get().jkRoomId,
        jkError: null,
        jkStatus: 'CONNECTED',
      });
    });

    s.on('jk_room_info', ({ roomId: assignedRoomId, game }) => {
      if (!assignedRoomId) return;
      localStorage.setItem('jk_roomId', assignedRoomId);
      const params = new URLSearchParams(window.location.search);
      params.set('room', assignedRoomId);
      if (game) params.set('game', game);
      window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
      set({ jkRoomId: assignedRoomId, jkStatus: 'CONNECTED', jkError: null });
    });

    s.on('jk_kicked', () => {
      s.disconnect();
      set({ jkStatus: 'ERROR', jkError: 'You were removed from the table by the host.', jkGameState: null });
    });

    s.on('jk_error', ({ message }) => {
      set(st => ({
        jkError: message,
        jkStatus: st.jkGameState ? st.jkStatus : 'ERROR',
      }));
    });

    s.on('jk_host_transferred', ({ newHostId, newHostName }) => {
      set({ jkHostTransferredName: newHostName, jkHostTransferredId: newHostId });
    });

    s.on('chat_broadcast', ({ playerId: senderId, senderName, text, ts }) => {
      const msgId = `${senderId}-${ts}`;
      const newMsg = { id: msgId, senderId, senderName, message: text, ts };
      set(st => ({ jkChatMessages: [...(st.jkChatMessages || []), newMsg] }));
      setTimeout(() => {
        set(st => ({ jkChatMessages: (st.jkChatMessages || []).filter(m => m.id !== msgId) }));
      }, 5500);
    });

    s.on('room_closed', ({ message }) => {
      s.disconnect();
      localStorage.removeItem('jk_roomId');
      set({ 
        jkStatus: 'ERROR', 
        jkError: message || 'This room was terminated by an administrator.', 
        jkGameState: null,
        jkRoomId: ''
      });
    });

    s.on('disconnect', () => set({ jkStatus: 'RECONNECTING' }));

    s.on('reconnect', () => {
      set({ jkStatus: 'CONNECTED', jkError: null });
      const { jkRoomId: rId, jkPlayerId: pId } = get();
      s.emit('jk_join_room', { roomId: rId, playerName: pName, avatar: av, userId: pId });
    });

    if (!s.connected) {
      s.connect();
    } else {
      set({ jkStatus: 'CONNECTED' });
      s.emit('jk_join_room', { roomId, playerName: pName, avatar: av, userId: uId });
    }
  },

  // Game Actions
  jkStartGame: () => {
    const { jkSocket: s } = get();
    s?.emit('jk_start_game');
  },

  jkPickCard: (targetPlayerId, cardIndex) => {
    const { jkSocket: s } = get();
    s?.emit('jk_pick_card', { targetPlayerId, cardIndex });
  },

  jkDiscardPair: (cardIds) => {
    const { jkSocket: s } = get();
    s?.emit('jk_discard_pair', { cardIds });
  },

  jkAddBot: (difficulty) => {
    const { jkSocket: s } = get();
    s?.emit('jk_add_bot', { difficulty });
  },

  jkCloseGame: () => {
    const { jkSocket: s } = get();
    s?.emit('jk_close_game');
  },

  jkRestartGame: () => {
    const { jkSocket: s } = get();
    s?.emit('jk_restart_game');
  },

  jkReorderPlayers: (orderedIds) => {
    const { jkSocket: s } = get();
    s?.emit('jk_reorder_players', { orderedIds });
  },

  jkKickPlayer: (targetId) => {
    const { jkSocket: s } = get();
    s?.emit('jk_kick_player', { targetId });
  },

  jkLeaveRoom: () => {
    const { jkSocket: s } = get();
    s?.emit('jk_leave_room');
    localStorage.removeItem('jk_roomId');
    s?.disconnect();
    set({ jkStatus: 'IDLE', jkRoomId: '', jkGameState: null });
  },

  jkSendMessage: (text) => {
    const { jkSocket: s } = get();
    s?.emit('chat_message', { text });
  },
}));
