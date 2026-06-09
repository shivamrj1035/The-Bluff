import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

// Court Piece has its own Socket.IO connection (isolated from Bluff)
let cpSocket = null;

function getCPSocket() {
  if (!cpSocket) {
    cpSocket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    });
  }
  return cpSocket;
}

export const useCPStore = create((set, get) => ({
  // Connection state
  cpStatus: 'IDLE',  // 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'
  cpSocket: null,
  cpPlayerId: localStorage.getItem('cp_userId') || `u_${Math.floor(Math.random() * 1000000)}`,
  cpRoomId: localStorage.getItem('cp_roomId') || '',
  cpError: null,

  // Game state from server
  cpGameState: null,

  // UI state
  cpScreen: 'LANDING', // 'LANDING' | 'CP_ENTRY' | 'CP_JOIN'
  cpSelectedCard: null,
  cpHostTransferredName: null,

  setCPScreen: (screen) => set({ cpScreen: screen }),

  // ── Connect to a Court Piece room ────────────────────────────────────────
  connectCP: (roomId, playerName, avatar, userId) => {
    const s = getCPSocket();
    const pName = playerName || get().cpPlayerName || '';
    const av    = avatar    || get().cpAvatar     || 'P';
    const uId   = userId || get().cpPlayerId;
    
    if (userId) set({ cpPlayerId: userId });
    if (uId) localStorage.setItem('cp_userId', uId);

    s.off('cp_game_state');
    s.off('cp_error');
    s.off('cp_room_info');
    s.off('cp_kicked');
    s.off('cp_host_transferred');
    s.off('chat_broadcast');
    s.off('disconnect');
    s.off('reconnect');
    s.off('connect');
    s.off('room_closed');

    set({ cpStatus: 'CONNECTING', cpRoomId: roomId, cpError: null, cpSocket: s });

    s.on('connect', () => {
      set({ cpStatus: 'CONNECTED', cpError: null });
      if (roomId) localStorage.setItem('cp_roomId', roomId);
      s.emit('cp_join_room', { roomId, playerName: pName, avatar: av, userId: uId });
    });

    s.on('cp_game_state', (state) => {
      if (state.roomId) localStorage.setItem('cp_roomId', state.roomId);
      set({
        cpGameState: state,
        cpRoomId: state.roomId || get().cpRoomId,
        cpError: null,
        cpStatus: 'CONNECTED',
      });
    });

    s.on('cp_room_info', ({ roomId: assignedRoomId, game }) => {
      if (!assignedRoomId) return;
      localStorage.setItem('cp_roomId', assignedRoomId);
      const params = new URLSearchParams(window.location.search);
      params.set('room', assignedRoomId);
      if (game) params.set('game', game);
      window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
      set({ cpRoomId: assignedRoomId, cpStatus: 'CONNECTED', cpError: null });
    });

    s.on('cp_kicked', () => {
      s.disconnect();
      set({ cpStatus: 'ERROR', cpError: 'You were removed from the table by the host.', cpGameState: null });
    });

    s.on('cp_error', ({ message }) => {
      set(st => ({
        cpError: message,
        cpStatus: st.cpGameState ? st.cpStatus : 'ERROR',
      }));
    });

    s.on('cp_host_transferred', ({ newHostId, newHostName }) => {
      set({ cpHostTransferredName: newHostName, cpHostTransferredId: newHostId });
    });

    // Shared chat_broadcast — Court Piece reuses the bluff chat bubble system
    s.on('chat_broadcast', ({ senderId, senderName, message, ts }) => {
      const msgId = `${senderId}-${ts}`;
      const newMsg = { id: msgId, senderId, senderName, message, ts };
      set(st => ({ cpChatMessages: [...(st.cpChatMessages || []), newMsg] }));
      setTimeout(() => {
        set(st => ({ cpChatMessages: (st.cpChatMessages || []).filter(m => m.id !== msgId) }));
      }, 5500);
    });

    s.on('room_closed', ({ message }) => {
      s.disconnect();
      localStorage.removeItem('cp_roomId');
      set({ 
        cpStatus: 'ERROR', 
        cpError: message || 'This room was terminated by an administrator.', 
        cpGameState: null,
        cpRoomId: ''
      });
    });

    s.on('disconnect', () => set({ cpStatus: 'RECONNECTING' }));

    s.on('reconnect', () => {
      set({ cpStatus: 'CONNECTED', cpError: null });
      const { cpRoomId: rId, cpPlayerId: pId } = get();
      s.emit('cp_join_room', { roomId: rId, playerName: pName, avatar: av, userId: pId });
    });

    if (!s.connected) {
      s.connect();
    } else {
      set({ cpStatus: 'CONNECTED' });
      s.emit('cp_join_room', { roomId, playerName: pName, avatar: av, userId: uId });
    }
  },

  // ── Game Actions ─────────────────────────────────────────────────────────
  cpStartGame: () => {
    const { cpSocket: s, cpRoomId } = get();
    s?.emit('cp_start_game', { roomId: cpRoomId });
  },

  cpRestart: () => {
    const { cpSocket: s, cpRoomId } = get();
    s?.emit('cp_restart', { roomId: cpRoomId });
  },

  cpSelectTrump: (suit) => {
    const { cpSocket: s, cpRoomId } = get();
    s?.emit('cp_select_trump', { roomId: cpRoomId, suit });
  },

  cpPlayCard: (card) => {
    const { cpSocket: s, cpRoomId } = get();
    s?.emit('cp_play_card', { roomId: cpRoomId, card });
    set({ cpSelectedCard: null });
  },

  cpSetSelectedCard: (card) => set({ cpSelectedCard: card }),

  cpKickPlayer: (targetId) => {
    const { cpSocket: s, cpRoomId } = get();
    s?.emit('cp_kick_player', { roomId: cpRoomId, targetId });
  },

  cpReorderPlayers: (orderedIds) => {
    const { cpSocket: s, cpRoomId } = get();
    s?.emit('cp_reorder_players', { roomId: cpRoomId, orderedIds });
  },

  // Chat messages
  cpChatMessages: [],

  cpAddBot: () => {
    const { cpSocket: s, cpRoomId } = get();
    s?.emit('cp_add_bot', { roomId: cpRoomId });
  },

  cpCloseGame: () => {
    const { cpSocket: s, cpRoomId } = get();
    s?.emit('cp_close_game', { roomId: cpRoomId });
  },

  cpRestartGame: () => {
    const { cpSocket: s, cpRoomId } = get();
    s?.emit('cp_restart_game', { roomId: cpRoomId });
  },

  cpSendChat: (message) => {
    const { cpSocket: s, cpRoomId } = get();
    if (!message?.trim()) return;
    s?.emit('chat_message', { roomId: cpRoomId, message: message.trim() });
  },

  cpDisconnect: () => {
    localStorage.removeItem('cp_roomId');
    const s = getCPSocket();
    s?.disconnect();
    set({ cpStatus: 'IDLE', cpGameState: null, cpRoomId: '', cpSelectedCard: null });
  },
}));
