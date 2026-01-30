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

---

**YT_EXTRACT_SYSTEM © 2026**
