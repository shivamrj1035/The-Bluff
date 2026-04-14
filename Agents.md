# Agents.md — The Bluff: Development Log

> This file tracks all features, bugs, and architectural decisions for **The Bluff** multiplayer card game.
> Updated by AI agents and developers as work progresses. Most recent entries at the top.

---

## Project Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), Zustand, Framer Motion |
| Backend | Node.js, Express, Socket.IO |
| State Store | Redis (via ioredis) |
| Styling | Vanilla CSS (glassmorphism theme) |
| Protocol | WebSockets (Socket.IO rooms) |

---

## Session: 2026-04-14 — Private Table Management Overhaul

### Problems Reported
1. **"Waiting for Host" bug** — When the room creator joins their own table, they see "WAITING FOR HOST..." instead of the START SESSION button.
2. **No host transfer** — If the host disconnects, nobody becomes the new host; the room is stuck.
3. **No player order control** — The host has no way to control turn order; turns follow join order.

---

### Fix 1: "Waiting for Host" Race Condition

**File:** `client/src/pages/LobbyPage.jsx`

**Root Cause:**
```js
// OLD — broken
const isHost = gameState?.hostId === playerId; // playerId from Zustand store
```
`playerId` in the store is set from `socket.id` in the `on('connect')` handler. However, the server embeds `myId` directly into every serialized `game_state` payload (via `sync.js`). The store's `playerId` may not be committed to React state by the time the first `game_state` event is processed, causing `isHost` to evaluate to `false` on first render.

**Fix:**
```js
// NEW — correct
const myId = gameState?.myId;  // always in sync — embedded by server in every state
const isHost = gameState?.hostId === myId;
```

---

### Fix 2: Host Transfer on Disconnect

**Files:** `server/socket/handlers.js`, `server/logic/gameState.js`, `server/logic/constants.js`

**Root Cause:** The `disconnect` handler was completely empty. When a host disconnected, `room.hostId` pointed to a dead socket ID forever.

**Implementation:**
- Added `socketRoomMap: Map<socketId, roomId>` in handlers.js to track each socket's room.
- On `disconnect`: mark player as `isConnected: false`, then check if they were the host.
- If host left: call `pickNewHost()` → first connected player becomes host via `TRANSFER_HOST` reducer.
- If all players disconnected: delete the room from Redis entirely.
- New `HOST_TRANSFERRED` socket event emitted to all room members.
- Client (`useGameStore.js`) listens for `host_transferred` and shows a toast in `LobbyPage.jsx`.

**New Reducer Case: `TRANSFER_HOST`**
```js
case "TRANSFER_HOST": {
  const { newHostId } = payload;
  const isValidHost = state.players.find(p => p.id === newHostId && p.isConnected);
  if (!isValidHost) return state;
  return { ...state, hostId: newHostId };
}
```

---

### Feature 3: Host-Managed Player Turn Order

**Files:** `server/socket/handlers.js`, `server/logic/gameState.js`, `server/logic/constants.js`, `client/src/store/useGameStore.js`, `client/src/pages/LobbyPage.jsx`

**Description:**
Host can reorder players in the lobby using ▲/▼ buttons. The `players` array order determines turn order during the game (used by `getNextPlayerId`). The first player in the list goes first (or whoever holds the Ace of Spades, which still overrides on START_GAME).

**New Socket Event:** `reorder_players` (client → server)
```js
{ roomId: string, orderedIds: string[] }
```

**New Reducer Case: `REORDER_PLAYERS`**
```js
case "REORDER_PLAYERS": {
  if (state.state !== GAME_STATES.WAITING) return state;
  // Validates ids match exactly, then rebuilds players array in new order
}
```

**UI Changes in LobbyPage.jsx:**
- Turn order position number badge (1, 2, 3…) on each player row
- "GOES FIRST" label on first player
- ▲/▼ buttons (host only) to shift players up/down
- Hint text: "↕ SET TURN ORDER ABOVE, THEN START"
- Toast when host changes: "👑 You are now the host!" or "👑 [Name] is the new host"

---

## Architecture Notes

### Room State Flow
```
WAITING → DEALING → PLAYER_TURN ↔ BLUFF_PICKING → ROUND_RESOLUTION → PLAYER_TURN
                                                                     ↘ ENDED
```

### Turn Order Logic
- `getNextPlayerId(players, currentId, ranking)` in `gameState.js`
- Cycles through `players` array in order, skipping ranked/finished players
- **Host sets `players` array order in lobby** → this becomes the turn order

### Host Privileges (Lobby)
- Kick players
- Reorder players (turn order)
- Start session

### Host Privileges (In-Game)
- Close game (reset to lobby)

### Reconnection
- Players reconnect by rejoining with the same `playerName`
- Server updates `socket.id` references throughout room state
- `socketRoomMap` is updated accordingly

---

## Known Issues / TODOs
- [ ] In-game player order panel (show turn order sidebar in GameBoard)
- [ ] Spectator mode UI (currently just silently joins but gets no hand)
- [ ] Mobile: drag-to-reorder instead of up/down buttons
- [ ] Room password / private table access control
- [ ] Player avatar customization beyond initials
