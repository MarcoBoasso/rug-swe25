#!/usr/bin/env node

import path from 'path';
import { Pager } from './pager';


/**
 * Main entry point for the Pager application.
 * Parses command line arguments and initializes the page generation process.
 * @function main
 * @returns {void}
 */
function main() {
  // Default paths
  const defaultIndexTemplatePath = path.join(__dirname, 'templates', 'index.template.html');
  const defaultSubcategoryTemplatePath = path.join(__dirname, 'templates', 'subcategory.template.html');
  const defaultDataPath = path.join(__dirname, 'data', 'categories.json');
  const defaultOutputDir = path.join(process.cwd(), 'output');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  // Parse arguments
  let indexTemplatePath = defaultIndexTemplatePath;
  let subcategoryTemplatePath = defaultSubcategoryTemplatePath;
  let dataPath = defaultDataPath;
  let outputDir = defaultOutputDir;

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    if (!value) {
      console.error(`Missing value for ${flag}`);
      process.exit(1);
    }

    switch (flag) {
      case '--index-template':
      case '-i':
        indexTemplatePath = value;
        break;
      case '--subcategory-template':
      case '-s':
        subcategoryTemplatePath = value;
        break;
      case '--data':
      case '-d':
        dataPath = value;
        break;
      case '--output':
      case '-o':
        outputDir = value;
        break;
      default:
        console.error(`Unknown flag: ${flag}`);
        process.exit(1);
    }
  }

  // Create pager and generate pages
  try {
    const pager = new Pager(indexTemplatePath, subcategoryTemplatePath, dataPath, outputDir);
    pager.generateAllPages();
  } catch (error) {
    console.error('Error generating pages:', error);
    process.exit(1);
  }
}

/**
 * Prints help information about the Pager tool.
 * Displays usage, available options, and examples.
 * @function printHelp
 * @returns {void}
 */
function printHelp() {
  console.log(`
Pager - HTML Generator for Hot ForGithub

Usage: 
  pager [options]

Options:
  -i, --index-template <path>        Path to the index template HTML file
  -s, --subcategory-template <path>  Path to the subcategory template HTML file
  -d, --data <path>                  Path to the categories JSON data file
  -o, --output <path>                Directory where generated HTML files will be saved
  -h, --help                         Show this help message

Examples:
  pager --index-template ./templates/index.html --subcategory-template ./templates/subcategory.html --data ./data/categories.json --output ./dist
  `);
}

// Run the application
main();