# YouTube Video Downloader — YT_EXTRACT v2.0

A modern YouTube video downloader built with Next.js 16, featuring real-time download progress via SSE and automatic best-quality MP4 output.

## ✨ Features

- 🎯 **Smart Quality Selection** — downloads best available video + audio, merged into MP4
- 📊 **Real-time Progress** — live speed, ETA, and phase tracking via Server-Sent Events
- 🖥️ **Cross-platform** — works on macOS (Intel + Apple Silicon), Windows, and Linux
- 🔧 **Zero ffmpeg config** — bundled automatically via `@ffmpeg-installer/ffmpeg`
- 🧪 **Fully Tested** — 114 unit tests, all passing
- 🎨 **Cyberpunk UI** — Framer Motion animations, dark/light theme
- 🔒 **Type-Safe** — TypeScript throughout

---

## 🖥️ OS Requirements

Only **yt-dlp** needs a one-time manual install. Everything else (including `ffmpeg`) is handled automatically by npm.

| Dependency | macOS | Windows | Ubuntu/Linux |
|---|---|---|---|
| `yt-dlp` | Manual (see below) | Manual (see below) | Manual (see below) |
| `ffmpeg` | ✅ Auto-bundled | ✅ Auto-bundled | ✅ Auto-bundled |
| Downloads folder | `~/Downloads` | `C:\Users\...\Downloads` | `~/Downloads` |

---

## 🚀 Setup

### Step 1 — Install yt-dlp (one-time per machine)

**macOS**
```bash
brew install yt-dlp
```

**Ubuntu / Linux**
```bash
sudo apt install yt-dlp
# or, to always get the latest version:
pip install yt-dlp
```

**Windows**
```powershell
winget install yt-dlp
# or download the .exe from: https://github.com/yt-dlp/yt-dlp/releases
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Configure environment (optional)

If `yt-dlp` is in your PATH (true for most installs), **you can skip this step entirely.**

If it's not in PATH, copy the example env file and set the path:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```env
# Point to your yt-dlp binary if it's not in PATH
YT_DLP_PATH=/opt/homebrew/bin/yt-dlp
```

See [`.env.example`](.env.example) for all options and per-OS path examples.

### Step 4 — Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Environment Variables

All variables are **optional**. The app works out of the box if `yt-dlp` is in your PATH.

| Variable | Default | Description |
|---|---|---|
| `YT_DLP_PATH` | `yt-dlp` | Path to the yt-dlp executable. Only set if yt-dlp is not in your PATH. |
| `FFMPEG_PATH` | bundled binary | Path to ffmpeg. Defaults to the bundled `@ffmpeg-installer/ffmpeg` binary — no manual install needed. |

### Common path values by OS

**macOS — Homebrew (Apple Silicon / M1–M4)**
```env
YT_DLP_PATH=/opt/homebrew/bin/yt-dlp
```

**macOS — Homebrew (Intel)**
```env
YT_DLP_PATH=/usr/local/bin/yt-dlp
```

**Linux**
```env
YT_DLP_PATH=/usr/bin/yt-dlp
```

**Windows**
```env
YT_DLP_PATH=C:\Users\YourName\AppData\Local\Microsoft\WinGet\Links\yt-dlp.exe
```

> **Tip:** Run `which yt-dlp` (macOS/Linux) or `where yt-dlp` (Windows) to find the exact path.

---

## 📖 Usage

1. Paste a YouTube URL into the input
2. Click **INITIALIZE** — fetches video metadata
3. Review title, duration, quality, and view count
4. Click **EXECUTE_DOWNLOAD** — starts the download with live progress
5. When complete, the browser saves the `.mp4` file to your Downloads folder

---

## 🧪 Testing

```bash
npm run test:run      # Run all tests once
npm test              # Watch mode
npm run test:coverage # Coverage report
```

**Results:** ✅ 114 tests passing across 7 test files

---

## 🏗️ Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16 + React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + Framer Motion |
| Downloader | yt-dlp (external) |
| Muxer | ffmpeg (via `@ffmpeg-installer/ffmpeg`) |
| Progress | Server-Sent Events (SSE) |
| Testing | Vitest + React Testing Library |

---

## 🔌 API Routes

| Route | Method | Description |
|---|---|---|
| `/api/video-info` | POST | Fetch video metadata (title, thumbnail, quality) |
| `/api/download-progress` | POST | SSE stream with real-time download progress |
| `/api/download-file` | GET | Serve the completed file to the browser |
| `/api/download` | POST | Legacy: single-request download (no progress) |

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
