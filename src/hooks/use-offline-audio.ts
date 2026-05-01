"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  cacheAudio,
  isAudioCached,
  getCachedAudioBlobUrl,
  removeCachedAudio,
  getCacheStorageUsage,
} from "@/lib/offline-audio-cache";

export interface UseOfflineAudioReturn {
  /** The URL to use for audio playback (cached blob URL or original) */
  audioSrc: string | null;
  /** Whether the audio is available in offline cache */
  isCached: boolean;
  /** Whether the audio is currently being downloaded to cache */
  isDownloading: boolean;
  /** Download progress (0-100) */
  downloadProgress: number;
  /** Download the audio for offline use */
  downloadForOffline: () => Promise<void>;
  /** Remove the audio from offline cache */
  removeFromCache: () => Promise<void>;
  /** Storage usage info */
  storageInfo: { usedMB: number; quotaMB: number; percentUsed: number } | null;
}

/**
 * Hook to manage offline caching of audio files.
 * - On mount, checks if the audio is already cached.
 * - If cached, provides a blob URL for playback.
 * - Handles cleanup of blob URLs on unmount.
 */
export function useOfflineAudio(audioUrl: string | null): UseOfflineAudioReturn {
  const [isCached, setIsCached] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [audioSrc, setAudioSrc] = useState<string | null>(audioUrl ?? null);
  const [storageInfo, setStorageInfo] = useState<UseOfflineAudioReturn["storageInfo"]>(null);

  // Track blob URLs we created so we can revoke them
  const blobUrlRef = useRef<string | null>(null);

  // Revoke any previously created blob URL
  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // On mount or audioUrl change, check cache and create blob URL if available
  useEffect(() => {
    if (!audioUrl) {
      setAudioSrc(null);
      setIsCached(false);
      revokeBlobUrl();
      return;
    }

    let cancelled = false;

    const checkCache = async () => {
      const cached = await isAudioCached(audioUrl);
      if (cancelled) return;

      if (cached) {
        setIsCached(true);
        const blobUrl = await getCachedAudioBlobUrl(audioUrl);
        if (cancelled) return;

        revokeBlobUrl();
        if (blobUrl) {
          blobUrlRef.current = blobUrl;
          setAudioSrc(blobUrl);
        } else {
          // Fallback to original URL if blob creation fails
          setAudioSrc(audioUrl);
        }
      } else {
        setIsCached(false);
        revokeBlobUrl();
        setAudioSrc(audioUrl);
      }

      // Also fetch storage info
      const info = await getCacheStorageUsage();
      if (!cancelled) {
        setStorageInfo(info);
      }
    };

    checkCache();

    return () => {
      cancelled = true;
    };
  }, [audioUrl, revokeBlobUrl]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      revokeBlobUrl();
    };
  }, [revokeBlobUrl]);

  const downloadForOffline = useCallback(async () => {
    if (!audioUrl || isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // Simulate progress: start at 10%
      setDownloadProgress(10);

      const success = await cacheAudio(audioUrl);

      if (success) {
        setDownloadProgress(90);

        // Create blob URL for the newly cached audio
        const blobUrl = await getCachedAudioBlobUrl(audioUrl);

        revokeBlobUrl();
        if (blobUrl) {
          blobUrlRef.current = blobUrl;
          setAudioSrc(blobUrl);
        }

        setIsCached(true);
        setDownloadProgress(100);

        // Update storage info
        const info = await getCacheStorageUsage();
        setStorageInfo(info);
      } else {
        setDownloadProgress(0);
      }
    } catch {
      setDownloadProgress(0);
    } finally {
      setIsDownloading(false);
    }
  }, [audioUrl, isDownloading, revokeBlobUrl]);

  const removeFromCache = useCallback(async () => {
    if (!audioUrl) return;

    try {
      await removeCachedAudio(audioUrl);

      // Revoke blob URL and revert to original URL
      revokeBlobUrl();
      setAudioSrc(audioUrl);
      setIsCached(false);

      // Update storage info
      const info = await getCacheStorageUsage();
      setStorageInfo(info);
    } catch {
      // Silently fail
    }
  }, [audioUrl, revokeBlobUrl]);

  return {
    audioSrc,
    isCached,
    isDownloading,
    downloadProgress,
    downloadForOffline,
    removeFromCache,
    storageInfo,
  };
}
