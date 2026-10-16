# كلمات سرية — Phase 1

Arabic-only Codenames variant. This starter validates React/Vite frontend, a Cloudflare Worker, SQLite-backed Durable Object/PartyServer, and a short WebSocket connection. It contains no game or room implementation yet.

## Cloudflare Workers Builds

- Application/Worker name: `kalimat-sirriya` (must match `wrangler.jsonc`).
- Repository root: `/` (or leave root blank).
- Production branch: `main`.
- Build command: `npm run build`.
- Deploy command: `npx wrangler deploy`.
- Build variable: `NODE_VERSION` = `22`.
- Cloudflare installs npm dependencies automatically. No account ID, API keys, separate database, or manual binding setup is required for this Git integration.
- Use Workers Free. Do not use Pages or a Hello World template.
- The SQLite binding and migration are declared in wrangler.jsonc and created on deploy.
- Disable non-production branch builds for now; the initial setup only needs production deployments.

## Verify

Open the deployed workers.dev URL and press فحص الإعداد. It should confirm the server, realtime connection, and words file. `/api/health` should return `ok: true`. Repeated checking opens only short-lived setup connections.

## Development (Node 22.12+)

1. `npm install`
2. `npm run dev:worker` — builds the UI and starts the complete local Worker at the address printed by Wrangler, normally http://localhost:8787.
3. Stop with Ctrl+C. Rerun after frontend edits to rebuild them.
4. Alternatively, run `npm run dev` in a second terminal for Vite hot reload at port 5173 while the Worker is running on port 8787.
5. `npm run check:deploy` builds and validates Worker bundling without publishing.

The initial package has no lockfile because dependency downloads were blocked in the preparation environment. Run npm install in the development workspace and commit the generated package-lock.json once installation succeeds.

## Word pool

Edit only `words.json`: a JSON array of unique, nonempty Arabic strings, at least 36. This initial pool is extracted from the supplied PDF. No translation support is included.

## Boundaries

Phase 2 implements a separate rules engine and local player-view testing. Phase 3 adds server authority, private rooms, admission, roles, reconnection, and synchronization. Never send the secret board key to agents in the multiplayer implementation.

## Flat repository layout

All authored files live at the repository root. Vite imports words.json directly. Editing that file and deploying updates the word pool. Generated dist/, node_modules/, and .wrangler/ directories exist only during build or local development and are ignored by Git; never upload them.

If replacing the earlier starter, delete the obsolete src/, server/, and public/ directories from GitHub after uploading these root files.
