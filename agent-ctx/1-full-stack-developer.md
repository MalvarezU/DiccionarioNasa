# Task 1 — HU1.2.4 Auto-download favorite audio for offline use

## Agent: full-stack-developer

## Summary
Implemented offline audio caching for the Nasa Yuwe dictionary app. When a user marks a word as favorite AND it has audio, the audio is automatically downloaded to the browser's Cache API for offline playback. When unfavorited, the cached audio is removed.

## Files Created
- `/home/z/my-project/src/lib/offline-audio-cache.ts` — Cache API service (cacheAudio, isAudioCached, getCachedAudioBlobUrl, removeCachedAudio, getCacheStorageUsage)
- `/home/z/my-project/src/hooks/use-offline-audio.ts` — React hook for offline audio management

## Files Modified
- `/home/z/my-project/prisma/seed.ts` — Added audioUrl values for 9 words
- `/home/z/my-project/src/components/audio-player.tsx` — Added isCached prop and offline badge
- `/home/z/my-project/src/components/word-detail-card.tsx` — Integrated offline audio hook, auto-download/remove, dynamic status UI
- `/home/z/my-project/worklog.md` — Appended task log

## Key Decisions
- Used Cache API (not IndexedDB) for audio storage — simpler API, purpose-built for HTTP responses
- Blob URLs for playback from cache — ensures audio element can play without network
- Cache name: 'nasa-yuwe-audio-v1' — versioned for future cache invalidation
- Storage warnings at >50% (info display) and >80% (destructive toast)
- Pending action ref pattern for triggering offline actions after favorite toggle completes
