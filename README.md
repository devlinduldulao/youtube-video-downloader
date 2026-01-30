# YT_EXTRACT v2.0

A high-performance YouTube video downloader with a distinctive **Void Terminal** design system. Downloads videos in the highest available resolution directly to your system's Downloads folder.

## Features

- 🎯 **Direct Downloads** - MP4 files saved automatically to Downloads folder
- ⚡ **Highest Quality** - Automatically selects best available resolution
- 🎨 **Void Terminal UI** - Neo-industrial design with acid lime accents
- 🔒 **No Third-Party APIs** - Self-hosted backend server
- 💾 **Auto-Detection** - OS-aware (Windows/macOS/Linux) download paths

## Tech Stack

### Frontend

- React 19.2 with React Compiler
- TanStack Router for routing
- Framer Motion for animations
- TypeScript for type safety
- TailwindCSS 4.1 with custom design tokens
- Shadcn UI components
- Vite for fast development

### Backend

- Express server on port 3001
- @distube/ytdl-core for YouTube extraction
- CORS enabled for local development

### Design System

- **Fonts**: Unbounded (display), JetBrains Mono (body)
- **Colors**: Deep black (#050505) + Acid lime (#D4FF00)
- **Aesthetic**: Neo-industrial/Cyber-terminal

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd youtube-video-downloader
```

2. Install dependencies:

```bash
npm install
```

### Running the Application

**Option 1: Run both servers together (Recommended)**

```bash
npm run dev:all
```

**Option 2: Run servers separately**

Terminal 1 (Backend):

```bash
npm run server
```

Terminal 2 (Frontend):

```bash
npm run dev
```

### Access Points

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## How to Use

1. **Start both servers** using `npm run dev:all`
2. **Open the app** at http://localhost:5173
3. **Paste YouTube URL** into the terminal input
4. **Click INITIALIZE** - Scans and locks target metadata
5. **Click EXECUTE_DOWNLOAD** - Direct MP4 extraction begins
6. **File appears** in your Downloads folder automatically

## API Endpoints

### POST `/api/video-info`

Retrieves video metadata.

**Request:**

```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

**Response:**

```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Video Title",
  "author": "Channel Name",
  "lengthSeconds": "213",
  "viewCount": "1000000",
  "thumbnail": "https://...",
  "quality": "1080p"
}
```

### POST `/api/download`

Initiates direct download to Downloads folder.

**Request:**

```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

**Response:**

```json
{
  "message": "Download started",
  "filename": "Video Title.mp4",
  "path": "C:\\Users\\YourName\\Downloads\\Video Title.mp4",
  "quality": "1080p"
}
```

## Project Structure

```
youtube-video-downloader/
├── server/
│   └── download-server.js       # Express backend
├── src/
│   ├── components/
│   │   ├── download-page.tsx    # Main interface component
│   │   └── ui/                  # Shadcn components
│   ├── routes/
│   │   ├── index.tsx            # Landing page
│   │   ├── download.tsx         # Download route
│   │   └── __root.tsx           # Root layout
│   ├── index.css                # Design tokens & fonts
│   └── main.tsx                 # App entry
├── package.json
└── README.md
```

## Design Philosophy

**Void Terminal Aesthetic**

- High-contrast brutalism (black + lime)
- Technical terminology (protocols, extraction, targets)
- Monospace typography for system feel
- Grid overlays and corner markers
- Scanline hover effects

Following the frontend-design skill guidelines, avoiding generic AI aesthetics:

- ❌ No purple gradients on white
- ❌ No Inter/Roboto fonts
- ❌ No rounded bubbly components
- ✅ Distinctive Unbounded + JetBrains Mono
- ✅ Acid lime (#D4FF00) accent
- ✅ Sharp, industrial interfaces

## Development Scripts

- `npm run dev` - Start Vite frontend
- `npm run server` - Start Express backend
- `npm run dev:all` - Run both concurrently
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Troubleshooting

### Backend won't start

- Check port 3001 isn't in use
- Verify Node.js version (18+)
- Ensure dependencies installed: `npm install`

### Download fails

- YouTube URL must be valid and accessible
- Some videos may be region-restricted or private
- Check backend terminal for error logs

### UI doesn't load properly

- Clear browser cache
- Check Framer Motion is installed
- Verify Google Fonts loaded (Unbounded, JetBrains Mono)

## Performance Optimizations

Following Vercel React best practices:

- Direct imports from lucide-react (not barrel files)
- Framer Motion AnimatePresence for smooth transitions
- CSS-only effects (grid, blur, gradients)
- Optimized re-renders with proper state management

## License

MIT

## Acknowledgments

- Built with React 19 and Express
- Uses @distube/ytdl-core for YouTube extraction
- Design inspired by industrial/terminal aesthetics
- Follows Vercel's React performance best practices

## Features

- 🎥 **Video Info Preview** - Fetches video details using YouTube's oEmbed API
- ⚡ **Lightning Fast** - Pure client-side, no backend required
- 🌐 **Multiple Services** - Connects to Y2Mate, SaveFrom, and YTMP4
- 🎨 **Beautiful UI** - Distinctive, production-grade interface with smooth animations
- 🔒 **Privacy Focused** - No data stored or tracked, runs entirely in your browser
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile

## Tech Stack

- React 19.2 with React Compiler
- TanStack Router for routing
- TanStack Query for data fetching
- TypeScript for type safety
- TailwindCSS 4.1 for styling
- Shadcn UI components
- Vite for fast development

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd youtube-video-downloader
```

2. Install dependencies:

```bash
npm install
```

### Running the Application

Start the development server:

```bash
npm run dev
```

Access the app at: http://localhost:5173

## How to Use

1. Open the application in your browser
2. Click "Start Downloading" to go to the download page
3. Paste a YouTube video URL in the input field
4. Click "Get Info" to preview video details
5. Select your preferred quality
6. Choose a download service (Y2Mate, SaveFrom, or YTMP4)
7. The service opens in a new tab where you can download the video

## How It Works

### Client-Side Architecture

This is a **pure Single Page Application (SPA)** with no backend:

1. **Video Info Fetching**: Uses YouTube's public oEmbed API (no authentication required)
   - CORS-friendly endpoint
   - Returns video title, author, and thumbnail
2. **Download Services**: Opens trusted third-party services
   - Y2Mate - Popular download service
   - SaveFrom.net - Well-established downloader
   - YTMP4 - Modern download platform

3. **No Backend Needed**:
   - No server to maintain
   - No API keys required
   - Deploy anywhere (Vercel, Netlify, GitHub Pages)
   - Works offline after initial load (PWA-ready)

### Why No Backend?

YouTube's download functionality requires complex parsing and CORS workarounds. Instead of maintaining a backend, this app:

- Provides a clean interface
- Connects to established download services
- Maintains user privacy (no tracking)
- Eliminates hosting costs

## Project Structure

```
youtube-video-downloader/
├── src/
│   ├── components/
│   │   ├── download-page.tsx    # Main download page component
│   │   └── ui/                  # Shadcn UI components
│   ├── routes/
│   │   ├── index.tsx            # Homepage
│   │   ├── download.tsx         # Download route
│   │   └── __root.tsx           # Root layout
│   └── main.tsx                 # App entry point
├── package.json
└── README.md
```

## Design Philosophy

### Distinctive UI Design

- Bold violet/fuchsia gradient theme
- Animated background elements with blur effects
- Smooth transitions and micro-interactions
- Professional glassmorphism effects
- Grid pattern overlays for technical aesthetic

### Performance Optimizations

Following Vercel's React best practices:

- Direct imports (avoiding barrel files)
- Optimized re-renders
- Lazy loading for heavy components
- Modern React 19 patterns
- TailwindCSS 4.1 for minimal bundle size

## Development Scripts

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npm run typecheck` - Run TypeScript type checking

## Deployment

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### Deploy to Netlify

```bash
npm run build
# Drag the dist/ folder to Netlify
```

### Deploy to GitHub Pages

```bash
npm run build
# Push dist/ folder to gh-pages branch
```

## Supported Download Services

### Y2Mate

- Popular and reliable
- Multiple quality options
- Fast downloads

### SaveFrom.net

- Established service
- Clean interface
- No ads during download

### YTMP4

- Modern platform
- High-quality downloads
- User-friendly

## Troubleshooting

### "Video not found" Error

- Ensure the YouTube URL is correct and complete
- Some videos may be age-restricted or region-locked
- Try the video ID directly (11-character code)

### Download Service Not Working

- Try a different service from the options
- Check if the third-party service is accessible in your region
- Some services may have temporary downtime

### CORS Errors

- oEmbed API is CORS-friendly and should work
- If issues persist, check browser console for details
- Try a different browser

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Responsive design

## Privacy & Legal

- **No Data Collection**: This app runs entirely in your browser
- **No Tracking**: No analytics or user tracking
- **Third-Party Services**: Download services have their own privacy policies
- **Legal Notice**: Respect YouTube's Terms of Service and copyright laws

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

## License

MIT

## Acknowledgments

- Built with React 19 and modern web technologies
- Follows Vercel's React performance best practices
- Uses YouTube's public oEmbed API
- UI inspired by modern design systems

## Features

- 🎥 **Highest Quality Downloads** - Automatically selects the best available resolution
- ⚡ **Lightning Fast** - Direct streaming with optimized performance
- 💾 **Auto-Save** - Automatically saves to your OS Downloads folder (Windows/macOS/Linux)
- 🎨 **Beautiful UI** - Distinctive, production-grade interface with smooth animations
- 🔒 **No Limits** - No watermarks, no restrictions, completely free

## Tech Stack

### Frontend

- React 19.2 with React Compiler
- TanStack Router for routing
- TanStack Query for data fetching
- TypeScript for type safety
- TailwindCSS 4.1 for styling
- Shadcn UI components
- Vite for fast development

### Backend

- Express for API server
- @distube/ytdl-core for YouTube downloads
- CORS enabled for cross-origin requests

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd youtube-video-downloader
```

2. Install dependencies:

```bash
npm install
```

### Running the Application

You have two options to run the application:

#### Option 1: Run both servers together (Recommended)

```bash
npm run dev:all
```

#### Option 2: Run servers separately

In terminal 1 (Frontend):

```bash
npm run dev
```

In terminal 2 (Backend):

```bash
npm run server
```

### Access the Application

- Frontend: http://localhost:5173 (or next available port)
- Backend API: http://localhost:3001

## How to Use

1. Open the application in your browser
2. Click "Start Downloading" to go to the download page
3. Paste a YouTube video URL in the input field
4. Click "Get Info" to preview video details
5. Click "Download Now" to start downloading
6. The video will be saved to your Downloads folder automatically

## API Endpoints

### POST `/api/video-info`

Get information about a YouTube video.

**Request Body:**

```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

**Response:**

```json
{
  "title": "Video Title",
  "author": "Channel Name",
  "lengthSeconds": "300",
  "viewCount": "1000000",
  "thumbnail": "https://...",
  "quality": "1080p"
}
```

### POST `/api/download`

Download a YouTube video.

**Request Body:**

```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

**Response:**

```json
{
  "message": "Download started",
  "filename": "Video Title.mp4",
  "path": "C:\\Users\\YourName\\Downloads\\Video Title.mp4",
  "quality": "1080p"
}
```

## Project Structure

```
youtube-video-downloader/
├── server/
│   └── download-server.js       # Express backend server
├── src/
│   ├── components/
│   │   ├── download-page.tsx    # Main download page component
│   │   └── ui/                  # Shadcn UI components
│   ├── routes/
│   │   ├── index.tsx            # Homepage
│   │   ├── download.tsx         # Download route
│   │   └── __root.tsx           # Root layout
│   └── main.tsx                 # App entry point
├── package.json
└── README.md
```

## Performance Optimizations

This project follows Vercel's React best practices:

- **Bundle Size Optimization**: Direct imports to avoid barrel files
- **Parallel Data Fetching**: Promise.all() for independent operations
- **Client-Side Performance**: Optimized re-renders and memoization
- **Modern React Patterns**: React 19 features and best practices

## Development Scripts

- `npm run dev` - Start Vite development server
- `npm run server` - Start Express backend server
- `npm run dev:all` - Run both servers concurrently
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Troubleshooting

### Port Already in Use

If port 5173 or 3001 is already in use, Vite will automatically try the next available port. Check the terminal output for the correct port.

### Download Fails

- Ensure the YouTube URL is valid
- Check that the backend server is running (http://localhost:3001/health)
- Some videos may be restricted or unavailable in your region

### CORS Errors

The backend is configured with CORS enabled. If you still see CORS errors, ensure both servers are running and the frontend is making requests to the correct backend URL.

## License

MIT

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## Acknowledgments

- Built with React 19 and modern web technologies
- Follows Vercel's React performance best practices
- Uses @distube/ytdl-core for YouTube functionality
