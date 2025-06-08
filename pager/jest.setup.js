// Mock global objects for Cloudflare Worker environment
global.fetch = jest.fn();

// Mock URL constructor with better search params handling
global.URL = jest.fn().mockImplementation((url) => {
  try {
    const urlObj = new (require('url').URL)(url);
    return {
      ...urlObj,
      searchParams: {
        get: (key) => {
          const params = new URLSearchParams(urlObj.search);
          return params.get(key);
        },
      },
    };
  } catch (error) {
    return {
      href: url,
      searchParams: {
        get: (key) => {
          const match = url.match(new RegExp(`[?&]${key}=([^&]*)`));
          return match ? decodeURIComponent(match[1]) : null;
        },
      },
    };
  }
});

// Mock Request constructor
global.Request = jest.fn();

// Mock Response constructor with better headers handling
global.Response = jest.fn().mockImplementation((body, options = {}) => {
  const headers = new Map();
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }
  
  return {
    status: options.status || 200,
    headers: {
      get: (key) => headers.get(key) || null,
      set: (key, value) => headers.set(key, value),
    },
    json: async () => {
      if (typeof body === 'string') {
        try {
          return JSON.parse(body);
        } catch {
          return {};
        }
      }
      return body || {};
    },
  };
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  log: jest.fn(),
};