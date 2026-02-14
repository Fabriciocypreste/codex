# REDX Spatial Streaming — Project Guidelines

## Code Style
- **TypeScript** (relaxed — no `strict: true`), target ES2022, `jsx: "react-jsx"`
- Path alias: `@/*` → project root (configured in `tsconfig.json` + `vite.config.ts`)
- Functional components only with `React.FC<Props>`, export default. Use `React.memo` for list-rendered components
- Wrap event handlers in `useCallback`, computed data in `useMemo`
- Code in **English**, UI strings and comments in **Portuguese (pt-BR)**
- File naming: PascalCase for components/pages (`MediaCard.tsx`), camelCase for services/utils (`streamService.ts`)
- **Tailwind CSS v4** inline utilities — Netflix/visionOS dark theme: background `#0B0B0F`, accent `#E50914`

## Architecture
Monolithic React SPA with **dual navigation**: React Router v6 for `/admin/*` routes, state-based `Page` enum for the TV Box streaming UI (see `App.tsx`).

- **Providers**: `ConfigProvider` → `AuthProvider` → `Router` → `SpatialNavProvider`
- **Data flow**: Supabase DB (source of truth) → sanitize/dedup → enrich with TMDB images → render
- **State**: Context API + useState only — no Redux/Zustand
- Key directories: `components/` (shared UI), `pages/` (views), `pages/admin/` (CRM panel), `services/` (data layer), `hooks/` (spatial nav), `contexts/` (auth, config), `utils/` (helpers)
- Types unified in `types.ts` — `Media` is the core type for movies/series

## Build and Test
```bash
npm run dev        # Vite dev server on port 3000 (host 0.0.0.0 for TV Box network access)
npm run build      # Production build with terser (drops console/debugger)
npm run preview    # Preview production build
```
- **No test framework configured** — validate changes manually via browser
- Build target: Capacitor Android (`com.redflx.app`), output to `dist/`
- Env vars prefixed `VITE_`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TMDB_API_KEY`, `VITE_TMDB_READ_TOKEN`

## Project Conventions

### TV Box / Spatial Navigation (critical)
All interactive elements MUST support D-Pad navigation via HTML attributes:
```tsx
<div data-nav-row={rowIndex} data-nav-scroll>
  <button data-nav-item data-nav-col={colIndex} onKeyDown={handleEnter}>
```
- `data-nav-row` groups items vertically, `data-nav-col` tracks horizontal position
- `data-nav-scroll` enables auto-scroll on focus
- Focus styles in `src/index.css`: red glow outline, `scale(1.04)` transform
- Sound feedback: `playNavigateSound()`, `playSelectSound()`, `playBackSound()` (Web Audio API, no files)
- See `hooks/useSpatialNavigation.tsx` for the full implementation

### Supabase Integration
- Client singleton in `services/supabaseService.ts` (HMR-safe via `globalThis`)
- Core tables: `movies`, `series` (with `stream_url`, `tmdb_id`, `genre TEXT[]`, `status`)
- Stream resolution cascade in `services/streamService.ts`: tmdb_id → exact title → partial match → alt table
- Upserts use `onConflict: 'tmdb_id'` for dedup
- Content with `stream_url` is prioritized in catalog display

### TMDB Enrichment
- Used ONLY for images/metadata — real content comes from Supabase
- Rate-limited: batches of 8 with `Promise.allSettled` in `services/tmdbCatalog.ts`
- Auto-fix invalid TMDB IDs via `services/tmdbSync.ts`

## Security
- **No admin route protection** in frontend — admin pages at `/admin/*` have no auth guard
- Supabase anon key is intentionally public (relies on RLS policies)
- Service role key is NOT exposed client-side
- Production build strips all `console.*` calls
- Stream URLs fetched dynamically, never hardcoded
