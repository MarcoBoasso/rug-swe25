addEventListener('scheduled', event => {
  event.waitUntil(handleScheduledEvent(event));
});

export async function handleScheduledEvent(event) {
  const apiUrl = 'https://popular-repos-analyzer.marcoboasso02.workers.dev/?limit=500';
  
  try {
    console.log('Staring call API:', new Date().toISOString());
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Cloudflare-Worker-Scheduler/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.text();
    console.log('API call completed successfully:', new Date().toISOString());
    console.log('Response data:', data.slice(0, 100)); 
    
    
    return new Response('API call completed successfully', { status: 200 });
    
  } catch (error) {
    console.error('Error during API call:', error);
    
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}


addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

export async function handleRequest(request) {
  return new Response('Worker is running. Scheduled API calls happen at 2:00 AM daily.', {
    headers: { 'content-type': 'text/plain' },
  });
}