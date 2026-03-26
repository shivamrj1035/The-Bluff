# Deployment Guide: The Bluff

This guide explains how to deploy "The Bluff" for **free** and with **smooth** performance using modern cloud platforms.

## 1. Prerequisites
- A GitHub repository with your current code.
- Accounts on: [Vercel](https://vercel.com), [Render](https://render.com), and [Upstash](https://upstash.com).

---

## 2. Redis Setup (Database)
We use **Upstash** for a high-performance, serverless Redis instance.
1. Go to [Upstash Console](https://console.upstash.com/).
2. Create a new **Redis** Database.
3. Once created, find the **REDIS_URL** in the "Connect" section (looks like `redis://default:password@host:port`).
4. **Copy this URL** for the next step.

---

## 3. Backend Deployment (Server)
We recommend **Railway** or **Fly.io** for a high-speed, "no-sleep" experience.

### Option A: Railway (Fastest Setup)
1. Go to [Railway.app](https://railway.app/) and create a new project.
2. Connect your GitHub repository.
3. Railway will auto-detect the Node.js project.
4. **Environment Variables**:
   - `PORT`: `4000`
   - `REDIS_URL`: Paste your Upstash URL here.
   - `NODE_ENV`: `production`
5. **Why Railway?**: No "sleep" time. Your server is always ready.

### Option B: Fly.io (Professional Performance)
1. Install the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/).
2. Run `fly launch` in the `server` folder.
3. Set your `REDIS_URL` using `fly secrets set REDIS_URL=...`.

---

## 4. Frontend Deployment (Client)
We use **Vercel** for the fastest global delivery of the Vite/React app.
1. Connect your GitHub repo to Vercel and import the project.
2. Select the `client` folder as the root.
3. **Framework Preset**: `Vite`.
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. **Environment Variables**:
   - `VITE_SOCKET_URL`: Paste the URL of your **Render** Web Service here (e.g., `https://the-bluff-server.onrender.com`).

---

## 5. PWA Checklist
Your app is already configured for PWA. Once deployed:
- Visit your Vercel URL on mobile.
- Use "Add to Home Screen" (iOS Safari) or the "Install" prompt (Android Chrome).
- The new ornate "B" logo will appear as the app icon.

---

> [!TIP]
> **No Sleep**: By using Railway or Fly.io, your backend stays active. Players will feel an instant connection with zero lag on joining.

> [!IMPORTANT]
> **VITE_SOCKET_URL**: Ensure your `VITE_SOCKET_URL` (in Vercel context) exactly matches your Railway/Fly URL (e.g., `https://the-bluff-server-production.up.railway.app`) without a trailing slash.
