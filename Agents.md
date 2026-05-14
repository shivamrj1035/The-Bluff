# Repository Guidelines

## Project Structure & Module Organization

This repository is split into two npm projects:

- `client/`: React + Vite frontend. Main entry points are `src/main.jsx` and `src/App.jsx`.
- `client/src/pages/`: top-level screens such as `LandingPage.jsx`, `ExploreGamesPage.jsx`, and `ProfilePage.jsx`.
- `client/src/games/bluff/`: Bluff game UI, pages, components, and Zustand store.
- `client/src/components/common/`: shared UI pieces such as auth, avatars, toasts, and icons.
- `client/public/`: static images, PWA files, and game thumbnails.
- `server/`: Express, Socket.IO, Neon, Clerk, and Redis backend.
- `server/logic/`: game rules, state reducer, deck, and validation.
- `server/socket/`: Socket.IO handlers and state sync.
- `server/tests/`: current simulation scripts.

## Build, Test, and Development Commands

Run commands from the relevant workspace.

```bash
cd client && npm run dev
```
Starts the Vite dev server on port `3000`.

```bash
cd client && npm run build
```
Builds the production frontend and PWA assets.

```bash
cd client && npm run lint
```
Runs ESLint over the frontend.

```bash
cd server && npm start
```
Runs the backend on `PORT` or `4000`.

```bash
cd server && node tests/simulateGame.js
```
Runs the existing game simulation script.

## Coding Style & Naming Conventions

Use JavaScript/JSX with 2-space indentation where possible. React components use `PascalCase` filenames, hooks/stores use `use...` naming, and utility modules use lower camel case. Prefer existing local patterns in `client/src/index.css`, Zustand store actions, and Socket.IO event handlers. Keep UI changes scoped and avoid unrelated formatting churn.

## Testing Guidelines

There is no full automated test suite yet. For frontend changes, run `npm run build` and `npm run lint` in `client`. For backend game logic changes, run `node tests/simulateGame.js` and at least `node --check index.js` from `server`. Add focused tests or simulation coverage when changing reducer, validator, or socket behavior.

## Commit & Pull Request Guidelines

Recent commits mostly use short messages, with several `feat:` prefixes. Prefer concise conventional-style subjects such as `feat: add clerk profile sync` or `fix: preserve bluff navigation after sign-in`. PRs should include a clear summary, changed areas, test commands run, linked issues when relevant, and screenshots for visible UI changes.

## Security & Configuration Tips

Do not commit real secrets. Use `client/.env.local` for `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL`, and `VITE_SOCKET_URL`. Use `server/.env` or `server/.env.local` for `DATABASE_URL`, `CLERK_SECRET_KEY`, and `REDIS_URL`.
