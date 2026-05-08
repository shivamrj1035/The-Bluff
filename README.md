# The Bluff - Multiplayer Card Game

A real-time multiplayer implementation of the classic card game "The Bluff" (also known as Cheat), crafted with modern web technologies for a smooth, premium experience.

## Features
- **Authoritative Backend**: Node.js and Socket.IO server ensuring game integrity.
- **State Scaling**: Integrates with Redis to maintain game and room states seamlessly across instances.
- **Premium Frontend**: React + Vite application with Clerk authentication and a compact card-game interface.
- **Progressive Web App (PWA)**: Installable on varying devices with offline caching via service workers.
- **Real-time Sync**: Flawless syncing of card play, bluff calls, and turn-based logic through Socket.IO.
- **Persistent Profiles**: Neon-backed profile storage for signed-in players.

## System Requirements
- Node.js (v18+)
- Local Redis Instance (v6+) running on `localhost:6379` (Required for game state)

## Getting Started

### 1. Backend Setup

```bash
cd server
npm install
npm start
```
*Note: Set `DATABASE_URL`, `CLERK_SECRET_KEY`, and `REDIS_URL` in `server/.env.local` or `server/.env`.*

### 2. Frontend Setup

```bash
cd client
npm install
npm run dev
```
*Note: Set `VITE_CLERK_PUBLISHABLE_KEY` in `client/.env.local` or `client/.env`.*

### 3. PWA Build (Optional)
To test the progressive web app features fully, build and preview the client:

```bash
cd client
npm run build
npm run preview
```

## How to Play
1. Join a room by entering a Room ID and Player Name.
2. The game starts when all players agree.
3. On your turn, select up to 4 cards and declare their rank.
4. Other players can choose to call "Bluff!".
5. If the last play was a bluff, the caller wins, and the bluffer takes the pile. If not, the caller takes the pile!
6. First player to empty their hand wins.

---
*Developed with a focus on Great UI, Perfect Backend state-machines, and Real look & feel UI.*
