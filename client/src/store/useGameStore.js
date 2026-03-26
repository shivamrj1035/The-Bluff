import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

// Connection status types
// IDLE | CONNECTING | CONNECTED | RECONNECTING | ERROR
let socket = null;

function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    });
  }
  return socket;
}

export const useGameStore = create((set, get) => ({
  // Connection state
  status: 'IDLE',   // 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR'
  socket: null,
  playerId: null,

  // Player identity
  playerName: localStorage.getItem('bluff_name') || '',
  avatar: localStorage.getItem('bluff_avatar') || 'P',
  roomId: localStorage.getItem('bluff_roomId') || '',

  // Game state from server
  gameState: null,
  bluffToast: null,   // last bluff result for toast
  error: null,

  // UI state
  selectedCards: [],
  isDealing: false,

  // --- Identity ---
  setIdentity: (name, av) => {
    localStorage.setItem('bluff_name', name);
    localStorage.setItem('bluff_avatar', av);
    set({ playerName: name, avatar: av });
  },

  // --- Connect to a room ---
  connect: (roomId) => {
    const { playerName, avatar } = get();
    const s = getSocket();

    // Clean up old listeners
    s.off('connect');
    s.off('game_state');
    s.off('error');
    s.off('bluff_result');
    s.off('kicked');
    s.off('disconnect');
    s.off('reconnect');

    set({ status: 'CONNECTING', roomId, error: null, socket: s });

    s.on('connect', () => {
      set({ playerId: s.id, status: 'CONNECTED', error: null });
      localStorage.setItem('bluff_roomId', roomId);
      localStorage.setItem('bluff_name', playerName);
      s.emit('join_room', { roomId, playerName, avatar: get().avatar });
    });

    s.on('game_state', (state) => {
      const isDealing = state.state === 'DEALING';
      set({ gameState: state, error: null, isDealing });
    });

    s.on('bluff_result', (result) => {
      set({ bluffToast: result });
      setTimeout(() => set({ bluffToast: null }), 5000);
    });

    s.on('kicked', () => {
      s.disconnect();
      set({ status: 'ERROR', error: 'You have been removed from the room by the host.', gameState: null });
    });

    s.on('error', ({ message }) => {
      set({ error: message });
    });

    s.on('disconnect', () => {
      set({ status: 'RECONNECTING' });
    });

    s.on('reconnect', () => {
      set({ status: 'CONNECTED', error: null });
      const { roomId: rId, playerName: name, avatar: av } = get();
      s.emit('join_room', { roomId: rId, playerName: name, avatar: av });
    });

    if (!s.connected) {
      s.connect();
    } else {
      set({ playerId: s.id, status: 'CONNECTED' });
      s.emit('join_room', { roomId, playerName, avatar });
    }
  },

  // --- Game Actions ---
  startGame: () => {
    const { socket: s, roomId } = get();
    s?.emit('start_game', { roomId });
  },

  playCards: (declaredRank) => {
    const { socket: s, roomId, selectedCards } = get();
    if (!selectedCards.length) return;
    s?.emit('play_cards', { roomId, cardIds: selectedCards, declaredRank });
    set({ selectedCards: [] });
  },

  callBluff: () => {
    const { socket: s, roomId } = get();
    s?.emit('call_bluff', { roomId });
  },

  pickBluffCard: (cardIndex) => {
    const { socket: s, roomId } = get();
    s?.emit('pick_bluff_card', { roomId, cardIndex });
  },

  passTurn: () => {
    const { socket: s, roomId } = get();
    s?.emit('pass_turn', { roomId });
  },

  toggleCard: (cardId) => {
    const { selectedCards } = get();
    if (selectedCards.includes(cardId)) {
      set({ selectedCards: selectedCards.filter((id) => id !== cardId) });
    } else {
      set({ selectedCards: [...selectedCards, cardId] });
    }
  },

  kickPlayer: (targetId) => {
    const { socket: s, roomId } = get();
    s?.emit('kick_player', { roomId, targetId });
  },

  restartGame: () => {
    const { socket: s, roomId } = get();
    s?.emit('restart_game', { roomId });
  },

  closeGame: () => {
    const { socket: s, roomId } = get();
    s?.emit('close_game', { roomId });
    set({ status: 'IDLE', gameState: null, roomId: '' });
  },

  clearSelection: () => set({ selectedCards: [] }),

  disconnect: () => {
    localStorage.removeItem('bluff_roomId');
    const s = getSocket();
    s?.disconnect();
    set({ status: 'IDLE', gameState: null, playerId: null, roomId: '', selectedCards: [] });
  },
}));

// Auto-reconnect on load if roomId exists
const initialRoom = localStorage.getItem('bluff_roomId');
if (initialRoom) {
  useGameStore.getState().connect(initialRoom);
}
