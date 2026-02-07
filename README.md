# YouTube Video Downloader - YT_EXTRACT v2.0

A modern, high-performance YouTube video downloader built with Next.js 16, featuring an advanced cyberpunk-inspired UI and intelligent quality selection.

## ✨ Features

- 🎯 **Smart Quality Selection**: Automatically downloads in 1080p or 720p (or highest available)
- ⚡ **Fast & Efficient**: Built with Next.js 16 and Turbopack
- 🎨 **Unique Design**: Cyberpunk-inspired UI with Unbounded & JetBrains Mono fonts
- 📱 **Responsive**: Works on desktop and mobile
- 🧪 **Fully Tested**: 30 comprehensive unit tests (100% passing)
- 🎭 **Smooth Animations**: Framer Motion powered interactions
- 🔒 **Type-Safe**: Built with TypeScript

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 🎯 Quality Selection

**Priority Order:**
1. **1080p** (Full HD) - First choice
2. **720p** (HD) - Fallback  
3. **Highest Available** - Ultimate fallback

## 🧪 Testing

```bash
npm run test:run    # Run all tests
npm test            # Watch mode
npm run test:coverage
```

**Results:** ✅ 30/30 tests passing

See [TESTING.md](./TESTING.md) for details.

## 📖 Usage

1. Paste YouTube URL
2. Click "INITIALIZE"  
3. Review video info
4. Click "EXECUTE_DOWNLOAD"

## 🏗️ Tech Stack

- Next.js 16 + React 19
- TypeScript 5
- Tailwind CSS 4
- Framer Motion
- Vitest + React Testing Library
- @distube/ytdl-core

### BUG

But while deploying to vercel, the build got an error saying: Deploying outputs...
Error: Builder returned invalid maxDuration value for Serverless Function "api/download". Serverless Functions must have a maxDuration between 1 and 300 for plan hobby. : https://vercel.com/docs/concepts/limits/overview#serverless-function-execution-timeout

### TODO:

Important note: Deploying to Vercel won't work with yt-dlp because:

- Vercel's serverless functions don't have yt-dlp installed
- You can't install system binaries on Vercel

For Vercel deployment, you'd need to either:

- Use a Node.js library like @distube/ytdl-core (which had the cipher issues)
- Deploy to a VPS/container where you can install yt-dlp
- Use an external API service

#### OR Backend for frontend architecture where the backend handles yt-dlp and the frontend is deployed on Vercel.

### Architecture:

```
┌─────────────────────┐         ┌─────────────────────┐
│   Frontend (Vercel) │ ──────► │  Backend API Server │
│   Next.js UI only   │         │  (yt-dlp installed) │
└─────────────────────┘         └─────────────────────┘
                                         │
                                         ▼
                                    ┌─────────┐
                                    │ YouTube │
                                    └─────────┘
```

### How it works:
1. **Frontend (Vercel)**: Just serves the UI, proxies requests to backend
2. **Backend (Railway/Render/Fly.io/VPS)**: Runs yt-dlp, handles downloads, no time limits

### Benefits:
- ✅ No Vercel timeout limits on the backend
- ✅ yt-dlp can be installed on the backend server
- ✅ Frontend stays lightweight and deploys fast
- ✅ Backend can use longer timeouts (1+ hour videos)
- ✅ Can scale backend independently

### Backend options (free/cheap tiers available):
- **Railway** - Easy Docker deployment
- **Render** - Has background workers
- **Fly.io** - Good for long-running processes
- **DigitalOcean App Platform** - Reliable
- **Any VPS** - Full control

Possible Stack for Backend:
1. Create a separate Express/Fastify backend project for the download API
2. Update the frontend to call the external backend API

---

**YT_EXTRACT_SYSTEM © 2026**
