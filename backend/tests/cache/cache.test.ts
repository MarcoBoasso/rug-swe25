// @ts-nocheck
import {
    getAnalysisFromCache,
    storeAnalysisInCache,
    getPopularReposFromCache,
    storePopularReposInCache,
    invalidateCacheEntry,
    generateCacheKey,
    CACHE_CONFIG
  } from "../../src/cache/cache";
  
  // Mock the environment config
  jest.mock('../../env/env', () => ({
    DEV_CONFIG: {
      analysisCacheTTL: 3600,
      popularReposCacheTTL: 7200,
      popularReposCacheKey: 'popular-repos',
      apiRefreshHour: 12,
      apiRefreshBuffer: 15,
      enableVerboseLogging: false
    }
  }));
  
  // Define types for test data
  interface MockKVNamespace {
    get: jest.Mock;
    put: jest.Mock;
    delete: jest.Mock;
  }
  
  interface MockEnv {
    REPO_CACHE?: MockKVNamespace;
  }
  
  interface RepositoryAnalysis {
    category: string;
    summary: string;
  }
  
  interface MockRepository {
    name: string;
    full_name: string;
    description?: string;
    stargazers_count: number;
    language?: string;
  }
  
  /**
   * Unit tests for the Cache layer.
   */
  describe("cache", () => {
    let mockKV: MockKVNamespace;
    let mockEnv: MockEnv;
  
    beforeEach(() => {
      mockKV = {
        get: jest.fn(),
        put: jest.fn(),
        delete: jest.fn()
      };
  
      mockEnv = {
        REPO_CACHE: mockKV
      };
  
      // Reset all mocks
      jest.clearAllMocks();
      
      // Mock console methods
      global.console = {
        ...console,
        log: jest.fn(),
        error: jest.fn(),
      };
  
      // Mock Date
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-06-15T14:30:00Z')); // After refresh time
    });
  
    afterEach(() => {
      jest.useRealTimers();
    });
  
    // Unit testing for the getAnalysisFromCache() function
    describe("getAnalysisFromCache()", () => {
      // Unit test code: UT-67
      test("UT-67: should return cached analysis when found", async () => {
        const mockAnalysis: RepositoryAnalysis = {
          category: 'Frontend',
          summary: 'A React-based web application'
        };
  
        mockKV.get.mockResolvedValue(JSON.stringify(mockAnalysis));
  
        const result = await getAnalysisFromCache('test-cache-key', mockEnv as any);
  
        expect(result).toEqual(mockAnalysis);
        expect(mockKV.get).toHaveBeenCalledWith('test-cache-key');
      });
  
      // Unit test code: UT-68
      test("UT-68: should return null when cache miss", async () => {
        mockKV.get.mockResolvedValue(null);
  
        const result = await getAnalysisFromCache('missing-key', mockEnv as any);
  
        expect(result).toBeNull();
        expect(mockKV.get).toHaveBeenCalledWith('missing-key');
      });
  
      // Unit test code: UT-69
      test("UT-69: should return null when KV namespace unavailable", async () => {
        const envWithoutKV = {};
  
        const result = await getAnalysisFromCache('test-key', envWithoutKV as any);
  
        expect(result).toBeNull();
      });
  
      // Unit test code: UT-70
      test("UT-70: should handle KV get errors gracefully", async () => {
        mockKV.get.mockRejectedValue(new Error('KV error'));
  
        const result = await getAnalysisFromCache('error-key', mockEnv as any);
  
        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith('Error retrieving from cache:', expect.any(Error));
      });
  
      // Unit test code: UT-71
      test("UT-71: should handle JSON parse errors gracefully", async () => {
        mockKV.get.mockResolvedValue('invalid json');
  
        const result = await getAnalysisFromCache('invalid-json-key', mockEnv as any);
  
        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith('Error retrieving from cache:', expect.any(Error));
      });
    });
  
    // Unit testing for the storeAnalysisInCache() function
    describe("storeAnalysisInCache()", () => {
      // Unit test code: UT-72
      test("UT-72: should store analysis in cache with default TTL", async () => {
        const analysis: RepositoryAnalysis = {
          category: 'Backend',
          summary: 'A Node.js API server'
        };
  
        await storeAnalysisInCache('store-key', analysis, mockEnv as any);
  
        expect(mockKV.put).toHaveBeenCalledWith(
          'store-key',
          JSON.stringify(analysis),
          { expirationTtl: 3600 }
        );
      });
  
      // Unit test code: UT-73
      test("UT-73: should store analysis with custom TTL", async () => {
        const analysis: RepositoryAnalysis = {
          category: 'Mobile',
          summary: 'A React Native app'
        };
  
        await storeAnalysisInCache('custom-ttl-key', analysis, mockEnv as any, 7200);
  
        expect(mockKV.put).toHaveBeenCalledWith(
          'custom-ttl-key',
          JSON.stringify(analysis),
          { expirationTtl: 7200 }
        );
      });
  
      // Unit test code: UT-74
      test("UT-74: should handle missing KV namespace gracefully", async () => {
        const analysis: RepositoryAnalysis = {
          category: 'Data & AI',
          summary: 'Machine learning framework'
        };
        const envWithoutKV = {};
  
        await storeAnalysisInCache('no-kv-key', analysis, envWithoutKV as any);
  
        // Should not throw error, just return without storing
        expect(mockKV.put).not.toHaveBeenCalled();
      });
  
      // Unit test code: UT-75
      test("UT-75: should handle KV put errors gracefully", async () => {
        const analysis: RepositoryAnalysis = {
          category: 'DevOps & Automation',
          summary: 'CI/CD pipeline tool'
        };
  
        mockKV.put.mockRejectedValue(new Error('KV put error'));
  
        await storeAnalysisInCache('error-put-key', analysis, mockEnv as any);
  
        expect(console.error).toHaveBeenCalledWith('Error storing in cache:', expect.any(Error));
      });
    });
  
    // Unit testing for the getPopularReposFromCache() function
    describe("getPopularReposFromCache()", () => {
      // Unit test code: UT-76
      test("UT-76: should return cached repositories when found and not expired", async () => {
        const mockRepos: MockRepository[] = [
          { name: 'repo1', full_name: 'user/repo1', stargazers_count: 100, language: 'JavaScript' },
          { name: 'repo2', full_name: 'user/repo2', stargazers_count: 200, language: 'Python' }
        ];
  
        // Mock that refresh is not needed (before refresh time)
        jest.setSystemTime(new Date('2023-06-15T10:00:00Z')); // Before refresh time
  
        mockKV.get
          .mockResolvedValueOnce(JSON.stringify(mockRepos)) // Popular repos
          .mockResolvedValueOnce('2023-06-15T13:00:00Z'); // Last refresh timestamp
  
        const result = await getPopularReposFromCache(mockEnv as any);
  
        expect(result).toEqual(mockRepos);
        expect(mockKV.get).toHaveBeenCalledWith('popular-repos');
      });
  
      // Unit test code: UT-77
      test("UT-77: should return null when cache should be refreshed", async () => {
        // Set time after refresh time but no refresh today
        jest.setSystemTime(new Date('2023-06-15T14:30:00Z'));
        
        mockKV.get.mockResolvedValue(null); // No last refresh timestamp
  
        const result = await getPopularReposFromCache(mockEnv as any);
  
        expect(result).toBeNull();
      });
  
      // Unit test code: UT-78
      test("UT-78: should return null when KV namespace unavailable", async () => {
        const envWithoutKV = {};
  
        const result = await getPopularReposFromCache(envWithoutKV as any);
  
        expect(result).toBeNull();
      });
    });
  
    // Unit testing for the storePopularReposInCache() function
    describe("storePopularReposInCache()", () => {
      // Unit test code: UT-79
      test("UT-79: should store repositories and last refresh timestamp", async () => {
        const mockRepos: MockRepository[] = [
          { name: 'repo1', full_name: 'user/repo1', stargazers_count: 150, language: 'TypeScript' }
        ];
  
        await storePopularReposInCache(mockRepos as any[], mockEnv as any);
  
        expect(mockKV.put).toHaveBeenCalledTimes(2);
        expect(mockKV.put).toHaveBeenCalledWith(
          'popular-repos',
          JSON.stringify(mockRepos),
          { expirationTtl: 7200 }
        );
        expect(mockKV.put).toHaveBeenCalledWith(
          'popular-repos-last-refresh',
          expect.any(String), // ISO timestamp
          { expirationTtl: 7200 }
        );
      });
  
      // Unit test code: UT-80
      test("UT-80: should handle missing KV namespace gracefully", async () => {
        const mockRepos: MockRepository[] = [
          { name: 'repo1', full_name: 'user/repo1', stargazers_count: 50, language: 'Go' }
        ];
        const envWithoutKV = {};
  
        await storePopularReposInCache(mockRepos as any[], envWithoutKV as any);
  
        expect(mockKV.put).not.toHaveBeenCalled();
      });
  
      // Unit test code: UT-81
      test("UT-81: should handle KV put errors gracefully", async () => {
        const mockRepos: MockRepository[] = [
          { name: 'repo1', full_name: 'user/repo1', stargazers_count: 75, language: 'Rust' }
        ];
  
        mockKV.put.mockRejectedValue(new Error('KV put error'));
  
        await storePopularReposInCache(mockRepos as any[], mockEnv as any);
  
        expect(console.error).toHaveBeenCalledWith('Error storing popular repos in cache:', expect.any(Error));
      });
    });
  
    // Unit testing for the invalidateCacheEntry() function
    describe("invalidateCacheEntry()", () => {
      // Unit test code: UT-82
      test("UT-82: should delete cache entry successfully", async () => {
        await invalidateCacheEntry('invalidate-key', mockEnv as any);
  
        expect(mockKV.delete).toHaveBeenCalledWith('invalidate-key');
      });
  
      // Unit test code: UT-83
      test("UT-83: should handle missing KV namespace gracefully", async () => {
        const envWithoutKV = {};
  
        await invalidateCacheEntry('no-kv-key', envWithoutKV as any);
  
        expect(mockKV.delete).not.toHaveBeenCalled();
      });
  
      // Unit test code: UT-84
      test("UT-84: should handle KV delete errors gracefully", async () => {
        mockKV.delete.mockRejectedValue(new Error('KV delete error'));
  
        await invalidateCacheEntry('error-delete-key', mockEnv as any);
  
        expect(console.error).toHaveBeenCalledWith('Error invalidating cache:', expect.any(Error));
      });
    });
  
    // Unit testing for the generateCacheKey() function
    describe("generateCacheKey()", () => {
      // Unit test code: UT-85
      test("UT-85: should generate correct cache key format", () => {
        const result = generateCacheKey('user/repo', '2023-06-15T12:00:00Z');
  
        expect(result).toBe('repo:user/repo:2023-06-15T12:00:00Z');
      });
  
      // Unit test code: UT-86
      test("UT-86: should handle special characters in repo name", () => {
        const result = generateCacheKey('user/repo-with-dashes_and_underscores', '2023-01-01T00:00:00Z');
  
        expect(result).toBe('repo:user/repo-with-dashes_and_underscores:2023-01-01T00:00:00Z');
      });
  
      // Unit test code: UT-87
      test("UT-87: should handle different timestamp formats", () => {
        const result = generateCacheKey('org/project', '2023-12-31T23:59:59.999Z');
  
        expect(result).toBe('repo:org/project:2023-12-31T23:59:59.999Z');
      });
    });
  
    // Unit testing for CACHE_CONFIG constant
    describe("CACHE_CONFIG", () => {
      // Unit test code: UT-88
      test("UT-88: should have correct default configuration values", () => {
        expect(CACHE_CONFIG.analysisTTL).toBe(3600);
        expect(CACHE_CONFIG.popularReposTTL).toBe(7200);
      });
    });
  
    // Unit testing for time-based refresh logic
    describe("refresh logic", () => {
      // Unit test code: UT-89
      test("UT-89: should not refresh when before refresh time", async () => {
        // Set time before refresh time (12:15 UTC)
        jest.setSystemTime(new Date('2023-06-15T10:00:00Z'));
  
        const mockRepos: MockRepository[] = [
          { name: 'repo1', full_name: 'user/repo1', stargazers_count: 100, language: 'JavaScript' }
        ];
  
        mockKV.get.mockResolvedValue(JSON.stringify(mockRepos));
  
        const result = await getPopularReposFromCache(mockEnv as any);
  
        expect(result).toEqual(mockRepos);
      });
  
      // Unit test code: UT-90
      test("UT-90: should refresh when after refresh time and not refreshed today", async () => {
        // Set time after refresh time
        jest.setSystemTime(new Date('2023-06-15T14:30:00Z'));
  
        // Mock no last refresh timestamp (never refreshed)
        mockKV.get.mockResolvedValue(null);
  
        const result = await getPopularReposFromCache(mockEnv as any);
  
        expect(result).toBeNull(); // Should force refresh
      });
  
      // Unit test code: UT-9§
      test("UT-91: should not refresh when already refreshed today", async () => {
        // Set time after refresh time
        jest.setSystemTime(new Date('2023-06-15T16:00:00Z'));
  
        const mockRepos: MockRepository[] = [
          { name: 'repo1', full_name: 'user/repo1', stargazers_count: 100, language: 'JavaScript' }
        ];
  
        mockKV.get
          .mockResolvedValueOnce('2023-06-15T13:00:00Z') // Last refresh timestamp (today after refresh time)
          .mockResolvedValueOnce(JSON.stringify(mockRepos)); // Popular repos
  
        const result = await getPopularReposFromCache(mockEnv as any);
  
        expect(result).toEqual(mockRepos); // Should use cache
      });
    });
  });