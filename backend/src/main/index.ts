// src/index.ts - Main entry point for the Cloudflare Worker

// Import Cloudflare Workers types
import { 
  KVNamespace, 
  ExecutionContext 
} from '@cloudflare/workers-types';

import { fetchPopularRepositories, enhanceRepositoriesWithAnalysis } from './service';
import { simplifyRepository } from './transformer';

// Import environment configuration for local development
// In production, these values come from Cloudflare Worker secrets
import { LLM_API_KEY as DEV_LLM_API_KEY, DEV_CONFIG } from '../../env/env';

// Environment interface for Cloudflare Worker
export interface Env {
  // KV Namespace for caching
  REPO_CACHE: KVNamespace;
  // API key for Deepseek LLM
  LLM_API_KEY?: string;
}

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Handle OPTIONS requests for CORS
export function handleOptions(request: Request) {
  return new Response(null, {
    headers: corsHeaders
  });
}

// Main worker handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }
    
    try {
      // Parse URL to get optional limit parameter
      const url = new URL(request.url);
      const limitParam = url.searchParams.get('limit');
      
      const limit = limitParam ? parseInt(limitParam, 10) : DEV_CONFIG.defaultRepoLimit;
      
      // Validate limit parameter
      if (isNaN(limit) || limit < 1) {
        return new Response(JSON.stringify({
          error: "Invalid limit parameter. Must be a positive number."
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      const repositories = await fetchPopularRepositories(env);
      
      const limitedRepos = repositories.slice(0, limit);
      
      const apiKey = env.LLM_API_KEY || DEV_LLM_API_KEY;  // Use environment variable or development config
      
      if (!apiKey) {
        throw new Error('LLM API key is not configured. Set it using wrangler secret or in env.ts for development.');
      }
      
      const enhancedEnv: Env = {
        ...env,
        LLM_API_KEY: apiKey
      };
      
      const enhancedRepos = await enhanceRepositoriesWithAnalysis(limitedRepos, enhancedEnv);
      
      const simplifiedRepos = enhancedRepos.map(repo => simplifyRepository(repo));
      
      // Return the result
      return new Response(JSON.stringify({
        repositories: simplifiedRepos,
        count: simplifiedRepos.length,
        total_available: repositories.length,
        limit: limit,
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('Error processing request:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};