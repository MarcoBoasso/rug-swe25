/**
 * Worker script for Hot ForGithub
 * Handles requests and serves pages from KV
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * Handles all incoming requests
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle static asset requests (CSS, JS, images)
  if (path.match(/\.(css|js|ico|png|jpe?g|gif|svg)$/)) {
    try {
      const asset = await PAGES.get(path.substring(1), { type: 'arrayBuffer' });
      if (asset) {
        // Determine content type based on file extension
        const contentType = getContentType(path);
        return new Response(asset, {
          headers: { 'Content-Type': contentType }
        });
      }
    } catch (error) {
      console.error(`Error retrieving asset ${path}:`, error);
    }
  }

  // Handle homepage
  if (path === '/' || path === '/index.html') {
    try {
      // Get homepage from KV
      const homepage = await PAGES.get('index.html');
      if (homepage) {
        return new Response(homepage, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    } catch (error) {
      console.error('Error retrieving homepage:', error);
    }
  }

  // Handle subcategory pages
  if (path.startsWith('/') && path.length > 1) {
    const subcategory = path.substring(1); // Remove initial slash
    
    try {
      let subcategoryPage = await PAGES.get(`${subcategory}.html`);
      
      if (!subcategoryPage) {
        subcategoryPage = await PAGES.get('template.html');
        
        if (subcategoryPage) {
          // Replace the SUBCATEGORY_NAME placeholder with the subcategory name
          subcategoryPage = subcategoryPage.replace(/\{\{SUBCATEGORY_NAME\}\}/g, subcategory);
          
          return new Response(subcategoryPage, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }
      } else {
        // Specific page found
        return new Response(subcategoryPage, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    } catch (error) {
      console.error(`Error retrieving page ${subcategory}:`, error);
    }
  }

  // If the page was not found
  return new Response('Page not found', { 
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

/**
 * Determines content type based on file extension
 * @param {string} path
 * @returns {string} content type
 */
function getContentType(path) {
  const extension = path.split('.').pop().toLowerCase();
  const contentTypes = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon'
  };
  
  return contentTypes[extension] || 'text/plain';
}