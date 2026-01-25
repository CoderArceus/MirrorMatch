# Seque PvP Deployment Guide

## Architecture

Seque uses a **hybrid deployment model**:

- **UI (Frontend)**: Deployed on **Vercel** as a static SPA
- **PvP Server**: Deployed on **Railway** as a persistent WebSocket server

This separation is necessary because:
- Vercel serverless functions cannot maintain long-lived WebSocket connections
- The PvP server requires persistent connections for real-time game state

---

## 1. Deploy PvP Server to Railway

### Prerequisites
- Railway account (https://railway.app)
- GitHub repository connected to Railway

### Steps

1. **Create New Project in Railway**
   - Go to Railway Dashboard → New Project → Deploy from GitHub repo
   - Select this repository

2. **Configure Service**
   - Set the **Root Directory** to `server`
   - Railway will auto-detect Node.js

3. **Environment Variables**
   - `PORT` - Railway sets this automatically
   - No other variables required

4. **Deploy**
   - Railway will build and deploy automatically
   - Note the generated URL (e.g., `seque-pvp-production.up.railway.app`)

5. **Verify**
   - Visit `https://your-railway-url.up.railway.app/health`
   - Should return: `{"status":"ok","server":"seque-pvp","connections":0}`

---

## 2. Deploy UI to Vercel

### Prerequisites
- Vercel account (https://vercel.com)
- GitHub repository connected to Vercel

### Steps

1. **Create New Project in Vercel**
   - Import from GitHub repository
   - Set **Root Directory** to `ui`
   - Framework Preset: Vite

2. **Environment Variables** (CRITICAL)
   - Add: `VITE_WS_URL` = `wss://your-railway-url.up.railway.app`
   - This tells the UI where to find the PvP server

3. **Deploy**
   - Vercel will build and deploy automatically

4. **Verify**
   - Open the Vercel URL
   - Click "Play PvP" → "Create Room"
   - Should connect successfully and show room code

---

## 3. Local Development

### Start PvP Server
```bash
cd server
npm install
npm start
# Server runs on http://localhost:8080
```

### Start UI Dev Server
```bash
cd ui
npm install
npm run dev
# UI runs on http://localhost:5173
```

The UI will automatically connect to `ws://localhost:8080` in development.

---

## 4. Environment Variables Reference

### UI (Vercel)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_WS_URL` | **Yes (production)** | WebSocket URL to PvP server (e.g., `wss://seque-pvp.up.railway.app`) |

### Server (Railway)
| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Auto-set | Railway automatically sets this |

---

## 5. Troubleshooting

### "Connection Failed" in UI
- Check that `VITE_WS_URL` is set correctly in Vercel
- Verify Railway server is running (`/health` endpoint)
- Check browser console for WebSocket errors

### Server not starting on Railway
- Check Railway logs for errors
- Ensure `server/package.json` has correct start script
- Verify Node.js version compatibility

### WebSocket connection refused
- Ensure using `wss://` (not `ws://`) for production
- Check Railway service is public (not private)

---

## 6. Architecture Diagram

```
┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │
│  Vercel (CDN)   │         │    Railway      │
│                 │         │                 │
│  ┌───────────┐  │         │  ┌───────────┐  │
│  │           │  │  WSS    │  │           │  │
│  │  Seque UI │◄─┼─────────┼─►│ PvP Server│  │
│  │  (React)  │  │         │  │ (Node.js) │  │
│  │           │  │         │  │           │  │
│  └───────────┘  │         │  └───────────┘  │
│                 │         │                 │
└─────────────────┘         └─────────────────┘
     Static SPA              WebSocket Server
```

---

## 7. Production Checklist

- [ ] Railway server deployed and healthy
- [ ] Vercel UI deployed with `VITE_WS_URL` set
- [ ] Can create room from production UI
- [ ] Can join room with code
- [ ] Full match plays to completion
- [ ] Reconnect works after refresh
