// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { Pager } from "../src/pager";

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path module
jest.mock('path');
const mockPath = path as jest.Mocked<typeof path>;

// Define types for test data
interface TestSubcategory {
  name: string;
  description: string;
  path: string;
}

interface TestCategory {
  name: string;
  description: string;
  color: string;
  icon: string;
  subcategories: TestSubcategory[];
}

interface TestCategoriesData {
  categories: TestCategory[];
}

/**
 * Unit tests for the Pager class.
 */
describe("Pager", () => {
  let mockCategoriesData: TestCategoriesData;
  let mockIndexTemplate: string;
  let mockSubcategoryTemplate: string;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock console methods
    global.console = {
      ...console,
      log: jest.fn(),
    };

    // Mock data
    mockCategoriesData = {
      categories: [
        {
          name: 'Frontend',
          description: 'User interface frameworks and libraries',
          color: 'blue',
          icon: 'M12 2L2 7v10l10 5 10-5V7l-10-5z',
          subcategories: [
            {
              name: 'React',
              description: 'React-based projects and libraries',
              path: 'frontend/react'
            },
            {
              name: 'Vue',
              description: 'Vue.js applications and components',
              path: 'frontend/vue'
            }
          ]
        },
        {
          name: 'Backend',
          description: 'Server-side frameworks and APIs',
          color: 'green',
          icon: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z',
          subcategories: [
            {
              name: 'Node.js',
              description: 'Node.js servers and APIs',
              path: 'backend/nodejs'
            }
          ]
        }
      ]
    };

    mockIndexTemplate = `
      <!DOCTYPE html>
      <html>
        <head><title>Index</title></head>
        <body>
          <!-- CATEGORIES_PLACEHOLDER -->
        </body>
      </html>
    `;

    mockSubcategoryTemplate = `
      <!DOCTYPE html>
      <html>
        <head><title>{{SUBCATEGORY_NAME}}</title></head>
        <body>
          <h1>{{SUBCATEGORY_NAME}}</h1>
          <p>{{SUBCATEGORY_DESCRIPTION}}</p>
          <p>Category: {{CATEGORY_NAME}}</p>
          <p>Color: {{CATEGORY_COLOR}}</p>
        </body>
      </html>
    `;

    // Setup fs mocks
    mockFs.readFileSync
      .mockReturnValueOnce(mockIndexTemplate) // index template
      .mockReturnValueOnce(mockSubcategoryTemplate) // subcategory template
      .mockReturnValueOnce(JSON.stringify(mockCategoriesData)); // data file

    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation();
    mockFs.writeFileSync.mockImplementation();

    // Setup path mocks
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.dirname.mockImplementation((p) => p.split('/').slice(0, -1).join('/'));
  });

  // Unit testing for constructor
  describe("constructor", () => {
    // Unit test code: UT-92
    test("UT-92: should initialize Pager with correct file reads", () => {
      const pager = new Pager(
        'templates/index.html',
        'templates/subcategory.html',
        'data/categories.json',
        'output'
      );

      expect(mockFs.readFileSync).toHaveBeenCalledTimes(3);
      expect(mockFs.readFileSync).toHaveBeenCalledWith('templates/index.html', 'utf8');
      expect(mockFs.readFileSync).toHaveBeenCalledWith('templates/subcategory.html', 'utf8');
      expect(mockFs.readFileSync).toHaveBeenCalledWith('data/categories.json', 'utf8');
    });

    // Unit test code: UT-93
    test("UT-93: should create output directory if it doesn't exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      new Pager(
        'templates/index.html',
        'templates/subcategory.html',
        'data/categories.json',
        'new-output'
      );

      expect(mockFs.existsSync).toHaveBeenCalledWith('new-output');
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('new-output', { recursive: true });
    });
  });

  // Unit testing for generateAllPages
  describe("generateAllPages()", () => {
    // Unit test code: UT-94
    test("UT-94: should generate index and all subcategory pages", () => {
      const pager = new Pager(
        'templates/index.html',
        'templates/subcategory.html',
        'data/categories.json',
        'output'
      );

      pager.generateAllPages();

      // Should write index.html and 3 subcategory pages
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(4);
      
      // Check index page generation
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'output/index.html',
        expect.stringContaining('Frontend')
      );

      // Check subcategory pages generation
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'output/frontend/react.html',
        expect.any(String)
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'output/frontend/vue.html',
        expect.any(String)
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'output/backend/nodejs.html',
        expect.any(String)
      );

      expect(console.log).toHaveBeenCalledWith('All pages generated successfully!');
    });
  });

  // Unit testing for index page generation
  describe("index page generation", () => {
    // Unit test code: UT-95
    test("UT-95: should replace categories placeholder with generated HTML", () => {
      const pager = new Pager(
        'templates/index.html',
        'templates/subcategory.html',
        'data/categories.json',
        'output'
      );

      pager.generateAllPages();

      const indexCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0] === 'output/index.html'
      );
      const generatedHtml = indexCall[1] as string;

      // Check that placeholder is replaced
      expect(generatedHtml).not.toContain('<!-- CATEGORIES_PLACEHOLDER -->');
      
      // Check that categories are included
      expect(generatedHtml).toContain('Frontend');
      expect(generatedHtml).toContain('Backend');
      expect(generatedHtml).toContain('React');
      expect(generatedHtml).toContain('Vue');
      expect(generatedHtml).toContain('Node.js');
    });

    // Unit test code: UT-96
    test("UT-96: should generate correct category HTML structure", () => {
      const pager = new Pager(
        'templates/index.html',
        'templates/subcategory.html',
        'data/categories.json',
        'output'
      );

      pager.generateAllPages();

      const indexCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0] === 'output/index.html'
      );
      const generatedHtml = indexCall[1] as string;

      // Check category styling
      expect(generatedHtml).toContain('bg-blue-500');
      expect(generatedHtml).toContain('bg-green-500');
      expect(generatedHtml).toContain('text-blue-300');
      expect(generatedHtml).toContain('href="frontend/react"');
      expect(generatedHtml).toContain('href="backend/nodejs"');
    });
  });

  // Unit testing for subcategory page generation
  describe("subcategory page generation", () => {
    // Unit test code: UT-97
    test("UT-97: should replace all template placeholders correctly", () => {
      const pager = new Pager(
        'templates/index.html',
        'templates/subcategory.html',
        'data/categories.json',
        'output'
      );

      pager.generateAllPages();

      const reactPageCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0] === 'output/frontend/react.html'
      );
      const reactHtml = reactPageCall[1] as string;

      expect(reactHtml).toContain('<title>React</title>');
      expect(reactHtml).toContain('<h1>React</h1>');
      expect(reactHtml).toContain('<p>React-based projects and libraries</p>');
      expect(reactHtml).toContain('<p>Category: Frontend</p>');
      expect(reactHtml).toContain('<p>Color: blue</p>');
      
      // Should not contain any unreplaced placeholders
      expect(reactHtml).not.toContain('{{SUBCATEGORY_NAME}}');
      expect(reactHtml).not.toContain('{{SUBCATEGORY_DESCRIPTION}}');
      expect(reactHtml).not.toContain('{{CATEGORY_NAME}}');
      expect(reactHtml).not.toContain('{{CATEGORY_COLOR}}');
    });

    // Unit test code: UT-98
    test("UT-98: should create necessary directories for subcategory pages", () => {
      mockFs.existsSync.mockReturnValue(false);

      const pager = new Pager(
        'templates/index.html',
        'templates/subcategory.html',
        'data/categories.json',
        'output'
      );

      pager.generateAllPages();

      // Should check for subcategory directories
      expect(mockPath.dirname).toHaveBeenCalledWith('output/frontend/react');
      expect(mockPath.dirname).toHaveBeenCalledWith('output/frontend/vue');
      expect(mockPath.dirname).toHaveBeenCalledWith('output/backend/nodejs');
      
      // Should create directories when they don't exist
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('output/frontend', { recursive: true });
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('output/backend', { recursive: true });
    });
  });
});