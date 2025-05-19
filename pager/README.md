# Hot ForGithub Pager

A TypeScript tool that generates HTML pages for the Hot ForGithub website, designed to work with Cloudflare Workers and KV.

## Features

- Generates an index page with all categories and subcategories
- Generates individual pages for each subcategory
- Uses template-based approach for easy customization
- Command-line interface for flexible usage

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

```bash
# Using npm script
npm run generate-and-upload
```

### Command Line Options

- `-i, --index-template <path>` - Path to the index template HTML file
- `-s, --subcategory-template <path>` - Path to the subcategory template HTML file
- `-d, --data <path>` - Path to the categories JSON data file
- `-o, --output <path>` - Directory where generated HTML files will be saved
- `-h, --help` - Show help information

## Template Format

### Index Template

The index template should include the placeholder `<!-- CATEGORIES_PLACEHOLDER -->` where the generated category cards will be inserted.

### Subcategory Template

The subcategory template should include the following placeholders:
- `{{SUBCATEGORY_NAME}}` - Will be replaced with the name of the subcategory
- `{{SUBCATEGORY_DESCRIPTION}}` - Will be replaced with the description of the subcategory
- `{{CATEGORY_NAME}}` - Will be replaced with the name of the parent category
- `{{CATEGORY_COLOR}}` - Will be replaced with the color of the parent category (for Tailwind CSS classes)

## Data Format

The JSON data file should follow this structure:

```json
{
  "categories": [
    {
      "name": "Category Name",
      "description": "Category description",
      "icon": "SVG path data",
      "color": "tailwind-color-name",
      "subcategories": [
        {
          "name": "Subcategory Name",
          "path": "subcategory-path",
          "description": "Subcategory description"
        }
      ]
    }
  ]
}
```

## Integration with Cloudflare Workers and KV

After generating the HTML pages, you can upload them to your Cloudflare KV namespace using the provided upload scripts.

```bash
# Generate pages
npm run generate

# Upload pages to KV
npm run upload

# Or you can do it all together with
npm run generate-and-upload
```