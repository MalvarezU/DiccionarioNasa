# Task 2-a: Export API + IndexedDB Local Database Service

## Agent: full-stack-developer
## Task: Create bulk export API endpoint and IndexedDB local database service for offline-first support

## Files Created

### `/home/z/my-project/src/app/api/dictionary/export/route.ts`
- GET endpoint returning all dictionary words for bulk download
- Pagination: `?page=1&pageSize=500` (default page=1, pageSize=500, max 1000)
- Incremental sync: `?since=ISO_DATE` filters words updated after that date
- Response: `{ words: [...], total: number, page: number, pageSize: number, hasMore: boolean }`
- Parses `examples` JSON string before returning (same pattern as word detail API)
- Uses `db.dictionaryWord.findMany` with `where` clause for since filter
- Words ordered by `spanish: asc`

### `/home/z/my-project/src/lib/local-db.ts`
- IndexedDB service for offline-first dictionary access
- Database: `nasa-yuwe-dict` v1
- Stores: `words` (keyPath: 'id', indexes: spanish, nasaYuwe, category), `meta` (keyPath: 'key', for sync timestamps)
- Exports: `openDB`, `isLocalDBReady`, `getLocalDBStats`, `storeWords`, `searchLocalWords`, `getLocalWord`, `getLocalCategories`, `clearLocalDB`, `setLastSync`, `getLastSync`
- Types: `LocalWord`, `LocalSearchResult`
- `searchLocalWords` implements NFD normalization + 3-tier relevance ranking (exact → prefix → partial), alphabetical tiebreak
- All functions guard against SSR (`typeof indexedDB === 'undefined'`)
- Error handling: all functions catch errors gracefully, never throw

## Key Decisions
- Used separate `meta` object store for sync timestamps (cleaner separation of concerns)
- `storeWords` uses `put()` for upsert behavior (safe for re-sync)
- `getLocalCategories` handles comma-separated category values (same as server-side `parseCategories`)
- `searchLocalWords` uses cursor-based full scan (IndexedDB doesn't support cross-index OR queries natively)
- Default pageSize of 500 for export (balances payload size vs. request count)

## Lint Status
✅ Zero errors, zero warnings

## Test Results
- Export API tested with pagination and since filter — both work correctly
- Returns 69 words total from seed data
- Examples parsed from JSON string to objects correctly
