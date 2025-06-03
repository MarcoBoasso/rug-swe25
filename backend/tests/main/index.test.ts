// @ts-nocheck
import index, { handleOptions, Env } from "../../src/main/index";

// Mock the service and transformer modules
jest.mock('../../src/main/service', () => ({
  fetchPopularRepositories: jest.fn(),
  enhanceRepositoriesWithAnalysis: jest.fn(),
}));

jest.mock('../../src/main/transformer', () => ({
  simplifyRepository: jest.fn(),
}));

jest.mock('../../env/env', () => ({
  LLM_API_KEY: 'test-dev-api-key',
  DEV_CONFIG: { defaultRepoLimit: 10 }
}));

import { fetchPopularRepositories, enhanceRepositoriesWithAnalysis } from '../../src/main/service';
import { simplifyRepository } from '../../src/main/transformer';

const mockFetchPopularRepositories = fetchPopularRepositories as jest.MockedFunction<typeof fetchPopularRepositories>;
const mockEnhanceRepositoriesWithAnalysis = enhanceRepositoriesWithAnalysis as jest.MockedFunction<typeof enhanceRepositoriesWithAnalysis>;
const mockSimplifyRepository = simplifyRepository as jest.MockedFunction<typeof simplifyRepository>;

// Define types for test data
interface MockRepository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  readme?: string;
  language?: string;
  [key: string]: any;
}

interface MockEnhancedRepository extends MockRepository {
  analysis?: string;
}

interface MockSimplifiedRepository {
  name: string;
  id: number;
}

// Define response body types for tests
interface TestResponseBody {
  repositories?: MockSimplifiedRepository[];
  count?: number;
  total_available?: number;
  limit?: number;
  timestamp?: string;
  error?: string;
  success?: boolean;
}

/**
 * Unit tests for the Cloudflare Worker index handler.
 */
