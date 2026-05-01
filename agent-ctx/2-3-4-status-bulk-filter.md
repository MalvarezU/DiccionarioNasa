# Task 2-3-4: HU3.3.5, HU3.3.6, HU3.3.7 — Status management, bulk actions, and status filtering

## Work Log

### HU3.3.5 — Status Transitions (Borrador → Publicada → Archivada)

**Backend changes (`/src/app/api/admin/words/[id]/route.ts`):**
- Enhanced PUT endpoint: Added `determineAuditAction()` helper that uses "PUBLISH" or "ARCHIVE" action when status field changes to those values, otherwise "UPDATE"
- Added `userId: null` and `responsable: "admin (MVP)"` to audit log changes JSON
- Added status validation (must be DRAFT, PUBLISHED, or ARCHIVED)
- Created PATCH endpoint for status-only changes: accepts `{ status: "PUBLISHED" | "ARCHIVED" | "DRAFT" }`, creates audit log with specific action (PUBLISH/ARCHIVE), returns `{ word, previousStatus }`

**Frontend changes (`EditWordModal` in `admin-dashboard.tsx`):**
- Added state: `isTransitioning`, `showPublishNoAudioWarning`, `pendingStatusTransition`
- Added `handleStatusTransition()`: calls PATCH endpoint, shows warning when publishing without audio
- Added `executeStatusTransition()`: performs the actual API call, updates local form state, shows success message
- Added status transition buttons in DialogFooter:
  - DRAFT → "Publicar" button (emerald green, Eye icon)
  - PUBLISHED → "Archivar" button (secondary variant, Archive icon)
  - ARCHIVED → "Volver a publicar" button (emerald green, Eye icon)
- Added AlertDialog for "Publish without audio" warning (non-blocking — user can proceed or cancel)
- Disabled all buttons during transition (isTransitioning state)

### HU3.3.6 — Bulk Actions (Selection Multiple + Publish/Archive en Lote)

**Backend changes (new file `/src/app/api/admin/words/bulk-status/route.ts`):**
- POST endpoint accepting `{ wordIds: string[], status: "PUBLISHED" | "ARCHIVED" }`
- Validates wordIds array (non-empty, max 500) and status value
- For each word: checks existence, skips if already target status, updates status
- Creates audit log per word with action "BATCH_PUBLISH" or "BATCH_ARCHIVE" and `responsable: "admin (MVP)"`
- Returns summary: `{ updated: number, skipped: number, total: number }`

**Frontend changes (`WordListModal` in `admin-dashboard.tsx`):**
- Added state: `selectedIds` (Set<string>), `isBulkAction`, `bulkResult`
- Added Checkbox column as first table column (using shadcn/ui Checkbox)
- Added "Select all" checkbox in table header with indeterminate state support
- Added bulk action bar: shows when items selected, count + "Publicar seleccionadas" + "Archivar seleccionadas" + "Limpiar" buttons
- Added bulk action result card: shows updated/skipped counts with dismiss button
- Selected rows highlighted with `bg-primary/5`
- Selection cleared on page change, search, and filter change
- Added `onBulkActionDone` prop to refresh dashboard stats after bulk action

**Also added to helpers:**
- `BATCH_PUBLISH` and `BATCH_ARCHIVE` action labels and colors in `getActionLabel()` and `getActionColor()`

### HU3.3.7 — Filter by Status in Listing

**Frontend changes (`WordListModal` in `admin-dashboard.tsx`):**
- Status filter already existed — verified it works correctly with bulk actions
- Added visual indicator: Badge showing filter label + count (e.g., "Publicadas: 69") in the dialog description
- Selection is properly cleared when filter changes (bulk actions only affect selected items, not filtered items)

## Files Modified
- `/src/app/api/admin/words/[id]/route.ts` — Enhanced PUT audit logging + new PATCH endpoint
- `/src/app/api/admin/words/bulk-status/route.ts` — New bulk status change endpoint
- `/src/components/admin-dashboard.tsx` — EditWordModal status buttons + WordListModal bulk actions + status filter improvements

## Lint & Dev Server
- All lint checks pass: `bun run lint` — zero errors
- Dev server compiles without errors
