# Testing Documentation

## Overview

This project uses **Vitest** for unit testing with React Testing Library for component tests. All tests are written for **Next.js 16** compatibility.

## Test Structure

```
├── app/
│   └── api/
│       ├── download/
│       │   ├── route.ts
│       │   └── route.test.ts (7 tests)
│       └── video-info/
│           ├── route.ts
│           └── route.test.ts (10 tests)
├── components/
│   ├── download-page.tsx
│   └── download-page.test.tsx (13 tests)
├── vitest.config.ts
└── vitest.setup.ts
```

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

### Download API Route Tests (7 tests)
- ✅ Validates missing URL returns 400
- ✅ Validates invalid URL returns 400  
- ✅ Prioritizes 1080p quality when available
- ✅ Falls back to 720p when 1080p unavailable
- ✅ Selects highest quality when preferred qualities unavailable
- ✅ Handles download errors gracefully
- ✅ Sanitizes video titles for safe filenames

### Video Info API Route Tests (10 tests)
- ✅ Validates missing URL returns 400
- ✅ Validates invalid URL returns 400
- ✅ Returns complete video info for valid URLs
- ✅ Returns highest thumbnail quality
- ✅ Prioritizes 1080p or 720p quality labels
- ✅ Falls back to 720p when 1080p unavailable
- ✅ Selects highest quality when preferred qualities unavailable
- ✅ Handles errors gracefully
- ✅ Supports short-form YouTube URLs (youtu.be)
- ✅ Defaults to "HD" when quality label missing

### DownloadPage Component Tests (13 tests)
- ✅ Renders main interface correctly
- ✅ Displays system ready status
- ✅ Handles URL input
- ✅ Fetches video info when Initialize clicked
- ✅ Shows loading state during fetch
- ✅ Displays error messages on fetch failure
- ✅ Handles download execution
- ✅ Shows extracting state during download
- ✅ Formats duration correctly (MM:SS or HH:MM:SS)
- ✅ Formats view count with K/M notation
- ✅ Handles Enter key press
- ✅ Displays footer with system status
- ✅ Updates backend status dynamically

## Quality Selection Logic

The downloader implements intelligent quality selection:

1. **First Priority**: 1080p (Full HD)
2. **Second Priority**: 720p (HD)
3. **Fallback**: Highest available quality

### Implementation

```typescript
// Get formats with both video and audio
const formats = info.formats.filter(format => 
  format.hasVideo && format.hasAudio
);

// Prioritize 1080p, then 720p
const preferredQualities = ['1080p', '720p'];
let selectedFormat = formats.find(format => 
  preferredQualities.some(quality => 
    format.qualityLabel?.includes(quality)
  )
);

// Fallback to highest quality
if (!selectedFormat) {
  selectedFormat = formats.sort((a, b) => {
    const heightA = a.height || 0;
    const heightB = b.height || 0;
    return heightB - heightA;
  })[0];
}
```

## Dependencies

```json
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@vitejs/plugin-react": "^5.1.2",
    "jsdom": "^27.4.0",
    "vitest": "^4.0.18"
  }
}
```

## Mocking Strategy

### ytdl-core Mocking
The `@distube/ytdl-core` library is mocked in tests to:
- Simulate video info retrieval
- Mock format selection
- Test error handling
- Avoid actual YouTube API calls

### Framer Motion Mocking
Framer Motion is mocked to avoid animation complexity in tests:
```typescript
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => 
      <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
```

## Best Practices

1. **Isolation**: Each test is independent and doesn't rely on others
2. **Mocking**: External dependencies are properly mocked
3. **Cleanup**: Automatic cleanup after each test via vitest.setup.ts
4. **Coverage**: Critical paths and edge cases are tested
5. **Descriptive**: Test names clearly describe what they verify

## Test Results

```
Test Files  3 passed (3)
     Tests  30 passed (30)
  Duration  ~9s
```

All tests pass successfully! ✅
