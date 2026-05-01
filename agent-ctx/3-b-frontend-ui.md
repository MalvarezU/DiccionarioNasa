# Task 3-b: Frontend UI — Theme, Navbar, SearchBar, Landing Page

## Agent: Frontend Developer
## Date: 2026-05-01

## Summary
Built the complete frontend UI for the Nasa Yuwe dictionary web app including earth-tone theme, navigation with search, and landing page.

## Files Created/Modified

### Created
- `src/components/navbar.tsx` — Sticky navbar with logo, SearchBar, and connection status
- `src/components/search-bar.tsx` — Full search component with debounce, dropdown, keyboard nav
- `src/hooks/use-online-status.ts` — Online/offline detection via useSyncExternalStore
- `src/hooks/use-debounce.ts` — Generic debounce hook
- `src/app/api/dictionary/featured/route.ts` — Featured words API endpoint
- `prisma/seed.ts` — 30 sample Nasa Yuwe words with cultural context
- `public/nasa-pattern.png` — AI-generated indigenous pattern image

### Modified
- `src/app/globals.css` — Earth-tone color palette (forest green, terracotta, warm browns)
- `src/app/layout.tsx` — Updated metadata, lang="es", flex layout for sticky footer
- `src/app/page.tsx` — Complete landing page with hero, featured words, about section, footer

## Key Design Decisions
1. **Color Palette**: Forest green primary (oklch 0.45 0.12 155), terracotta accent — NO blue/indigo
2. **Online Status**: Used `useSyncExternalStore` instead of `useState+useEffect` to avoid React lint warnings
3. **Search**: Custom dropdown (not Popover) for better keyboard navigation control
4. **Hero Image**: AI-generated pattern at 6% opacity as subtle background
5. **Layout**: `min-h-screen flex flex-col` on body + `mt-auto` on footer for sticky footer behavior

## Lint Status
✅ All checks pass (zero errors, zero warnings)

## Previous Agent Context
- Task 3-a already created the search API at `/api/dictionary/search` and word detail API at `/api/dictionary/words/[id]`
- Prisma schema with DictionaryWord model was already set up
- Database was already in sync with schema
