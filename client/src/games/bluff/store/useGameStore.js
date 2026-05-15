import { create } from 'zustand';
import { io } from 'socket.io-client';
import { syncProfile, getProfile } from '../../../lib/profileApi';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

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
  playerName: localStorage.getItem('hub_name') || '',
  avatar: localStorage.getItem('hub_avatar') || 'S',
  roomId: localStorage.getItem('bluff_roomId') || '',

  // Auth & Profile state
  user: null,
  session: null,
  profile: null,
  isAuthLoading: true,
  authTokenGetter: null,
  authSignOut: null,
  siteSettings: null,

  // --- Auth Actions ---
  setAuthLoading: (isAuthLoading) => set({ isAuthLoading }),

  setAuthState: ({ user, session, getToken, signOut }) => {
    set({
      user,
      session,
      authTokenGetter: getToken || null,
      authSignOut: signOut || null,
      isAuthLoading: false,
    });
  },

  clearAuthState: () => {
    set({
      user: null,
      session: null,
      profile: null,
      authTokenGetter: null,
      authSignOut: null,
      isAuthLoading: false,
    });
  },

  getAuthToken: async () => {
    const { authTokenGetter } = get();
    if (!authTokenGetter) return null;

    try {
      return await authTokenGetter();
    } catch (err) {
      console.error('Error getting Clerk token:', err);
      return null;
    }
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return null;

    try {
      const token = await get().getAuthToken();
      // Use GET (read-only) so we never overwrite the saved avatar_url with a stale default
      const data = await getProfile(token);

      if (data) {
        set({
          profile: data,
          playerName: data.username || get().playerName,
          avatar: data.avatar_url || get().avatar,
        });
        localStorage.setItem('hub_name', data.username || get().playerName);
        localStorage.setItem('hub_avatar', data.avatar_url || get().avatar);
      }

      return { data, error: null };
    } catch (err) {
      console.error('Error fetching profile:', err);
      return { data: null, error: err };
    }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return { data: null, error: new Error('Not authenticated') };

    try {
      const token = await get().getAuthToken();
      const data = await syncProfile(token, {
        username: updates.username ?? get().playerName,
        avatar_url: updates.avatar_url ?? get().avatar,
      });

      if (data) {
        set({
          profile: data,
          playerName: data.username || get().playerName,
          avatar: data.avatar_url || get().avatar,
        });
        localStorage.setItem('hub_name', data.username || get().playerName);
        localStorage.setItem('hub_avatar', data.avatar_url || get().avatar);
      }

      return { data, error: null };
    } catch (err) {
      console.error('Error updating profile:', err);
      return { data: null, error: err };
    }
  },

  signOut: async () => {
    const { authSignOut } = get();
    if (authSignOut) {
      await authSignOut();
    }
    set({
      user: null,
      session: null,
      profile: null,
      authTokenGetter: null,
      authSignOut: null,
      isAuthLoading: false,
    });
  },

  fetchSettings: async () => {
    try {
      const resp = await fetch(`${SOCKET_URL.replace(/\/$/, '')}/api/settings`);
      const data = await resp.json();
      if (data) {
        set({ siteSettings: data });
        // Apply theme variables to CSS
        if (data.theme) {
          const root = document.documentElement;
          if (data.theme.primary) {
            root.style.setProperty('--primary', data.theme.primary);
            root.style.setProperty('--primary-light', data.theme.primary + 'cc');
            root.style.setProperty('--secondary', data.theme.primary + 'dd');
            root.style.setProperty('--border-bright', data.theme.primary + '33');
            root.style.setProperty('--shadow-p', data.theme.primary + '4d');
            // Also update alias variables used across the site
            root.style.setProperty('--accent-purple', data.theme.primary);
            root.style.setProperty('--accent-glow', data.theme.primary + '4d');
          }
          if (data.theme.bg) root.style.setProperty('--bg', data.theme.bg);
        }
      }
      return data;
    } catch (err) {
      console.error('Failed to fetch site settings:', err);
    }
  },

  updateSettings: async (newSettings) => {
    const { getAuthToken } = get();
    const token = await getAuthToken();
    try {
      const resp = await fetch(`${SOCKET_URL.replace(/\/$/, '')}/api/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSettings)
      });
      const data = await resp.json();
      if (data.success) {
        set({ siteSettings: newSettings });
        // Re-apply theme
        if (newSettings.theme) {
          const root = document.documentElement;
          if (newSettings.theme.primary) {
            root.style.setProperty('--primary', newSettings.theme.primary);
            root.style.setProperty('--primary-light', newSettings.theme.primary + 'cc');
            root.style.setProperty('--secondary', newSettings.theme.primary + 'dd');
            root.style.setProperty('--border-bright', newSettings.theme.primary + '33');
            root.style.setProperty('--shadow-p', newSettings.theme.primary + '4d');
            // Also update alias variables used across the site
            root.style.setProperty('--accent-purple', newSettings.theme.primary);
            root.style.setProperty('--accent-glow', newSettings.theme.primary + '4d');
          }
          if (newSettings.theme.bg) root.style.setProperty('--bg', newSettings.theme.bg);
        }
      }
      return data;
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  },

  isAdmin: () => {
    const { user } = get();
    if (!user) return false;
    const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
    return adminEmails.includes(user.email?.toLowerCase());
  },

  // Game state from server
  gameState: null,
  error: null,

  // UI state
  screen: 'LANDING', // 'LANDING' | 'EXPLORE' | 'BLUFF_ENTRY' | 'JOIN'
  selectedCards: [],
  isDealing: false,
  chatMessages: [],      // { id, senderId, senderName, message, ts }
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

    // Clean up old listeners
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
      s.emit('join_room', { 
        roomId, 
        playerName, 
        avatar: get().avatar,
        userId: get().user?.id 
      });
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
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
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
      // Auto-remove after 5.5 seconds
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

  // closeGame: host resets the active game → everyone goes back to the lobby.
  // Does NOT disconnect — the server broadcasts WAITING state which shows the LobbyPage.
  // From the lobby, the host can START AGAIN or LEAVE TABLE.
  closeGame: () => {
    const { socket: s, roomId } = get();
    s?.emit('close_game', { roomId });
    // Do NOT set status to IDLE here — let the server's game_state broadcast handle routing.
  },

  clearSelection: () => set({ selectedCards: [] }),

  disconnect: () => {
    localStorage.removeItem('bluff_roomId');
    const s = getSocket();
    s?.disconnect();
    set({ status: 'IDLE', gameState: null, playerId: null, roomId: '', selectedCards: [] });
  },
}));

// Reconnect on load if a room was stored previously.
const store = useGameStore.getState();
const initialRoom = localStorage.getItem('bluff_roomId');
if (initialRoom) {
  store.connect(initialRoom);
}
