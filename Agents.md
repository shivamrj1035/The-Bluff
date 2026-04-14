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

## Session: 2026-04-14 (Part 3) — Redis Free Tier Exhaustion Fix

### Problem
Upstash free tier hit: 574K commands / 500K limit.
- **Reads: 560K** — caused by the global timer calling `getRoom()` (a Redis GET) every 2 seconds
  per active room. With 5 rooms: 5 × 30/min × 60 × 24 = 216,000 reads/day.
- **Writes: 14K** — every socket action (play, pass, bluff, etc.) saved to Redis immediately.

### Fix: In-Memory Cache Layer with Periodic Redis Flush

**File:** `server/socket/handlers.js`

Architecture change:
```
Before: Every read/write → Redis (network round-trip, counts against limit)
After:  Every read/write → roomCache (in-memory JS Map, zero network)
        Dirty rooms flushed to Redis every 30 seconds (backup only)
        Redis read only on cold-start cache miss (once per room per process restart)
```

New functions replacing old `getRoom`/`saveRoom`:
| Function | Before | After |
|---|---|---|
| `getRoom(id)` | Redis GET every call | Check `roomCache` Map first; Redis only on miss |
| `saveRoom(id, room)` | Redis SET every call | Write to `roomCache`, add to `dirtyRooms` Set |
| `deleteRoom(id)` | (new) | Remove from cache + Redis |
| Timer loop | `async` with `await getRoom` per room | Synchronous `getRoomFromCache` — zero Redis |
| HTTP `/room/:id` | Redis GET | Cache lookup first |

**Redis flush interval:** 30 seconds (configurable via `FLUSH_INTERVAL_MS`)

### Estimated Redis Reduction
| Source | Before | After |
|---|---|---|
| Timer (5 rooms) | ~5 reads/2s = 216K reads/day | 0 reads |
| Socket actions | 2 cmds/action | 0 real-time, ~1 per 30s |
| Cold start | 1 read | 1 read (same) |
| **Total/month** | **~560K+** | **~1–5K** |

### Files Changed
- `server/socket/handlers.js` — cache layer, sync timer, flush interval
- `server/redisClient.js` — added `del` method
- `server/index.js` — HTTP endpoint uses `getRoomForHttp` (cache, no Redis)

---



### Problem
After deploying, users see the room lobby with 0/8 players — nobody appears, including the room creator.

### Root Cause 1: VITE_SOCKET_URL not set on Vercel
`useGameStore.js`:
```js
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';
```
On Vercel, `VITE_SOCKET_URL` is not set in Environment Variables → defaults to `/` → socket tries to connect to `the-bluff-by-shivam.vercel.app` (serverless, no persistent WS) → `join_room` never reaches the Node.js backend → no `game_state` event → players array stays empty.

Locally, Vite's dev proxy in `vite.config.js` forwards `/socket.io` → `localhost:4000`, so it works locally but not in production.

**Fix:** Set `VITE_SOCKET_URL=https://your-backend-url` in Vercel Environment Variables. Server must be hosted separately (Railway, Render, etc.).

### Root Cause 2: isHost false-positive when gameState is null
`LobbyPage.jsx` was computing:
```js
const isHost = gameState?.hostId === gameState?.myId;  // undefined===undefined = true!
```
Fixed to:
```js
const isHost = Boolean(gameState && myId && gameState.hostId === myId);
```
Also added a "JOINING ROOM..." spinner screen that shows when `gameState` is null, preventing the empty lobby ghost-state from appearing.

### Fix: Server must be restarted after code changes

---



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
