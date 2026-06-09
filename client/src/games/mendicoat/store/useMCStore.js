import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

// MendiCoat has its own Socket.IO connection
let mcSocket = null;

function getMCSocket() {
  if (!mcSocket) {
    mcSocket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    });
  }
  return mcSocket;
}

export const useMCStore = create((set, get) => ({
  // Connection state
  mcStatus: 'IDLE',  // 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'
  mcSocket: null,
  mcPlayerId: localStorage.getItem('mc_userId') || `u_${Math.floor(Math.random() * 1000000)}`,
  mcRoomId: localStorage.getItem('mc_roomId') || '',
  mcError: null,

  // Game state from server
  mcGameState: null,

  // UI state
  mcScreen: 'LANDING', // 'LANDING' | 'MC_ENTRY' | 'MC_JOIN'
  mcSelectedCard: null,
  mcHostTransferredName: null,

  setMCScreen: (screen) => set({ mcScreen: screen }),

  // ── Connect to a MendiCoat room ──────────────────────────────────────────
  connectMC: (roomId, playerName, avatar, userId) => {
    const s = getMCSocket();
    const pName = playerName || get().mcPlayerName || '';
    const av    = avatar    || get().mcAvatar     || 'P';
    const uId   = userId || get().mcPlayerId;
    
    if (userId) set({ mcPlayerId: userId });
    if (uId) localStorage.setItem('mc_userId', uId);

    s.off('mc_game_state');
    s.off('mc_error');
    s.off('mc_room_info');
    s.off('mc_kicked');
    s.off('mc_host_transferred');
    s.off('chat_broadcast');
    s.off('disconnect');
    s.off('reconnect');
    s.off('connect');
    s.off('room_closed');

    set({ mcStatus: 'CONNECTING', mcRoomId: roomId, mcError: null, mcSocket: s });

    s.on('connect', () => {
      set({ mcStatus: 'CONNECTED', mcError: null });
      if (roomId) localStorage.setItem('mc_roomId', roomId);
      s.emit('mc_join_room', { roomId, playerName: pName, avatar: av, userId: uId });
    });

    s.on('mc_game_state', (state) => {
      if (state.roomId) localStorage.setItem('mc_roomId', state.roomId);
      set({
        mcGameState: state,
        mcRoomId: state.roomId || get().mcRoomId,
        mcError: null,
        mcStatus: 'CONNECTED',
      });
    });

    s.on('mc_room_info', ({ roomId: assignedRoomId, game }) => {
      if (!assignedRoomId) return;
      localStorage.setItem('mc_roomId', assignedRoomId);
      const params = new URLSearchParams(window.location.search);
      params.set('room', assignedRoomId);
      if (game) params.set('game', game);
      window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
      set({ mcRoomId: assignedRoomId, mcStatus: 'CONNECTED', mcError: null });
    });

    s.on('mc_kicked', () => {
      s.disconnect();
      set({ mcStatus: 'ERROR', mcError: 'You were removed from the table by the host.', mcGameState: null });
    });

    s.on('mc_error', ({ message }) => {
      set(st => ({
        mcError: message,
        mcStatus: st.mcGameState ? st.mcStatus : 'ERROR',
      }));
    });

    s.on('mc_host_transferred', ({ newHostId, newHostName }) => {
      set({ mcHostTransferredName: newHostName, mcHostTransferredId: newHostId });
    });

    // Shared chat_broadcast
    s.on('chat_broadcast', ({ senderId, senderName, message, ts }) => {
      const msgId = `${senderId}-${ts}`;
      const newMsg = { id: msgId, senderId, senderName, message, ts };
      set(st => ({ mcChatMessages: [...(st.mcChatMessages || []), newMsg] }));
      setTimeout(() => {
        set(st => ({ mcChatMessages: (st.mcChatMessages || []).filter(m => m.id !== msgId) }));
      }, 5500);
    });

    s.on('room_closed', ({ message }) => {
      s.disconnect();
      localStorage.removeItem('mc_roomId');
      set({ 
        mcStatus: 'ERROR', 
        mcError: message || 'This room was terminated by an administrator.', 
        mcGameState: null,
        mcRoomId: ''
      });
    });

    s.on('disconnect', () => set({ mcStatus: 'RECONNECTING' }));

    s.on('reconnect', () => {
      set({ mcStatus: 'CONNECTED', mcError: null });
      const { mcRoomId: rId, mcPlayerId: pId } = get();
      s.emit('mc_join_room', { roomId: rId, playerName: pName, avatar: av, userId: pId });
    });

    if (!s.connected) {
      s.connect();
    } else {
      set({ mcStatus: 'CONNECTED' });
      s.emit('mc_join_room', { roomId, playerName: pName, avatar: av, userId: uId });
    }
  },

  // ── Game Actions ─────────────────────────────────────────────────────────
  mcStartGame: () => {
    const { mcSocket: s, mcRoomId } = get();
    s?.emit('mc_start_game', { roomId: mcRoomId });
  },

  mcReshuffle: () => {
    const { mcSocket: s, mcRoomId } = get();
    s?.emit('mc_reshuffle', { roomId: mcRoomId });
  },

  mcSelectTrump: (suit) => {
    const { mcSocket: s, mcRoomId } = get();
    s?.emit('mc_select_trump', { roomId: mcRoomId, suit });
  },

  mcPlayCard: (card) => {
    const { mcSocket: s, mcRoomId } = get();
    s?.emit('mc_play_card', { roomId: mcRoomId, card });
    set({ mcSelectedCard: null });
  },

  mcSetSelectedCard: (card) => set({ mcSelectedCard: card }),

  mcKickPlayer: (targetId) => {
    const { mcSocket: s, mcRoomId } = get();
    s?.emit('mc_kick_player', { roomId: mcRoomId, targetId });
  },

  mcReorderPlayers: (orderedIds) => {
    const { mcSocket: s, mcRoomId } = get();
    s?.emit('mc_reorder_players', { roomId: mcRoomId, orderedIds });
  },

  // Chat messages
  mcChatMessages: [],

  mcAddBot: (difficulty) => {
    const { mcSocket: s, mcRoomId } = get();
    s?.emit('mc_add_bot', { roomId: mcRoomId, difficulty });
  },

  mcCloseGame: () => {
    const { mcSocket: s, mcRoomId } = get();
    s?.emit('mc_close_game', { roomId: mcRoomId });
  },

  mcRestartGame: () => {
    const { mcSocket: s, mcRoomId } = get();
    s?.emit('mc_restart_game', { roomId: mcRoomId });
  },

  mcSendChat: (message) => {
    const { mcSocket: s, mcRoomId } = get();
    if (!message?.trim()) return;
    s?.emit('chat_message', { roomId: mcRoomId, message: message.trim() });
  },

  mcDisconnect: () => {
    localStorage.removeItem('mc_roomId');
    const s = getMCSocket();
    s?.disconnect();
    set({ mcStatus: 'IDLE', mcGameState: null, mcRoomId: '', mcSelectedCard: null });
  },
}));
