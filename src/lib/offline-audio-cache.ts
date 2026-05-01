/**
 * Offline Audio Cache Service
 * Uses the Cache API to store audio files for offline playback.
 * This module is client-only — do not import from server-side code.
 */

const CACHE_NAME = "nasa-yuwe-audio-v1";

/**
 * Check if the Cache API is available (client-side only)
 */
function isCacheAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    "caches" in window &&
    typeof caches.open === "function"
  );
}

/**
 * Open the audio cache. Returns null if Cache API is unavailable.
 */
async function getCache(): Promise<Cache | null> {
  if (!isCacheAvailable()) return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/**
 * Fetch an audio file and store it in the cache.
 * @param audioUrl - The relative URL of the audio file (e.g. "/audio/wala.wav")
 * @returns true if caching succeeded, false otherwise
 */
export async function cacheAudio(audioUrl: string): Promise<boolean> {
  const cache = await getCache();
  if (!cache) return false;

  try {
    const response = await fetch(audioUrl);
    if (!response.ok) return false;

    // Clone the response before caching so we can still read it
    await cache.put(audioUrl, response.clone());
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a given audio URL is stored in the offline cache.
 * @param audioUrl - The relative URL of the audio file
 * @returns true if the URL is cached
 */
export async function isAudioCached(audioUrl: string): Promise<boolean> {
  const cache = await getCache();
  if (!cache) return false;

  try {
    const response = await cache.match(audioUrl);
    return !!response;
  } catch {
    return false;
  }
}

/**
 * Get a blob URL for a cached audio file, suitable for use as an <audio> src.
 * Returns null if the audio is not cached or Cache API is unavailable.
 *
 * IMPORTANT: The caller is responsible for revoking the blob URL when done
 * (via URL.revokeObjectURL) to avoid memory leaks.
 *
 * @param audioUrl - The relative URL of the audio file
 * @returns A blob URL string, or null if not cached
 */
export async function getCachedAudioBlobUrl(
  audioUrl: string
): Promise<string | null> {
  const cache = await getCache();
  if (!cache) return null;

  try {
    const response = await cache.match(audioUrl);
    if (!response) return null;

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    return blobUrl;
  } catch {
    return null;
  }
}

/**
 * Remove a cached audio entry from the offline cache.
 * @param audioUrl - The relative URL of the audio file
 * @returns true if the entry was deleted (or didn't exist), false on error
 */
export async function removeCachedAudio(audioUrl: string): Promise<boolean> {
  const cache = await getCache();
  if (!cache) return false;

  try {
    await cache.delete(audioUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get storage usage information for the current origin.
 * Returns null if the Storage API is unavailable.
 */
export async function getCacheStorageUsage(): Promise<{
  usedMB: number;
  quotaMB: number;
  percentUsed: number;
} | null> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    !navigator.storage.estimate
  ) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usedMB = (estimate.usage ?? 0) / (1024 * 1024);
    const quotaMB = (estimate.quota ?? 0) / (1024 * 1024);
    const percentUsed = quotaMB > 0 ? (usedMB / quotaMB) * 100 : 0;

    return {
      usedMB: Math.round(usedMB * 100) / 100,
      quotaMB: Math.round(quotaMB * 100) / 100,
      percentUsed: Math.round(percentUsed * 100) / 100,
    };
  } catch {
    return null;
  }
}
