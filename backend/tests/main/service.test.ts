// @ts-nocheck
import { fetchPopularRepositories, enhanceRepositoriesWithAnalysis, formatRepositoryForLLM } from "../../src/main/service";
import { Env } from "../../src/main/index";

// Mock the cache and LLM modules
jest.mock('../../src/cache/cache', () => ({
  getAnalysisFromCache: jest.fn(),
  storeAnalysisInCache: jest.fn(),
  getPopularReposFromCache: jest.fn(),
  storePopularReposInCache: jest.fn(),
}));

jest.mock('../../src/llm/llm', () => ({
  generateRepositoryAnalysis: jest.fn(),
}));

jest.mock('../../env/env', () => ({
  DEV_CONFIG: {
    enableVerboseLogging: false,
    analysisCacheTTL: 3600,
    defaultRepoLimit: 10
  }
}));

import { getAnalysisFromCache, storeAnalysisInCache, getPopularReposFromCache, storePopularReposInCache } from '../../src/cache/cache';
import { generateRepositoryAnalysis } from '../../src/llm/llm';
import { Repository, EnhancedRepository, RepositoryAnalysis, PopularRepositoriesResponse } from '../../env/types';

const mockGetAnalysisFromCache = getAnalysisFromCache as jest.MockedFunction<typeof getAnalysisFromCache>;
const mockStoreAnalysisInCache = storeAnalysisInCache as jest.MockedFunction<typeof storeAnalysisInCache>;
const mockGetPopularReposFromCache = getPopularReposFromCache as jest.MockedFunction<typeof getPopularReposFromCache>;
const mockStorePopularReposInCache = storePopularReposInCache as jest.MockedFunction<typeof storePopularReposInCache>;
const mockGenerateRepositoryAnalysis = generateRepositoryAnalysis as jest.MockedFunction<typeof generateRepositoryAnalysis>;

// Define types for test data
interface MockRepository extends Repository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  readme?: string;
  language?: string;
  stargazers_count: number;
  updated_at: string;
  tree?: string;
}

interface TestResponseBody {
  repositories?: Repository[];
  error?: string;
  success?: boolean;
}

/**
 * Unit tests for the Service layer.
 */
