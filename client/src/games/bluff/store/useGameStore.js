import { create } from 'zustand';
import { io } from 'socket.io-client';
import { supabase } from '../../../lib/supabase';

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
  playerName: localStorage.getItem('bluff_name') || '',
  avatar: localStorage.getItem('bluff_avatar') || 'P',
  roomId: localStorage.getItem('bluff_roomId') || '',

  // Auth & Profile state
  user: null,
  session: null,
  profile: null,
  isAuthLoading: true,

  // --- Auth Actions ---
  initAuth: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, isAuthLoading: false });
    
    if (session?.user) {
      get().fetchProfile(session.user.id);
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        get().fetchProfile(session.user.id);
      } else {
        set({ profile: null });
      }
    });
  },

  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const { playerName, avatar } = get();
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([{ 
            id: userId, 
            username: playerName || `Player_${userId.slice(0, 5)}`,
            avatar_url: avatar 
          }])
          .select()
          .single();
        
        if (!createError) set({ profile: newProfile });
      } else if (!error) {
        set({ 
          profile: data,
          playerName: data.username || get().playerName,
          avatar: data.avatar_url || get().avatar
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  },

  updateProfile: async (updates) => {
    const { user, profile } = get();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (!error) {
      set({ 
        profile: data,
        playerName: data.username || get().playerName,
        avatar: data.avatar_url || get().avatar
      });
    }
    return { data, error };
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  },

  signup: async (email, password, username) => {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: { data: { username } }
    });
    return { data, error };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
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
    localStorage.setItem('bluff_name', name);
    localStorage.setItem('bluff_avatar', av);
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
      localStorage.setItem('bluff_name', playerName);
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

// Auto-init auth and reconnect on load
const store = useGameStore.getState();
store.initAuth();

const initialRoom = localStorage.getItem('bluff_roomId');
if (initialRoom) {
  store.connect(initialRoom);
}
