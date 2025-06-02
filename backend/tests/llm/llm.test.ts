// @ts-nocheck
import { 
    generateRepositoryAnalysis, 
    callDeepseekAPI, 
    truncateInput, 
    parseAnalysisResult, 
    LLM_CONFIG 
  } from "../../src/llm/llm";
  import { formatRepositoryForLLM } from "../../src/main/service";
  
  // Mock the service module
  jest.mock('../../src/main/service', () => ({
    formatRepositoryForLLM: jest.fn(),
  }));
  
  // Mock global fetch
  global.fetch = jest.fn();
  
  const mockFormatRepositoryForLLM = formatRepositoryForLLM as jest.MockedFunction<typeof formatRepositoryForLLM>;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
  
  // Define types for test data
  interface MockRepository {
    name: string;
    full_name: string;
    description?: string;
    stargazers_count: number;
    language?: string;
    readme?: string;
    tree?: string;
  }
  
  interface RepositoryAnalysis {
    category: string;
    summary: string;
  }
  
  interface TestResponseBody {
    error?: string;
    success?: boolean;
  }
  
  /**
   * Unit tests for the LLM layer.
   */
  describe("llm", () => {
    let mockRepository: MockRepository;
  
    beforeEach(() => {
      mockRepository = {
        name: 'test-repo',
        full_name: 'user/test-repo',
        description: 'A test repository',
        stargazers_count: 100,
        language: 'TypeScript',
        readme: 'This is a test README',
        tree: 'src/\n  index.ts\npackage.json'
      };
  
      // Reset all mocks
      jest.clearAllMocks();
      
      // Mock console methods
      global.console = {
        ...console,
        log: jest.fn(),
        error: jest.fn(),
      };
  
      // Mock setTimeout
      global.setTimeout = jest.fn().mockImplementation((callback) => {
        callback();
        return 123;
      });
    });
  
    // Unit testing for the generateRepositoryAnalysis() function
    describe("generateRepositoryAnalysis()", () => {
      // Unit test code: UT-48
      test("UT-48: should generate analysis successfully with valid API response", async () => {
        const expectedAnalysis: RepositoryAnalysis = {
          category: 'Frontend',
          summary: 'A modern React-based web application with TypeScript support'
        };
  
        mockFormatRepositoryForLLM.mockReturnValue('Formatted repository data');
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify(expectedAnalysis)
              }
            }]
          })
        } as Response);
  
        const result = await generateRepositoryAnalysis(mockRepository as any, 'test-api-key');
  
        expect(result).toEqual(expectedAnalysis);
        expect(mockFormatRepositoryForLLM).toHaveBeenCalledWith(mockRepository);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
  
      // Unit test code: UT-49
      test("UT-49: should return fallback analysis when API call fails", async () => {
        mockFormatRepositoryForLLM.mockReturnValue('Formatted repository data');
        mockFetch.mockRejectedValue(new Error('API Error'));
  
        const result = await generateRepositoryAnalysis(mockRepository as any, 'test-api-key');
  
        expect(result).toEqual({
          category: "Unknown",
          summary: "Analysis unavailable for test-repo. Please try again later."
        });
        expect(console.error).toHaveBeenCalledWith(
          'Error analyzing repository test-repo:',
          expect.any(Error)
        );
      });
  
      // Unit test code: UT-50
      test("UT-50: should return fallback analysis when parsing fails", async () => {
        mockFormatRepositoryForLLM.mockReturnValue('Formatted repository data');
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: 'Invalid JSON response'
              }
            }]
          })
        } as Response);
  
        const result = await generateRepositoryAnalysis(mockRepository as any, 'test-api-key');
  
        expect(result).toEqual({
          category: "Unknown",
          summary: "Could not extract summary for test-repo"
        });
      });
    });
  
    // Unit testing for the callDeepseekAPI() function
    describe("callDeepseekAPI()", () => {
      // Unit test code: UT-51
      test("UT-51: should make successful API call with correct parameters", async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: '{"category": "Backend", "summary": "A Node.js API server"}'
            }
          }]
        };
  
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => mockResponse
        } as Response);
  
        const result = await callDeepseekAPI('test input', 'test-api-key');
  
        expect(result).toBe('{"category": "Backend", "summary": "A Node.js API server"}');
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.deepseek.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-api-key'
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              max_tokens: 4000,
              messages: [
                {
                  role: 'system',
                  content: LLM_CONFIG.prompt
                },
                {
                  role: 'user',
                  content: 'test input'
                }
              ]
            })
          }
        );
      });
  
      // Unit test code: UT-52
      test("UT-52: should handle API error response", async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => 'Bad Request'
        } as Response);
  
        await expect(callDeepseekAPI('test input', 'test-api-key'))
          .rejects.toThrow('Deepseek API returned 400: Bad Request');
      });
  
      // Unit test code: UT-53
      test("UT-53: should retry on failure and eventually succeed", async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: 'Success after retry'
            }
          }]
        };
  
        // First call fails, second succeeds
        mockFetch
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
          } as Response);
  
        const result = await callDeepseekAPI('test input', 'test-api-key');
  
        expect(result).toBe('Success after retry');
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(console.log).toHaveBeenCalledWith(
          'Retry 1/3 for Deepseek API call after 1000ms'
        );
      });
  
      // Unit test code: UT-54
      test("UT-54: should fail after max retries exceeded", async () => {
        mockFetch.mockRejectedValue(new Error('Persistent network error'));
  
        await expect(callDeepseekAPI('test input', 'test-api-key'))
          .rejects.toThrow('Persistent network error');
  
        expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
        expect(console.log).toHaveBeenCalledTimes(3); // 3 retry messages
      });
  
      // Unit test code: UT-55
      test("UT-55: should truncate long input before API call", async () => {
        const longInput = 'a'.repeat(150000); // Very long input
        const mockResponse = {
          choices: [{
            message: {
              content: 'Response'
            }
          }]
        };
  
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => mockResponse
        } as Response);
  
        await callDeepseekAPI(longInput, 'test-api-key');
  
        const callArgs = mockFetch.mock.calls[0][1];
        const requestBody = JSON.parse(callArgs.body as string);
        const userMessage = requestBody.messages[1].content;
  
        // Should be truncated and have truncation message
        expect(userMessage.length).toBeLessThan(longInput.length);
        expect(userMessage).toContain('[Input truncated to fit token limit]');
      });
    });
  
    // Unit testing for the truncateInput() function
    describe("truncateInput()", () => {
      // Unit test code: UT-56
      test("UT-56: should not truncate input within token limit", () => {
        const input = 'This is a short input';
        const result = truncateInput(input, 1000);
        
        expect(result).toBe(input);
      });
  
      // Unit test code: UT-57
      test("UT-57: should truncate input exceeding token limit", () => {
        const input = 'a'.repeat(1000);
        const result = truncateInput(input, 100); // 100 tokens = ~400 chars
        
        expect(result.length).toBeLessThan(input.length);
        expect(result).toContain('[Input truncated to fit token limit]');
        expect(result.length).toBeLessThanOrEqual(400 + '\n\n[Input truncated to fit token limit]'.length);
      });
  
      // Unit test code: UT-58
      test("UT-58: should handle empty input", () => {
        const result = truncateInput('', 100);
        
        expect(result).toBe('');
      });
  
      // Unit test code: UT-59
      test("UT-59: should handle exact token limit boundary", () => {
        const input = 'a'.repeat(400); // Exactly 100 tokens
        const result = truncateInput(input, 100);
        
        expect(result).toBe(input); // Should not truncate
      });
  
      // Unit test code: UT-60
      test("UT-60: should calculate token estimation correctly", () => {
        const input = 'a'.repeat(401); // Just over 100 tokens
        const result = truncateInput(input, 100);
        
        expect(result).not.toBe(input); // Should truncate
        expect(result).toContain('[Input truncated to fit token limit]');
      });
    });
  
    // Unit testing for the parseAnalysisResult() function
    describe("parseAnalysisResult()", () => {
      // Unit test code: UT-61
      test("UT-61: should parse valid JSON response correctly", () => {
        const jsonResponse = JSON.stringify({
          category: 'Data & AI',
          summary: 'A machine learning framework for deep neural networks'
        });
  
        const result = parseAnalysisResult(jsonResponse, 'test-repo');
  
        expect(result).toEqual({
          category: 'Data & AI',
          summary: 'A machine learning framework for deep neural networks'
        });
      });
  
      // Unit test code: UT-62
      test("UT-62: should handle malformed JSON with regex fallback", () => {
        const malformedResponse = `
          The repository appears to be:
          category: "Frontend"
          summary: "A React-based user interface library"
          Additional text here...
        `;
  
        const result = parseAnalysisResult(malformedResponse, 'test-repo');
  
        expect(result).toEqual({
          category: 'Frontend',
          summary: 'A React-based user interface library'
        });
      });
  
      // Unit test code: UT-63
      test("UT-63: should handle response with single quotes", () => {
        const responseWithSingleQuotes = `
          {
            'category': 'Backend',
            'summary': 'A REST API server built with Express.js'
          }
        `;
  
        const result = parseAnalysisResult(responseWithSingleQuotes, 'test-repo');
  
        expect(result.category).toBe('Backend');
        expect(result.summary).toBe('A REST API server built with Express.js');
      });
  
      // Unit test code: UT-64
      test("UT-64: should return fallback values when regex extraction fails", () => {
        const unparsableResponse = 'This is completely unparsable text with no structure';
  
        const result = parseAnalysisResult(unparsableResponse, 'test-repo');
  
        expect(result).toEqual({
          category: 'Unknown',
          summary: 'Could not extract summary for test-repo'
        });
        expect(console.error).toHaveBeenCalledWith(
          'Error parsing analysis result for test-repo:',
          expect.any(SyntaxError)
        );
      });
  
      // Unit test code: UT-65
      test("UT-65: should handle partial regex matches", () => {
        const partialResponse = `
          category: "Mobile"
          Some other text without summary
        `;
  
        const result = parseAnalysisResult(partialResponse, 'mobile-app');
  
        expect(result).toEqual({
          category: 'Mobile',
          summary: 'Could not extract summary for mobile-app'
        });
      });
  
      // Unit test code: UT-66
      test("UT-66: should handle response with extra whitespace and formatting", () => {
        const messyResponse = `
          {
            "category"  :   "DevOps & Automation"  ,
            "summary"   :   "A CI/CD pipeline automation tool"
          }
        `;
  
        const result = parseAnalysisResult(messyResponse, 'devops-tool');
  
        expect(result).toEqual({
          category: 'DevOps & Automation',
          summary: 'A CI/CD pipeline automation tool'
        });
      });
  
      // Unit test code: UT-67
      test("UT-67: should handle empty string response", () => {
        const result = parseAnalysisResult('', 'empty-repo');
  
        expect(result).toEqual({
          category: 'Unknown',
          summary: 'Could not extract summary for empty-repo'
        });
      });
  
      // Unit test code: UT-68
      test("UT-68: should handle response with mixed case field names", () => {
        const mixedCaseResponse = `
          Category: "Blockchain & Web3"
          Summary: "A decentralized application framework"
        `;
  
        const result = parseAnalysisResult(mixedCaseResponse, 'blockchain-app');
  
        expect(result.category).toBe('Blockchain & Web3');
        expect(result.summary).toBe('A decentralized application framework');
      });
    });
  
    // Unit testing for LLM_CONFIG constant
    describe("LLM_CONFIG", () => {
      // Unit test code: UT-69
      test("UT-69: should have correct configuration values", () => {
        expect(LLM_CONFIG.provider).toBe('deepseek');
        expect(LLM_CONFIG.deepseek.apiEndpoint).toBe('https://api.deepseek.com/v1/chat/completions');
        expect(LLM_CONFIG.deepseek.model).toBe('deepseek-chat');
        expect(LLM_CONFIG.deepseek.maxTokens).toBe(4000);
        expect(LLM_CONFIG.retry.maxRetries).toBe(3);
        expect(LLM_CONFIG.retry.initialDelayMs).toBe(1000);
        expect(LLM_CONFIG.retry.backoffFactor).toBe(2);
      });
  
      // Unit test code: UT-70
      test("UT-70: should have non-empty prompt configuration", () => {
        expect(LLM_CONFIG.prompt).toBeDefined();
        expect(LLM_CONFIG.prompt.trim().length).toBeGreaterThan(0);
        expect(LLM_CONFIG.prompt).toContain('JSON format');
        expect(LLM_CONFIG.prompt).toContain('category');
        expect(LLM_CONFIG.prompt).toContain('summary');
      });
    });
  });