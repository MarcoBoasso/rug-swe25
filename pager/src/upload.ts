import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import * as os from 'os';

// Configuration - CUSTOMIZE THESE VALUES
const config = {
  // Directory where the generated HTML files are located
  pagesDir: process.env.PAGES_DIR || path.join(process.cwd(), 'output'),
  
  // Upload method: 'binding' or 'direct'
  // 'binding' uses the binding name from wrangler.toml
  // 'direct' uses the namespace ID directly
  uploadMethod: 'direct',
  
  // If uploadMethod is 'binding', this is the binding name in wrangler.toml
  kvBinding: 'PAGES',
  
  // If uploadMethod is 'direct', this is the KV namespace ID
  // REPLACE WITH YOUR OWN ID
  namespaceId: '2b2cde8ad3374a99bc9146383b2a2537',
  
  // Use preview namespace instead of production?
  usePreview: false,
};

/**
 * Uploads a single file to the KV namespace.
 * Creates a temporary copy of the file and uses wrangler CLI to upload it.
 * 
 * @function uploadFile
 * @param {string} filePath - Path to the file to upload
 * @param {string} key - Key to use in the KV namespace
 * @returns {Promise<void>} A promise that resolves when the upload is complete
 */
function uploadFile(filePath: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create temporary directory if it doesn't exist
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hot-forgithub-'));
    const tempFilePath = path.join(tempDir, path.basename(filePath));
    
    // Copy the file to the temporary directory
    fs.copyFileSync(filePath, tempFilePath);
    
    // Prepare flags for the wrangler command
    const previewFlag = config.usePreview ? '--preview' : '--preview false';
    
    // Prepare the upload command based on the selected method
    let uploadCommand = '';
    
    if (config.uploadMethod === 'binding') {
      uploadCommand = `wrangler kv key put --binding ${config.kvBinding} ${previewFlag} "${key}" --path "${tempFilePath}" --remote`;
    } else if (config.uploadMethod === 'direct') {
      if (!config.namespaceId) {
        reject(new Error('Error: You must specify a namespaceId in the configuration to use the "direct" method'));
        return;
      }
      uploadCommand = `wrangler kv key put --namespace-id ${config.namespaceId} "${key}" --path "${tempFilePath}" --remote`;
    } else {
      reject(new Error(`Invalid upload method: ${config.uploadMethod}`));
      return;
    }
    
    // Execute the upload command
    exec(uploadCommand, (error, stdout, stderr) => {
      // Clean up temporary files
      try {
        fs.unlinkSync(tempFilePath);
        fs.rmdirSync(tempDir);
      } catch (cleanupError) {
        console.warn(`Warning: Unable to clean up temporary files: ${cleanupError}`);
      }
      
      if (error) {
        console.error(`Error uploading ${key}:`);
        console.error(`Command executed: ${uploadCommand}`);
        console.error(`Error message: ${error.message}`);
        
        if (stderr) {
          console.error(`Error output:\n${stderr}`);
        }
        
        if (config.uploadMethod === 'binding') {
          console.log('\nTIP: Verify that the binding is correct in your wrangler.toml:');
          console.log('kv_namespaces = [');
          console.log(`  { binding = "${config.kvBinding}", id = "YOUR_KV_ID_HERE" }`);
          console.log(']');
          console.log('\nOr try using the "direct" method by modifying the script:\n');
          console.log('config.uploadMethod = "direct";');
          console.log('config.namespaceId = "YOUR_KV_NAMESPACE_ID";');
        }
        
        reject(error);
        return;
      }
      
      if (stdout) {
        console.log(`Command output: ${stdout}`);
      }
      
      console.log(`File ${key} uploaded successfully.`);
      resolve();
    });
  });
}

/**
 * Uploads all HTML files from the specified directory to the KV namespace.
 * Scans the output directory for HTML files and uploads each one using the configured method.
 * 
 * @function uploadPages
 * @async
 * @returns {Promise<void>} A promise that resolves when all uploads are complete
 */
async function uploadPages() {
  console.log('Uploading generated pages to Cloudflare KV...');
  console.log(`Upload mode: ${config.uploadMethod}`);
  
  if (config.uploadMethod === 'binding') {
    console.log(`KV binding: ${config.kvBinding}`);
    console.log(`Namespace: ${config.usePreview ? 'preview' : 'production'}`);
  } else {
    console.log(`Namespace ID: ${config.namespaceId}`);
  }
  
  // Verify that the directory exists
  if (!fs.existsSync(config.pagesDir)) {
    console.error(`Error: Directory ${config.pagesDir} does not exist.`);
    console.log('Have you run the page generation command?');
    process.exit(1);
  }
  
  // Get all HTML files
  const files = fs.readdirSync(config.pagesDir).filter(file => file.endsWith('.html'));
  
  if (files.length === 0) {
    console.error('No HTML files found in the output directory.');
    console.log('Have you run the page generation command?');
    process.exit(1);
  }
  
  console.log(`Found ${files.length} HTML files to upload.`);
  
  // Upload each file
  for (const file of files) {
    const filePath = path.join(config.pagesDir, file);
    const key = file; // Use the filename as the key
    
    try {
      console.log(`Uploading ${key}...`);
      await uploadFile(filePath, key);
    } catch (error) {
      console.error(`Error uploading ${file}: ${error}`);
    }
  }
  
  console.log('\nUpload process completed.');
}

// Execute the script
uploadPages().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});