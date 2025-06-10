// src/cache.ts - KV cache operations for repository analysis

import { Env } from '../main/index';
import { Repository, RepositoryAnalysis, CacheConfig } from '../../env/types';
import { DEV_CONFIG } from '../../env/env';

// Cache configuration
export const CACHE_CONFIG: CacheConfig = {
  analysisTTL: DEV_CONFIG.analysisCacheTTL || 864000,
  popularReposTTL: DEV_CONFIG.popularReposCacheTTL || 86400
};

/**
 * Retrieves repository analysis from KV cache
 * @param cacheKey The unique key for caching
 * @param env Environment with KV namespace
 * @returns The cached analysis or null if not found
 */
export async function getAnalysisFromCache(
  cacheKey: string,
  env: Env
): Promise<RepositoryAnalysis | null> {
  try {
    // Check if KV namespace is available
    if (!env.REPO_CACHE) {
      if (DEV_CONFIG.enableVerboseLogging) {
        console.log('KV namespace not available, skipping cache lookup');
      }
      return null;
    }
    
    // Attempt to retrieve value from KV cache
    const cachedAnalysis = await env.REPO_CACHE.get(cacheKey);
    
    // If found in cache, parse and return the analysis
    if (cachedAnalysis) {
      if (DEV_CONFIG.enableVerboseLogging) {
        console.log(`Cache hit for ${cacheKey}`);
      }
      return JSON.parse(cachedAnalysis);
    }
    
    // Not found in cache
    if (DEV_CONFIG.enableVerboseLogging) {
      console.log(`Cache miss for ${cacheKey}`);
    }
    return null;
  } catch (error) {
    console.error('Error retrieving from cache:', error);
    return null;
  }
}

/**
 * Stores repository analysis in KV cache
 * @param cacheKey The unique key for caching
 * @param analysis The analysis to store
 * @param env Environment with KV namespace
 * @param ttl Optional TTL in seconds (defaults to CACHE_CONFIG.analysisTTL)
 */
export async function storeAnalysisInCache(
  cacheKey: string,
  analysis: RepositoryAnalysis,
  env: Env,
  ttl: number = CACHE_CONFIG.analysisTTL
): Promise<void> {
  try {
    // Check if KV namespace is available
    if (!env.REPO_CACHE) {
      if (DEV_CONFIG.enableVerboseLogging) {
        console.log('KV namespace not available, skipping cache storage');
      }
      return;
    }
    
    // Store the analysis in KV 
    await env.REPO_CACHE.put(
      cacheKey,
      JSON.stringify(analysis),
      { expirationTtl: ttl }
    );
    
    if (DEV_CONFIG.enableVerboseLogging) {
      console.log(`Cached analysis for ${cacheKey} with TTL ${ttl}s`);
    }
  } catch (error) {
    console.error('Error storing in cache:', error);
    // Continue
  }
}

/**
 * Gets popular repositories from cache
 * @param env Environment with KV namespace
 * @returns Cached repositories or null if not found
 */
export async function getPopularReposFromCache(
  env: Env
): Promise<Repository[] | null> {
  try {
    // Check if KV namespace is available
    if (!env.REPO_CACHE) {
      if (DEV_CONFIG.enableVerboseLogging) {
        console.log('KV namespace not available, skipping popular repos cache lookup');
      }
      return null;
    }
    
    const cacheKey = DEV_CONFIG.popularReposCacheKey;
    

    if (await shouldRefreshCache(env)) {
      if (DEV_CONFIG.enableVerboseLogging) {
        console.log('Cache refresh time reached, forcing refresh');
      }
      return null;
    }
    
    // Attempt to retrieve value from KV cache
    const cachedRepos = await env.REPO_CACHE.get(cacheKey);
    
    if (cachedRepos) {
      if (DEV_CONFIG.enableVerboseLogging) {
        console.log(`Popular repos cache hit for ${cacheKey}`);
      }
      return JSON.parse(cachedRepos);
    }
    
    if (DEV_CONFIG.enableVerboseLogging) {
      console.log(`Popular repos cache miss for ${cacheKey}`);
    }
    return null;
  } catch (error) {
    console.error('Error retrieving popular repos from cache:', error);
    return null;
  }
}

/**
 * Stores popular repositories in KV cache
 * @param repositories The repositories to store
 * @param env Environment with KV namespace
 */
export async function storePopularReposInCache(
  repositories: Repository[],
  env: Env
): Promise<void> {
  try {
    // Check if KV namespace is available
    if (!env.REPO_CACHE) {
      if (DEV_CONFIG.enableVerboseLogging) {
        console.log('KV namespace not available, skipping popular repos cache storage');
      }
      return;
    }
    
    const cacheKey = DEV_CONFIG.popularReposCacheKey;
    
    await env.REPO_CACHE.put(
      cacheKey,
      JSON.stringify(repositories),
      { expirationTtl: CACHE_CONFIG.popularReposTTL }
    );
    
    if (DEV_CONFIG.enableVerboseLogging) {
      console.log(`Cached ${repositories.length} popular repositories with TTL ${CACHE_CONFIG.popularReposTTL}s`);
    }
    
    // store the last refresh time
    await env.REPO_CACHE.put(
      `${cacheKey}-last-refresh`,
      new Date().toISOString(),
      { expirationTtl: CACHE_CONFIG.popularReposTTL }
    );
  } catch (error) {
    console.error('Error storing popular repos in cache:', error);
    // Continue
  }
}

