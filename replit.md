# WebGIS Ngawi

WebGIS interaktif Kabupaten Ngawi — sistem informasi geografis berbasis web untuk menjelajahi dan menampilkan data spasial wilayah Ngawi, Jawa Timur.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/webgis-ngawi run dev` — run the WebGIS frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, Leaflet.js
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- WebGIS frontend: `artifacts/webgis-ngawi/src/`
  - Main map page: `src/pages/MapPage.tsx`
  - Loading screen: `src/components/LoadingScreen.tsx`
  - Search panel: `src/components/SearchPanel.tsx`
  - Info panel: `src/components/InfoPanel.tsx`
  - Layer control: `src/components/LayerControlPanel.tsx`
  - GeoJSON data: `public/data/ngawi.geojson` (served statically, 740KB)
- API server: `artifacts/api-server/src/`
- DB schema: `lib/db/src/schema/`
- OpenAPI spec: `lib/api-spec/openapi.yaml`

## Architecture decisions

- GeoJSON loaded via `fetch()` at runtime (not bundled) to avoid Vite's `.geojson` extension not being treated as JSON module
- Leaflet.js used for map rendering (lightweight, no API key needed)
- Three tile layer options: OpenStreetMap, Esri Satellite, OpenTopoMap
- Features split into separate LayerGroups (schools, universities, lines, polygons, points) for granular layer toggling
- GPS uses browser Geolocation API with `enableHighAccuracy: true`

## Product

- Interactive GIS map of Ngawi regency (Kabupaten Ngawi, East Java)
- 1,605 spatial features: schools, universities, roads/streets, buildings, and general points
- Features: animated loading screen, search by name, GPS locator, info panel on click, layer toggles, basemap switcher (OSM/Satellite/Topo), zoom/pan

## User preferences

- UI in Bahasa Indonesia
- Green/nature color theme matching the Ngawi agricultural landscape

## Gotchas

- GeoJSON file must be in `public/data/ngawi.geojson` so Vite serves it statically
- Do NOT import `.geojson` files directly as ES modules — Vite treats them as JS, causing "Unexpected token ':'" error
- Leaflet CSS must be imported in `index.css` (not in component files) to avoid duplicate styles

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
