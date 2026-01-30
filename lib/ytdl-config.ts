import ytdl from '@distube/ytdl-core';

// YouTube agent configuration for better compatibility in serverless environments
export const getYtdlAgent = () => {
  // Try to create agent with cookies for better YouTube compatibility
  // This may not be available in all environments or during testing
  try {
    if (typeof ytdl.createAgent === 'function') {
      return ytdl.createAgent([
        {
          name: 'CONSENT',
          value: 'YES+cb.20210328-17-p0.en+FX+291',
        },
      ]);
    }
  } catch (error) {
    console.warn('Could not create ytdl agent:', error);
  }
  
  return undefined;
};

// Common ytdl options for production environments
export const getYtdlOptions = (additionalOptions: ytdl.downloadOptions = {}): ytdl.downloadOptions => {
  const agent = getYtdlAgent();
  
  return {
    ...(agent ? { agent } : {}),
    requestOptions: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    },
    ...additionalOptions,
  } as ytdl.downloadOptions;
};