describe("service", () => {
  let mockEnv: Env;
  let mockFetch: jest.Mock;

  // Creating a new mock environment for each test
  beforeEach(() => {
    mockEnv = {
      REPO_CACHE: {
        get: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        list: jest.fn(),
      } as any,
      LLM_API_KEY: 'test-api-key'
    };

    // Mock global fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock console methods
    global.console = {
      ...console,
      log: jest.fn(),
      error: jest.fn(),
    };
  });

  // Unit testing for the fetchPopularRepositories() function
  describe("fetchPopularRepositories()", () => {
    // Unit test code: UT-15
    test("UT-15: should return repositories from cache when available", async () => {
      const mockCachedRepos: MockRepository[] = [
        { 
          id: 1, 
          name: 'repo1', 
          full_name: 'user/repo1', 
          stargazers_count: 100, 
          updated_at: '2023-01-01',
          description: 'Test repo 1',
          language: 'JavaScript'
        },
        { 
          id: 2, 
          name: 'repo2', 
          full_name: 'user/repo2', 
          stargazers_count: 200, 
          updated_at: '2023-01-02',
          description: 'Test repo 2',
          language: 'TypeScript'
        }
      ];

      mockGetPopularReposFromCache.mockResolvedValue(mockCachedRepos as Repository[]);

      const result = await fetchPopularRepositories(mockEnv);

      expect(result).toEqual(mockCachedRepos);
      expect(mockGetPopularReposFromCache).toHaveBeenCalledWith(mockEnv);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    // Unit test code: UT-16
    test("UT-16: should fetch from API when cache is empty and store in cache", async () => {
      const mockApiRepos: MockRepository[] = [
        { 
          id: 1, 
          name: 'api-repo1', 
          full_name: 'user/api-repo1', 
          stargazers_count: 150, 
          updated_at: '2023-01-03',
          description: 'API repo 1',
          language: 'Python'
        }
      ];

      const mockApiResponse: PopularRepositoriesResponse = {
        repositories: mockApiRepos as Repository[]
      };

      mockGetPopularReposFromCache.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      });

      const result = await fetchPopularRepositories(mockEnv);

      expect(result).toEqual(mockApiRepos);
      expect(mockGetPopularReposFromCache).toHaveBeenCalledWith(mockEnv);
      expect(mockFetch).toHaveBeenCalledWith('https://popular.forgithub.com/index.json', {
        headers: { 'Accept': 'application/json' }
      });
      expect(mockStorePopularReposInCache).toHaveBeenCalledWith(mockApiRepos, mockEnv);
    });

    // Unit test code: UT-17
    test("UT-17: should throw error when API request fails", async () => {
      mockGetPopularReposFromCache.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(fetchPopularRepositories(mockEnv)).rejects.toThrow(
        'Failed to fetch popular repositories: Popular repos API returned 500: Internal Server Error'
      );

      expect(mockGetPopularReposFromCache).toHaveBeenCalledWith(mockEnv);
      expect(mockFetch).toHaveBeenCalled();
      expect(mockStorePopularReposInCache).not.toHaveBeenCalled();
    });

    // Unit test code: UT-18
    test("UT-18: should throw error when fetch throws an exception", async () => {
      const errorMessage = 'Network error';
      mockGetPopularReposFromCache.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error(errorMessage));

      await expect(fetchPopularRepositories(mockEnv)).rejects.toThrow(
        `Failed to fetch popular repositories: ${errorMessage}`
      );

      expect(mockGetPopularReposFromCache).toHaveBeenCalledWith(mockEnv);
      expect(mockFetch).toHaveBeenCalled();
      expect(mockStorePopularReposInCache).not.toHaveBeenCalled();
    });

    // Unit test code: UT-19
    test("UT-19: should handle unknown error types gracefully", async () => {
      mockGetPopularReposFromCache.mockResolvedValue(null);
      mockFetch.mockRejectedValue('Unknown string error');

      await expect(fetchPopularRepositories(mockEnv)).rejects.toThrow(
        'Failed to fetch popular repositories: Unknown error'
      );
    });

    // Unit test code: UT-20
    test("UT-20: should handle cache error and fallback to API", async () => {
      const mockApiRepos: MockRepository[] = [
        { 
          id: 1, 
          name: 'fallback-repo', 
          full_name: 'user/fallback-repo', 
          stargazers_count: 75, 
          updated_at: '2023-01-04',
          description: 'Fallback repo',
          language: 'Go'
        }
      ];

      const mockApiResponse: PopularRepositoriesResponse = {
        repositories: mockApiRepos as Repository[]
      };

      mockGetPopularReposFromCache.mockRejectedValue(new Error('Cache error'));
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      });

      await expect(fetchPopularRepositories(mockEnv)).rejects.toThrow('Cache error');
    });
  });

  // Unit testing for the enhanceRepositoriesWithAnalysis() function
  describe("enhanceRepositoriesWithAnalysis()", () => {
    const mockRepositories: MockRepository[] = [
      { 
        id: 1, 
        name: 'test-repo', 
        full_name: 'user/test-repo', 
        stargazers_count: 100, 
        updated_at: '2023-01-01',
        description: 'Test repository',
        language: 'JavaScript'
      }
    ];

    // Unit test code: UT-21
    test("UT-21: should throw error when LLM API key is missing", async () => {
      const envWithoutKey: Env = {
        REPO_CACHE: mockEnv.REPO_CACHE
      };

      await expect(enhanceRepositoriesWithAnalysis(mockRepositories as Repository[], envWithoutKey))
        .rejects.toThrow('LLM API key is required for repository analysis');
    });

    // Unit test code: UT-22
    test("UT-22: should return enhanced repositories with cached analysis", async () => {
      const mockAnalysis: RepositoryAnalysis = {
        category: 'Web Framework',
        summary: 'A modern web framework for building scalable applications'
      };

      mockGetAnalysisFromCache.mockResolvedValue(mockAnalysis);

      const result = await enhanceRepositoriesWithAnalysis(mockRepositories as Repository[], mockEnv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...mockRepositories[0],
        analysis: mockAnalysis
      });
      expect(mockGetAnalysisFromCache).toHaveBeenCalledWith(
        `repo:${mockRepositories[0].full_name}:${mockRepositories[0].updated_at}`,
        mockEnv
      );
      expect(mockGenerateRepositoryAnalysis).not.toHaveBeenCalled();
    });

    // Unit test code: UT-23
    test("UT-23: should generate new analysis when not in cache", async () => {
      const mockAnalysis: RepositoryAnalysis = {
        category: 'Machine Learning',
        summary: 'A comprehensive machine learning library with advanced features'
      };

      mockGetAnalysisFromCache.mockResolvedValue(null);
      mockGenerateRepositoryAnalysis.mockResolvedValue(mockAnalysis);

      const result = await enhanceRepositoriesWithAnalysis(mockRepositories as Repository[], mockEnv);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...mockRepositories[0],
        analysis: mockAnalysis
      });
      expect(mockGetAnalysisFromCache).toHaveBeenCalled();
      expect(mockGenerateRepositoryAnalysis).toHaveBeenCalledWith(mockRepositories[0], 'test-api-key');
      expect(mockStoreAnalysisInCache).toHaveBeenCalledWith(
        `repo:${mockRepositories[0].full_name}:${mockRepositories[0].updated_at}`,
        mockAnalysis,
        mockEnv,
        3600
      );
    });

    // Unit test code: UT-24
    test("UT-24: should provide fallback analysis on error", async () => {
      mockGetAnalysisFromCache.mockResolvedValue(null);
      mockGenerateRepositoryAnalysis.mockRejectedValue(new Error('LLM API error'));

      const result = await enhanceRepositoriesWithAnalysis(mockRepositories as Repository[], mockEnv);

      expect(result).toHaveLength(1);
      expect(result[0].analysis).toEqual({
        category: "Unknown",
        summary: `Analysis unavailable for ${mockRepositories[0].name}. Please try again later.`
      });
      expect(console.error).toHaveBeenCalledWith(
        `Error enhancing repository ${mockRepositories[0].name}:`,
        expect.any(Error)
      );
    });

    // Unit test code: UT-25
    test("UT-25: should process multiple repositories in parallel", async () => {
      const multipleRepos: MockRepository[] = [
        { 
          id: 1, 
          name: 'repo1', 
          full_name: 'user/repo1', 
          stargazers_count: 100, 
          updated_at: '2023-01-01',
          description: 'First repo',
          language: 'JavaScript'
        },
        { 
          id: 2, 
          name: 'repo2', 
          full_name: 'user/repo2', 
          stargazers_count: 200, 
          updated_at: '2023-01-02',
          description: 'Second repo',
          language: 'Python'
        }
      ];

      const mockAnalysis1: RepositoryAnalysis = {
        category: 'Frontend',
        summary: 'Frontend framework'
      };

      const mockAnalysis2: RepositoryAnalysis = {
        category: 'Backend',
        summary: 'Backend service'
      };

      mockGetAnalysisFromCache
        .mockResolvedValueOnce(mockAnalysis1)
        .mockResolvedValueOnce(mockAnalysis2);

      const result = await enhanceRepositoriesWithAnalysis(multipleRepos as Repository[], mockEnv);

      expect(result).toHaveLength(2);
      expect(result[0].analysis).toEqual(mockAnalysis1);
      expect(result[1].analysis).toEqual(mockAnalysis2);
      expect(mockGetAnalysisFromCache).toHaveBeenCalledTimes(2);
    });

    // Unit test code: UT-26
    test("UT-26: should handle mixed cache hits and misses", async () => {
      const multipleRepos: MockRepository[] = [
        { 
          id: 1, 
          name: 'cached-repo', 
          full_name: 'user/cached-repo', 
          stargazers_count: 100, 
          updated_at: '2023-01-01',
          description: 'Cached repo',
          language: 'JavaScript'
        },
        { 
          id: 2, 
          name: 'new-repo', 
          full_name: 'user/new-repo', 
          stargazers_count: 200, 
          updated_at: '2023-01-02',
          description: 'New repo',
          language: 'Python'
        }
      ];

      const cachedAnalysis: RepositoryAnalysis = {
        category: 'Cached',
        summary: 'From cache'
      };

      const newAnalysis: RepositoryAnalysis = {
        category: 'Generated',
        summary: 'Newly generated'
      };

      mockGetAnalysisFromCache
        .mockResolvedValueOnce(cachedAnalysis)  // Cache hit for first repo
        .mockResolvedValueOnce(null);           // Cache miss for second repo

      mockGenerateRepositoryAnalysis.mockResolvedValue(newAnalysis);

      const result = await enhanceRepositoriesWithAnalysis(multipleRepos as Repository[], mockEnv);

      expect(result).toHaveLength(2);
      expect(result[0].analysis).toEqual(cachedAnalysis);
      expect(result[1].analysis).toEqual(newAnalysis);
      expect(mockGenerateRepositoryAnalysis).toHaveBeenCalledTimes(1);
      expect(mockStoreAnalysisInCache).toHaveBeenCalledTimes(1);
    });
  });

  // Unit testing for the formatRepositoryForLLM() function
  describe("formatRepositoryForLLM()", () => {
    // Unit test code: UT-27
    test("UT-27: should format repository with all fields present", () => {
      const mockRepo: MockRepository = {
        id: 1,
        name: 'test-repo',
        full_name: 'user/test-repo',
        description: 'A test repository for formatting',
        language: 'TypeScript',
        stargazers_count: 150,
        updated_at: '2023-01-01',
        readme: 'This is a comprehensive README file with installation and usage instructions.',
        tree: 'src/\n  index.ts\n  components/\n    Button.tsx\npackage.json\nREADME.md'
      };

      const result = formatRepositoryForLLM(mockRepo as Repository);

      expect(result).toContain('Repository Information:');
      expect(result).toContain('Name: user/test-repo');
      expect(result).toContain('Description: A test repository for formatting');
      expect(result).toContain('Language: TypeScript');
      expect(result).toContain('Stars: 150');
      expect(result).toContain('README:');
      expect(result).toContain('This is a comprehensive README file');
      expect(result).toContain('File Tree Structure:');
      expect(result).toContain('src/');
    });

    // Unit test code: UT-28
    test("UT-28: should handle missing optional fields gracefully", () => {
      const mockRepo: MockRepository = {
        id: 2,
        name: 'minimal-repo',
        full_name: 'user/minimal-repo',
        stargazers_count: 0,
        updated_at: '2023-01-01'
      };

      const result = formatRepositoryForLLM(mockRepo as Repository);

      expect(result).toContain('Name: user/minimal-repo');
      expect(result).toContain('Description: No description provided');
      expect(result).toContain('Language: Not specified');
      expect(result).toContain('Stars: 0');
      expect(result).toContain('README:\nNo README found');
      expect(result).toContain('File Tree Structure:\nNo file tree available');
    });

    // Unit test code: UT-29
    test("UT-29: should handle empty string values properly", () => {
      const mockRepo: MockRepository = {
        id: 3,
        name: 'empty-fields-repo',
        full_name: 'user/empty-fields-repo',
        description: '',
        language: '',
        readme: '',
        tree: '',
        stargazers_count: 5,
        updated_at: '2023-01-01'
      };

      const result = formatRepositoryForLLM(mockRepo as Repository);

      expect(result).toContain('Description: No description provided');
      expect(result).toContain('Language: Not specified');
      expect(result).toContain('README:\nNo README found');
      expect(result).toContain('File Tree Structure:\nNo file tree available');
    });

    // Unit test code: UT-30
    test("UT-30: should format repository with partial information", () => {
      const mockRepo: MockRepository = {
        id: 4,
        name: 'partial-repo',
        full_name: 'user/partial-repo',
        description: 'Partial repository example',
        language: 'Go',
        stargazers_count: 42,
        updated_at: '2023-01-01',
        readme: 'Basic README content'
        // tree is missing
      };

      const result = formatRepositoryForLLM(mockRepo as Repository);

      expect(result).toContain('Name: user/partial-repo');
      expect(result).toContain('Description: Partial repository example');
      expect(result).toContain('Language: Go');
      expect(result).toContain('Stars: 42');
      expect(result).toContain('README:\nBasic README content');
      expect(result).toContain('File Tree Structure:\nNo file tree available');
    });

    // Unit test code: UT-31
    test("UT-31: should maintain consistent formatting structure", () => {
      const mockRepo: MockRepository = {
        id: 5,
        name: 'structure-test',
        full_name: 'user/structure-test',
        description: 'Testing structure consistency',
        language: 'Rust',
        stargazers_count: 999,
        updated_at: '2023-01-01',
        readme: 'Structure test README',
        tree: 'Cargo.toml\nsrc/main.rs'
      };

      const result = formatRepositoryForLLM(mockRepo as Repository);
      const lines = result.split('\n');

      // Check that the structure follows the expected pattern
      expect(lines.some(line => line.includes('Repository Information:'))).toBe(true);
      expect(lines.some(line => line.includes('Name:'))).toBe(true);
      expect(lines.some(line => line.includes('Description:'))).toBe(true);
      expect(lines.some(line => line.includes('Language:'))).toBe(true);
      expect(lines.some(line => line.includes('Stars:'))).toBe(true);
      expect(lines.some(line => line.includes('README:'))).toBe(true);
      expect(lines.some(line => line.includes('File Tree Structure:'))).toBe(true);
    });
  });
});