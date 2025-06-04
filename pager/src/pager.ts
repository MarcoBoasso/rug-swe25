import fs from 'fs';
import path from 'path';
import { Category, CategoriesData, Subcategory } from './types';

/**
 * Pager: HTML Generator for Hot ForGithub
 * Generates index and subcategory pages based on templates and category data
 */
export class Pager {
  private indexTemplate: string;
  private subcategoryTemplate: string;
  private data: CategoriesData;
  private outputDir: string;

  /**
   * Constructor for the Pager class
   * @param indexTemplatePath Path to the index template
   * @param subcategoryTemplatePath Path to the subcategory template
   * @param dataPath Path to the categories JSON data
   * @param outputDir Directory where generated HTML files will be saved
   */
  constructor(
    indexTemplatePath: string,
    subcategoryTemplatePath: string,
    dataPath: string,
    outputDir: string
  ) {
    this.indexTemplate = fs.readFileSync(indexTemplatePath, 'utf8');
    this.subcategoryTemplate = fs.readFileSync(subcategoryTemplatePath, 'utf8');
    this.data = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as CategoriesData;
    this.outputDir = outputDir;

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Generate all HTML pages (index and subcategories)
   */
  public generateAllPages(): void {
    this.generateIndexPage();
    this.generateSubcategoryPages();
    console.log('All pages generated successfully!');
  }

  /**
   * Generate the index page with all categories
   */
  private generateIndexPage(): void {
    const categoriesHtml = this.generateCategoriesHtml();
    const indexHtml = this.indexTemplate.replace('<!-- CATEGORIES_PLACEHOLDER -->', categoriesHtml);
    
    const outputPath = path.join(this.outputDir, 'index.html');
    fs.writeFileSync(outputPath, indexHtml);
    
    console.log(`Index page generated at: ${outputPath}`);
  }

  /**
   * Generate HTML for all categories to be placed in the index template
   */
  private generateCategoriesHtml(): string {
    return this.data.categories.map(category => {
      const subcategoriesHtml = category.subcategories.map(subcategory => `
        <a href="${subcategory.path}" class="block">
          <div class="subcategory-card rounded-lg p-3 hover:bg-slate-700 transition-colors cursor-pointer">
            <h3 class="font-semibold text-${category.color}-300">${subcategory.name}</h3>
            <p class="text-sm text-gray-400">${subcategory.description}</p>
          </div>
        </a>
      `).join('\n');

      return `
        <!-- ${category.name} -->
        <div class="bg-slate-800 rounded-xl p-6 shadow-lg card-hover category-card">
          <div class="flex items-center mb-6">
            <div class="w-12 h-12 bg-${category.color}-500 rounded-lg flex items-center justify-center mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${category.icon}" />
              </svg>
            </div>
            <h2 class="text-2xl font-bold">${category.name}</h2>
          </div>
          <p class="text-gray-300 mb-6">${category.description}</p>
          
          <div class="space-y-3">
            ${subcategoriesHtml}
          </div>
        </div>
      `;
    }).join('\n');
  }

  /**
   * Generate all subcategory pages
   */
  private generateSubcategoryPages(): void {
    for (const category of this.data.categories) {
      for (const subcategory of category.subcategories) {
        this.generateSubcategoryPage(category, subcategory);
      }
    }
  }

  /**
   * Generate a single subcategory page
   * @param category The parent category
   * @param subcategory The subcategory
   */
  private generateSubcategoryPage(category: Category, subcategory: Subcategory): void {
    let subcategoryHtml = this.subcategoryTemplate;
    
    // Replace placeholders
    subcategoryHtml = subcategoryHtml
      .replace(/\{\{SUBCATEGORY_NAME\}\}/g, subcategory.name)
      .replace(/\{\{SUBCATEGORY_DESCRIPTION\}\}/g, subcategory.description)
      .replace(/\{\{CATEGORY_NAME\}\}/g, category.name)
      .replace(/\{\{SUBCATEGORY_PATH\}\}/g, subcategory.path)
      .replace(/\{\{CATEGORY_COLOR\}\}/g, category.color);
    
    // Create output directory for the subcategory if it doesn't exist
    const subcategoryDir = path.dirname(path.join(this.outputDir, subcategory.path));
    if (!fs.existsSync(subcategoryDir)) {
      fs.mkdirSync(subcategoryDir, { recursive: true });
    }
    
    // Write the file
    const outputPath = path.join(this.outputDir, `${subcategory.path}.html`);
    fs.writeFileSync(outputPath, subcategoryHtml);
    
    console.log(`Subcategory page generated at: ${outputPath}`);
  }
}