describe("index", () => {
  let mockEnv: Env;
  let mockContext: ExecutionContext;

  // Creating a new mock environment and context for each test
  beforeEach(() => {
    // Mock Request and Response for this specific test environment
    const MockRequest = jest.fn();
    const MockResponse = jest.fn().mockImplementation((body: any, options: any = {}) => {
      const headers = new Map<string, string>();
      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          headers.set(key, value as string);
        });
      }
      
      return {
        status: options.status || 200,
        headers: {
          get: (key: string) => headers.get(key) || null,
          set: (key: string, value: string) => headers.set(key, value),
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
    
    // Add static methods with proper typing
    (MockResponse as any).error = jest.fn();
    (MockResponse as any).json = jest.fn();
    (MockResponse as any).redirect = jest.fn();
    
    (global as any).Request = MockRequest;
    (global as any).Response = MockResponse;
    mockEnv = {
      REPO_CACHE: {
        get: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        list: jest.fn(),
      } as any,
      LLM_API_KEY: 'test-api-key'
    };
    
    mockContext = {} as ExecutionContext;
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  // Unit testing for the handleOptions() function
  describe("handleOptions()", () => {
    // Unit test code: UT-01
    test("UT-01: should return CORS headers for OPTIONS request", () => {
      const request = new Request('https://example.com', { method: 'OPTIONS' });
      const response = handleOptions(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });
  });

  // Unit testing for the main fetch() function
  describe("fetch()", () => {
    // Unit test code: UT-02
    test("UT-02: should return error for invalid limit parameter", async () => {
      const mockRequest = {
        url: 'https://example.com?limit=invalid',
        method: 'GET',
        headers: { get: jest.fn() },
      };

      const response = await index.fetch(mockRequest as any, mockEnv, mockContext);
      
      expect(response.status).toBe(400);
      const body = await response.json() as TestResponseBody;
      expect(body.error).toBe("Invalid limit parameter. Must be a positive number.");
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    // Unit test code: UT-03
    test("UT-03: should return error for negative limit parameter", async () => {
      const mockRequest = {
        url: 'https://example.com?limit=-5',
        method: 'GET',
        headers: { get: jest.fn() },
      };

      const response = await index.fetch(mockRequest as any, mockEnv, mockContext);
      
      expect(response.status).toBe(400);
      const body = await response.json() as TestResponseBody;
      expect(body.error).toBe("Invalid limit parameter. Must be a positive number.");
    });

    // Unit test code: UT-04
    test("UT-04: should return error for zero limit parameter", async () => {
      const mockRequest = {
        url: 'https://example.com?limit=0',
        method: 'GET',
        headers: { get: jest.fn() },
      };

      const response = await index.fetch(mockRequest as any, mockEnv, mockContext);
      
      expect(response.status).toBe(400);
      const body = await response.json() as TestResponseBody;
      expect(body.error).toBe("Invalid limit parameter. Must be a positive number.");
    });

    // Unit test code: UT-05
    test("UT-05: should use default limit when no limit parameter provided", async () => {
      const mockRepos: MockRepository[] = [
        { id: 1, name: 'repo1', full_name: 'user/repo1', description: 'Test repo 1', readme: 'README', language: 'JavaScript' },
        { id: 2, name: 'repo2', full_name: 'user/repo2', description: 'Test repo 2', readme: 'README', language: 'TypeScript' }
      ];
      const mockEnhancedRepos: MockEnhancedRepository[] = mockRepos.map(repo => ({ ...repo, analysis: 'test analysis' }));

      mockFetchPopularRepositories.mockResolvedValue(mockRepos as any[]);
      mockEnhanceRepositoriesWithAnalysis.mockResolvedValue(mockEnhancedRepos as any[]);
      mockSimplifyRepository.mockImplementation((repo: any) => ({ name: repo.name, id: repo.id }));

      const mockRequest = {
        url: 'https://example.com',
        method: 'GET',
        headers: { get: jest.fn() },
      };

      const response = await index.fetch(mockRequest as any, mockEnv, mockContext);
      
      expect(response.status).toBe(200);
      const body = await response.json() as TestResponseBody;
      expect(mockFetchPopularRepositories).toHaveBeenCalledWith(mockEnv);
      expect(mockEnhanceRepositoriesWithAnalysis).toHaveBeenCalledWith(mockRepos, mockEnv);
    });

    // Unit test code: UT-06
    test("UT-06: should use fallback API key from development environment", async () => {
      const envWithoutApiKey: Env = {
        REPO_CACHE: mockEnv.REPO_CACHE
        // LLM_API_KEY is undefined
      };

      const mockRepos: MockRepository[] = [{ id: 1, name: 'repo1', full_name: 'user/repo1', description: 'Test repo', readme: 'README', language: 'JavaScript' }];
      const mockEnhancedRepos: MockEnhancedRepository[] = [{ ...mockRepos[0], analysis: 'test analysis' }];

      mockFetchPopularRepositories.mockResolvedValue(mockRepos as any[]);
      mockEnhanceRepositoriesWithAnalysis.mockResolvedValue(mockEnhancedRepos as any[]);
      mockSimplifyRepository.mockImplementation((repo: any) => ({ name: repo.name, id: repo.id }));

      const mockRequest = {
        url: 'https://example.com',
        method: 'GET',
        headers: { get: jest.fn() },
      };

      const response = await index.fetch(mockRequest as any, envWithoutApiKey, mockContext);
      
      // Should succeed if DEV_LLM_API_KEY is available
      expect(response.status).toBe(200);
    });

    // Unit test code: UT-07
    test("UT-07: should handle service errors gracefully", async () => {
      const errorMessage = 'Service temporarily unavailable';
      mockFetchPopularRepositories.mockRejectedValue(new Error(errorMessage));

      const mockRequest = {
        url: 'https://example.com',
        method: 'GET',
        headers: { get: jest.fn() },
      };

      const response = await index.fetch(mockRequest as any, mockEnv, mockContext);
      
      expect(response.status).toBe(500);
      const body = await response.json() as TestResponseBody;
      expect(body.success).toBe(false);
      expect(body.error).toBe(errorMessage);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    // Unit test code: UT-08
    test("UT-08: should handle unknown errors gracefully", async () => {
      mockFetchPopularRepositories.mockRejectedValue('Unknown error');

      const mockRequest = {
        url: 'https://example.com',
        method: 'GET',
        headers: { get: jest.fn() },
      };

      const response = await index.fetch(mockRequest as any, mockEnv, mockContext);
      
      expect(response.status).toBe(500);
      const body = await response.json() as TestResponseBody;
      expect(body.success).toBe(false);
      expect(body.error).toBe('An unknown error occurred');
    });

    // Unit test code: UT-09
    test("UT-09: should include CORS headers in all responses", async () => {
      const mockRepos: MockRepository[] = [{ id: 1, name: 'repo1', full_name: 'user/repo1', description: 'Test repo', readme: 'README', language: 'JavaScript' }];
      const mockEnhancedRepos: MockEnhancedRepository[] = [{ ...mockRepos[0], analysis: 'test analysis' }];

      mockFetchPopularRepositories.mockResolvedValue(mockRepos as any[]);
      mockEnhanceRepositoriesWithAnalysis.mockResolvedValue(mockEnhancedRepos as any[]);
      mockSimplifyRepository.mockImplementation((repo: any) => ({ name: repo.name, id: repo.id }));

      const mockRequest = {
        url: 'https://example.com',
        method: 'GET',
        headers: { get: jest.fn() },
      };

      const response = await index.fetch(mockRequest as any, mockEnv, mockContext);
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    // Unit test code: UT-10
    test("UT-10: should include CORS headers in error responses", async () => {
      const mockRequest = {
        url: 'https://example.com?limit=invalid',
        method: 'GET',
        headers: { get: jest.fn() },
      };

      const response = await index.fetch(mockRequest as any, mockEnv, mockContext);
      
      expect(response.status).toBe(400);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    // Unit test code: UT-11
    test("UT-11: should correctly limit repositories when limit exceeds available repositories", async () => {
      const mockRepos: MockRepository[] = [
        { id: 1, name: 'repo1', full_name: 'user/repo1', description: 'Test repo 1', readme: 'README', language: 'JavaScript' },
        { id: 2, name: 'repo2', full_name: 'user/repo2', description: 'Test repo 2', readme: 'README', language: 'TypeScript' }
      ];
      const mockEnhancedRepos: MockEnhancedRepository[] = mockRepos.map(repo => ({ ...repo, analysis: 'test analysis' }));

      mockFetchPopularRepositories.mockResolvedValue(mockRepos as any[]);
      mockEnhanceRepositoriesWithAnalysis.mockResolvedValue(mockEnhancedRepos as any[]);
      mockSimplifyRepository.mockImplementation((repo: any) => ({ name: repo.name, id: repo.id }));

      const mockRequest = {
        url: 'https://example.com?limit=10',
        method: 'GET',
        headers: { get: jest.fn() },
      };

      const response = await index.fetch(mockRequest as any, mockEnv, mockContext);
      
      expect(response.status).toBe(200);
      const body = await response.json() as TestResponseBody;
      expect(body.repositories).toHaveLength(2);
      expect(body.count).toBe(2);
      expect(body.total_available).toBe(2);
      expect(body.limit).toBe(10);
    });

    // Unit test code: UT-12
    test("UT-12: should call simplifyRepository for each enhanced repository", async () => {
      const mockRepos: MockRepository[] = [
        { id: 1, name: 'repo1', full_name: 'user/repo1', description: 'Test repo 1', readme: 'README', language: 'JavaScript' },
        { id: 2, name: 'repo2', full_name: 'user/repo2', description: 'Test repo 2', readme: 'README', language: 'TypeScript' }
      ];
      const mockEnhancedRepos: MockEnhancedRepository[] = mockRepos.map(repo => ({ ...repo, analysis: 'test analysis' }));

      mockFetchPopularRepositories.mockResolvedValue(mockRepos as any[]);
      mockEnhanceRepositoriesWithAnalysis.mockResolvedValue(mockEnhancedRepos as any[]);
      mockSimplifyRepository.mockImplementation((repo: any) => ({ name: repo.name, id: repo.id }));

      const mockRequest = {
        url: 'https://example.com',
        method: 'GET',
        headers: { get: jest.fn() },
      };

      const response = await index.fetch(mockRequest as any, mockEnv, mockContext);
      
      expect(response.status).toBe(200);
      expect(mockSimplifyRepository).toHaveBeenCalledTimes(2);
      expect(mockSimplifyRepository).toHaveBeenCalledWith(mockEnhancedRepos[0]);
      expect(mockSimplifyRepository).toHaveBeenCalledWith(mockEnhancedRepos[1]);
    });
  });
});