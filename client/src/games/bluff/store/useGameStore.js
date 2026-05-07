import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';
const API_BASE = import.meta.env.VITE_SOCKET_URL || ''; // Assuming server handles both

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
  status: 'IDLE',
  socket: null,
  playerId: null,

  // Player identity
  playerName: localStorage.getItem('hub_name') || '',
  avatar: localStorage.getItem('hub_avatar') || 'S',
  roomId: localStorage.getItem('bluff_roomId') || '',

  // Auth & Profile state
  user: null,
  clerkToken: null,
  profile: null,
  isAuthLoading: true,

  // --- Auth Actions ---
  setAuth: async (clerkUser, getToken) => {
    try {
      const token = await getToken();
      set({ user: clerkUser, clerkToken: token, isAuthLoading: false });
      
      if (clerkUser) {
        await get().fetchProfile();
      }
    } catch (err) {
      console.error('Error setting auth:', err);
      set({ isAuthLoading: false });
    }
  },

  clearAuth: () => {
    set({ user: null, clerkToken: null, profile: null, isAuthLoading: false });
  },

  fetchProfile: async () => {
    const { clerkToken } = get();
    if (!clerkToken) return;

    try {
      const response = await fetch(`${API_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${clerkToken}` },
      });

      if (response.status === 404) {
        // Profile doesn't exist, create it
        const { playerName, avatar, user } = get();
        const createRes = await fetch(`${API_BASE}/api/profile`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${clerkToken}` 
          },
          body: JSON.stringify({
            username: playerName || user?.username || user?.firstName || 'Player',
            avatar_url: avatar,
            full_name: user?.fullName || '',
          }),
        });
        
        if (createRes.ok) {
          const newProfile = await createRes.json();
          set({ 
            profile: newProfile,
            avatar: newProfile.avatar_url || get().avatar,
            playerName: newProfile.username || get().playerName,
          });
        }
      } else if (response.ok) {
        const data = await response.json();
        set({ 
          profile: data,
          playerName: data.username || get().playerName,
          avatar: data.avatar_url || get().avatar,
        });
        localStorage.setItem('hub_name', data.username || get().playerName);
        localStorage.setItem('hub_avatar', data.avatar_url || get().avatar);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  },

  updateProfile: async (updates) => {
    const { clerkToken } = get();
    if (!clerkToken) return { error: 'Not authenticated' };

    try {
      const response = await fetch(`${API_BASE}/api/profile`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clerkToken}` 
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        set({ 
          profile: data,
          playerName: data.username || get().playerName,
          avatar: data.avatar_url || get().avatar,
        });
        localStorage.setItem('hub_name', data.username || get().playerName);
        localStorage.setItem('hub_avatar', data.avatar_url || get().avatar);
        return { data, error: null };
      }
      return { data: null, error: 'Failed to update profile' };
    } catch (err) {
      console.error('Error updating profile:', err);
      return { data: null, error: err };
    }
  },

  // Game state from server
  gameState: null,
  error: null,

  // UI state
  screen: 'LANDING',
  selectedCards: [],
  isDealing: false,
  chatMessages: [],
  hostTransferredName: null,
  hostTransferredId: null,

  // --- Identity ---
  setIdentity: async (name, av) => {
    localStorage.setItem('hub_name', name);
    localStorage.setItem('hub_avatar', av);
    set({ playerName: name, avatar: av });

    const { user } = get();
    if (user) {
      await get().updateProfile({ username: name, avatar_url: av });
    }
  },

  setScreen: (screen) => set({ screen }),

  // --- Connect to a room ---
  connect: (roomId) => {
    const { playerName, avatar } = get();
    const s = getSocket();

    s.off('connect');
    s.off('game_state');
    s.off('error');
    s.off('bluff_result');
    s.off('kicked');
    s.off('disconnect');
    s.off('reconnect');
    s.off('host_transferred');
    s.off('chat_broadcast');
    s.off('room_info');

    set({ status: 'CONNECTING', roomId, error: null, socket: s });

    s.on('connect', () => {
      set({ playerId: s.id, status: 'CONNECTED', error: null });
      if (roomId) {
        localStorage.setItem('bluff_roomId', roomId);
      }
      localStorage.setItem('hub_name', playerName);
      s.emit('join_room', { roomId, playerName, avatar: get().avatar });
    });

    s.on('game_state', (state) => {
      const isDealing = state.state === 'DEALING';
      if (state.roomId) {
        localStorage.setItem('bluff_roomId', state.roomId);
      }
      set({ gameState: state, roomId: state.roomId || get().roomId, error: null, isDealing, status: 'CONNECTED' });
    });

    s.on('room_info', ({ roomId: assignedRoomId, game }) => {
      if (!assignedRoomId) return;
      localStorage.setItem('bluff_roomId', assignedRoomId);
      const params = new URLSearchParams(window.location.search);
      params.set('room', assignedRoomId);
      if (game) params.set('game', game);
      const nextUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ path: nextUrl }, '', nextUrl);
      set({ roomId: assignedRoomId, status: 'CONNECTED', error: null });
    });

    s.on('kicked', () => {
      s.disconnect();
      set({ status: 'ERROR', error: 'You have been removed from the room by the host.', gameState: null });
    });

    s.on('error', ({ message }) => {
      set((state) => ({
        error: message,
        status: state.gameState ? state.status : 'ERROR',
        gameState: state.gameState || null,
      }));
    });

    s.on('room_closed', () => {
      localStorage.removeItem('bluff_roomId');
      set({ status: 'IDLE', gameState: null, roomId: '', screen: 'LANDING' });
    });

    s.on('host_transferred', ({ newHostId, newHostName }) => {
      set({ hostTransferredName: newHostName, hostTransferredId: newHostId });
    });

    s.on('chat_broadcast', ({ senderId, senderName, message, ts }) => {
      const msgId = `${senderId}-${ts}`;
      const newMsg = { id: msgId, senderId, senderName, message, ts };
      set((state) => ({ chatMessages: [...state.chatMessages, newMsg] }));
      setTimeout(() => {
        set((state) => ({ chatMessages: state.chatMessages.filter(m => m.id !== msgId) }));
      }, 5500);
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

  selectBluffCard: (idx) => {
    const { socket: s, roomId } = get();
    s?.emit('select_bluff_card', { roomId, idx });
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

  reorderPlayers: (orderedIds) => {
    const { socket: s, roomId } = get();
    s?.emit('reorder_players', { roomId, orderedIds });
  },

  sendChat: (message) => {
    const { socket: s, roomId } = get();
    if (!message?.trim()) return;
    s?.emit('chat_message', { roomId, message: message.trim() });
  },

  restartGame: () => {
    const { socket: s, roomId } = get();
    s?.emit('restart_game', { roomId });
  },

  closeGame: () => {
    const { socket: s, roomId } = get();
    s?.emit('close_game', { roomId });
  },

  clearSelection: () => set({ selectedCards: [] }),

  disconnect: () => {
    localStorage.removeItem('bluff_roomId');
    const s = getSocket();
    s?.disconnect();
    set({ status: 'IDLE', gameState: null, playerId: null, roomId: '', selectedCards: [] });
  },
}));

// Reconnect logic on load
const store = useGameStore.getState();
const initialRoom = localStorage.getItem('bluff_roomId');
if (initialRoom) {
  store.connect(initialRoom);
}