/**
 * Checks if the cache should be refreshed based on the time of day
 * @param env Environment with KV namespace
 * @returns Promise<boolean> True if cache should be refreshed, false otherwise
 */
async function shouldRefreshCache(env: Env): Promise<boolean> {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  
  const refreshHour = DEV_CONFIG.apiRefreshHour;
  const refreshBuffer = DEV_CONFIG.apiRefreshBuffer;
  
  const isRefreshTime = (currentHour === refreshHour && currentMinute >= refreshBuffer);
  
  const isAfterRefreshHour = (currentHour > refreshHour);
  
  const isTimeToRefresh = isRefreshTime || isAfterRefreshHour;
  
  if (DEV_CONFIG.enableVerboseLogging) {
    console.log(`Current UTC time: ${currentHour}:${currentMinute}`);
    console.log(`Refresh time: ${refreshHour}:${refreshBuffer}`);
    console.log(`Is refresh time: ${isRefreshTime}, Is after refresh hour: ${isAfterRefreshHour}`);
  }
  
  if (!isTimeToRefresh) {
    return false;
  }
  
  const alreadyRefreshed = await hasRefreshedToday(env);
  
  const shouldRefresh = isTimeToRefresh && !alreadyRefreshed;
  
  if (DEV_CONFIG.enableVerboseLogging) {
    console.log(`Already refreshed today: ${alreadyRefreshed}`);
    console.log(`Should refresh cache: ${shouldRefresh}`);
  }
  
  return shouldRefresh;
}

/**
 * Checks if the cache has already been refreshed today
 * @param env Environment with KV namespace
 * @returns Promise<boolean> True if cache has been refreshed today, false otherwise
 */
async function hasRefreshedToday(env: Env): Promise<boolean> {
  try {
    if (!env.REPO_CACHE) {
      return false;
    }
    
    const lastRefreshKey = `${DEV_CONFIG.popularReposCacheKey}-last-refresh`;
    
    const lastRefreshTimestamp = await env.REPO_CACHE.get(lastRefreshKey);
    
    if (!lastRefreshTimestamp) {
      if (DEV_CONFIG.enableVerboseLogging) {
        console.log('No last refresh timestamp found, cache needs refresh');
      }
      return false;
    }

    const lastRefresh = new Date(lastRefreshTimestamp);
    const now = new Date();

    const isSameDay = 
      lastRefresh.getUTCFullYear() === now.getUTCFullYear() &&
      lastRefresh.getUTCMonth() === now.getUTCMonth() &&
      lastRefresh.getUTCDate() === now.getUTCDate();

    const lastRefreshHour = lastRefresh.getUTCHours();
    const lastRefreshMinute = lastRefresh.getUTCMinutes();
    
    const wasAfterRefreshTime = 
      (lastRefreshHour > DEV_CONFIG.apiRefreshHour) || 
      (lastRefreshHour === DEV_CONFIG.apiRefreshHour && 
       lastRefreshMinute >= DEV_CONFIG.apiRefreshBuffer);
    
    const hasRefreshed = isSameDay && wasAfterRefreshTime;
    
    if (DEV_CONFIG.enableVerboseLogging) {
      console.log(`Last refresh: ${lastRefreshTimestamp}`);
      console.log(`Same day: ${isSameDay}, after refresh time: ${wasAfterRefreshTime}`);
      console.log(`Has refreshed today: ${hasRefreshed}`);
    }
    
    return hasRefreshed;
    
  } catch (error) {
    console.error('Error checking if cache has been refreshed today:', error);
    return false; // On error, assume cache has not been refreshed
  }
}

/**
 * Invalidates a specific entry in the cache
 * @param cacheKey The key to invalidate
 * @param env Environment with KV namespace
 */
export async function invalidateCacheEntry(
  cacheKey: string,
  env: Env
): Promise<void> {
  try {
    // Check if KV namespace is available
    if (!env.REPO_CACHE) {
      if (DEV_CONFIG.enableVerboseLogging) {
        console.log('KV namespace not available, skipping cache invalidation');
      }
      return;
    }
    
    await env.REPO_CACHE.delete(cacheKey);
    
    if (DEV_CONFIG.enableVerboseLogging) {
      console.log(`Invalidated cache for ${cacheKey}`);
    }
  } catch (error) {
    console.error('Error invalidating cache:', error);
  }
}

/**
 * Generates a cache key for a repository
 * @param repoFullName The full name of the repository (owner/repo)
 * @param updatedAt The last update timestamp
 * @returns A formatted cache key
 */
export function generateCacheKey(repoFullName: string, updatedAt: string): string {
  return `repo:${repoFullName}:${updatedAt}`;
}