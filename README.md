# passnames — Phase 3A (v0.3.0)

Private multiplayer rooms and live lobby setup on the existing `passnames` Cloudflare Worker. The complete Phase 2 local game remains available through **Local game test / اختبار اللعبة محليًا**. All authored files belong directly in the repository root.

## Deploy this update

1. Extract the ZIP, then upload its files to the existing private GitHub repository root, replacing previous files. Do not upload the ZIP or its enclosing folder.
2. Keep Cloudflare Workers Builds: build `npm run build`, deploy `npx wrangler deploy`, Node 22, existing production branch, repository root.
3. Include the updated `wrangler.jsonc`. It retains `SetupServer` and the existing v1 migration and adds `RoomsServer` under a new v2 SQLite migration. Wrangler creates the Rooms binding automatically. Do not delete/change v1, recreate the Worker, or add a manual database.
4. Wait for the Git-triggered build/deployment. The build runs all rule, room server, transport and component tests before Vite.
5. Open your existing workers.dev address. The new default landing page offers Create room and Join room. `/api/health` now checks both the original setup service and the Rooms binding and returns `rooms: true`.
6. No new API key, login service, PartyKit hosting account, paid Cloudflare upgrade, or separate deployment workflow is required.

## What 3A does

- Create an unlisted private room, with a random 9-character code and copyable invitation link.
- Enter a name; the browser remembers it for future entry.
- Rooms require admin approval by default. An invitation never bypasses the lock.
- Admin can approve/decline applicants, unlock/lock direct code-based entry, kick members, edit settings, and assign teams/roles.
- Admitted players can choose their own team and role. Each team can have at most one spy; agents can share teams within the overall 10-player capacity.
- Maximum 10 admitted players and a separate bounded queue of 10 requests. There is no public room directory or list endpoint.
- Real-time roster/settings/presence updates use WebSockets, with one server-controlled Durable Object per room.
- Confirm lineup requires at least 4 admitted players, every admitted player assigned, and each team having its spy and at least one agent connected. Extra offline agents do not block an otherwise complete team.
- Confirm lineup locks the settings/roles into a Ready screen. **It does not launch multiplayer gameplay in 3A.** Admin can reopen Edit lineup.
- If a required player disconnects from a confirmed lineup, it reopens for editing. Basic reconnect restores an admitted player's identity and seat.
- If admin explicitly leaves, rights transfer to an admitted player (prefer connected members). A temporarily disconnected admin retains the seat; automatic timed admin failover belongs to 3C.
- Server state survives object recreation/hibernation. Empty rooms expire after one hour. If the last admitted member explicitly leaves, the room is retired immediately.
- Arabic and English UI; words remain Arabic in the local game.

## Test 3A with four players

1. Open the site on device/browser A, enter a name and Create room. Creator starts as Blue spy and admin; roles can be changed before readiness confirmation.
2. Copy invite. Open it on devices/browser profiles B, C and D. Each enters a distinct name and presses Join room.
3. Each applicant should see Waiting for admin approval; no roster/settings are shown to them yet.
4. A approves them from Join requests. They should enter the live lobby automatically, without reloading.
5. Set A to Blue spy, B to Blue agent, C to Red spy, D to Red agent. Players can select their own seats, or the admin can assign them.
6. Try taking an already occupied spy seat; the server should refuse. Nonadmins must not see approval/lock/settings controls or be able to change another player's seat.
7. Change mode/timer/manual-draw settings as admin and save. Check other devices update. Timer entry accepts Arabic or Latin numerals and remains enabled while incomplete/invalid; Save/Confirm refuses an invalid value.
8. Confirm lineup. Everyone should see the Ready screen explaining live gameplay arrives in 3B. Return to Edit lineup.
9. Refresh B: it should restore the same approved player, without a duplicate seat or new approval request.
10. Kick B: the saved seat loses access and its open connections close. A blocked saved seat cannot immediately request reentry; without accounts, this is seat revocation rather than a permanent person/device ban.
11. To test a fresh player, use a separate device, browser, or browser profile. Tabs in one browser share the room token and therefore the same seat. A browser's private windows can also share one private session with each other.
12. Unlock the room and test a new code/link join. It enters directly while the room is in lobby. Once the lineup is Ready, new entrants wait for admin approval and the next editable lobby even if the lock is off.

## Existing local game

Use Local game test on the landing page to run the complete Phase 2 game on one device. All prior rules, spy highlights, suspected-card click icons, timers, English UI and victory effects are retained. Back to rooms leaves this local test. The local game's board/state are not sent to the room server.

`words.json` remains the only source of board words. No changes were made to that word pool in 3A.

## Remaining phases

3B connects the game engine to these rooms, moves the secret board and game actions to the server, enforces role-specific gameplay views, and adds same-room rematches. 3C adds match-aware pause/replacement/recovery and timed admin transfer. The basic lobby reconnection and empty-room cleanup here are foundations, not a completed match recovery system.

## Implementation

- `room-core.js`: pure roster, approval, role, settings, readiness and private-view rules.
- `room-server.js`: PartyServer adapter, persisted room state, serialized mutations, socket authentication and live snapshots.
- `room-api.js`: private code-based HTTP routes and same-origin checks.
- `room-client.js`: room entry, browser seat storage, invitation generation, WebSocket protocol, heartbeats and reconnect.
- `room-ui.js`, `room-text.js`: bilingual lobby screens.
- `worker.js`, `wrangler.jsonc`: existing Worker plus Rooms routing and additive v2 SQLite migration.
- `room.test.js`, `room-ui.test.js`: room-domain, adapter/HTTP/transport, configuration and component checks.

Only a SHA-256 session-token hash is stored server-side. Plain tokens stay in browser storage and travel in POST bodies / the WebSocket authentication message, never invitation URLs or public snapshots. Player IDs and names alone do not grant a seat. No login is required. Pending applicants cannot inspect the roster, settings, or other applicants. Server commands use the authenticated socket identity, not a client-supplied player ID. A short per-connection action limit and bounded request sizes are enforced.

## Optional local commands

Node 22.12+: `npm install`, `npm test`, then `npm run dev:worker`. Use the Worker-served local URL printed by Wrangler (usually localhost:8787). Generated node_modules/, dist/, and .wrangler/ are ignored and do not belong in GitHub.

## Verification

85 automated tests pass, including the previous 42 Phase 2 checks, 50 seeded simulated local matches, room permission/isolation/capacity tests, server-adapter simulations with multiple clients, storage recreation, HTTP routing, private view projections and component interactions. These simulations use in-process storage/socket adapters. Actual Cloudflare deployment, cross-device networking, Vite dependency build and browser visual QA were unavailable in the preparation environment and still need verification on your deployment.
