# passnames — Phase 3B (v0.3.1)

Shared multiplayer gameplay on the existing `passnames` Cloudflare Worker. Both modes now run inside the private rooms you tested in 3A. All authored files are directly in the repository root.

## Update your existing deployment

1. Extract the ZIP. Open the extracted folder and select **its files**, then upload them to the **root of your existing private GitHub repository**, replacing the old versions. Commit the upload. Do not upload the ZIP or an enclosing folder. Keep your own `words.json` if you have customized it; this package contains the same word pool as 3A.
2. Keep your existing Cloudflare Worker **passnames**, connected repository, production branch, and root directory. Build command stays **`npm run build`**; deploy command stays **`npx wrangler deploy`**; use **Node 22**. Your GitHub commit should trigger the existing deployment workflow.
3. Include every new source file, especially **`game-ui.js`**, **`room-match.js`**, and **`match.test.js`**, plus the updated existing files. Keep `wrangler.jsonc`: the existing Setup/Rooms bindings and v1/v2 migrations are unchanged. No new Worker, database, API key, paid service, or manual Cloudflare binding is needed for this update.
4. Wait for Cloudflare's build and deployment to succeed, then refresh the site on each device. If an old page remains, do a hard refresh or close/reopen the tab. Existing 3A rooms/seats can continue; their admin can confirm the lineup and start a match.

This archive is source code for your existing GitHub → Cloudflare workflow, not a deployment already made to your account.

## Play a multiplayer match

1. Create/join a room as in 3A. Use four devices or separate browser profiles for four distinct seats. Tabs in the same browser share a saved seat.
2. Assign exactly one spy and at least one agent to each team. All admitted players need a team, and each team's spy plus at least one agent must be connected. Set Standard/Expanded, optional timer, and optional manual draw before starting.
3. Admin presses **Confirm lineup**, then **Start match**. Standard starts with clue preparation. Expanded first shows **Initial draws**. With manual draw enabled, both spies must draw; otherwise both draws happen automatically. Admin then presses **Start play**. Both keys stay concealed until this point.
4. Each player sees their own role only. The active spy sends an Arabic clue and a count. Agents tap words to **suspect** them; same-team agents see these marks. A suspected card has a top-right click icon: tapping it reveals immediately without another confirmation.
5. The **Teams** button opens progression and clue/event logs. Spy/action tools remain below the board. The **Room** button opens invites, roster, admin kick/lock controls, join requests, rename, and Leave room.
6. Admin can choose **Rematch**, including during play, after confirming. Everyone returns to the same lobby with names, teams and settings retained. The old board, clues, cards, scans and history are cleared. Approve waiting players there before starting another match.

English/Arabic interface selection is per browser. Board words and clues remain Arabic. `words.json` is the sole source of board words.

## What changed in 3B

- Server creates/shuffles the board and action deck with server-side random values, keeps the full match in room storage, and validates every action against the authenticated seat.
- Role-specific WebSocket snapshots conceal unrevealed colors from agents, action hands/scans/private action logs from spies/opponents, and deck order from everyone. Pending entrants receive no match data. Finished boards are revealed to all players.
- Shared clues, private same-team suspect marks, immediate reveals, turn changes, scoring, yellow credit, assassin losses, action cards, draw windows, win effects and same-room rematches.
- Suspect and reveal are distinct server commands. Any active-team agent may reveal a word suspected by a teammate. Marks spend no attempts. Spy frame highlights remain private device UI state and send no game command.
- Serialized commands plus match/turn/version checks reject outdated reveals, duplicate clicks, and actions for an earlier match. A stale action is rejected with an explanation; the browser does not replay it automatically.
- Server alarms enforce optional guessing and Second Chance deadlines without a client sending ticks. The browser displays the server deadline using a clock offset. Clue preparation remains untimed. Second Chance gets a new 10-second decision window and restores saved guessing time on acceptance.
- Basic refresh/reconnect restores the same saved seat, role, match, private view and running deadline. In-progress state survives Durable Object recreation.
- All previous game rules, local playtest, bilingual UI, mobile board/sidebar layout, word highlights and timer draft handling remain available.

No result archive is created. The current finished match remains visible for the group until rematch or room expiry; rematch removes its stored state. Empty rooms expire after one hour. Leaving the last admitted seat retires the room immediately.

## Recovery boundaries before 3C

A network disconnect retains the player's seat. During a running match, it does **not yet automatically pause play or transfer admin rights**. Server timers continue unless the admin pauses. The admin can Pause/Resume from the game footer; paused deadlines retain their remaining time.

If a required seat explicitly **leaves or is kicked**, the match cannot safely replace that role yet. Running play freezes; if still in Initial draws, Start play is blocked. Admin can Rematch to set up the teams again. Departing admins explicitly transfer ownership to another admitted member. Existing roles cannot be switched during a match, so a spy cannot become an agent after seeing the key.

3C will add automatic match-aware disconnect handling, timed admin failover, and controlled role replacement. These are not included in 3B.

## Four-device checks after deployment

- Start Expanded with manual draw: verify that neither spy sees colors before **both draws + admin Start play**.
- Send a clue. Verify every device updates; agents cannot choose another perspective or see unrevealed colors.
- Suspect a word: only same-team agents see the mark. Reveal with its click icon: everyone sees the revealed card and updated count/score.
- Try action cards on a later own turn: same-team agents share the hand and scan result; spies/opponents do not see them. Swap updates word labels on all devices without moving colors.
- Enable a 10-second timer before a new match. After the clue, let it expire with no further clicks: the server advances the turn. Clue preparation has no timer. A timed Second Chance decision gets its own fresh 10 seconds.
- Refresh an agent page midgame: the same seat and concealed board should return. Test admin Pause/Resume and Rematch without opening another room.
- Join midmatch from another browser: it waits even when the room is unlocked. Admin can approve that entrant only after returning to the lobby.
- Switch UI language and test a narrow phone screen. Words stay Arabic; numbers stay Latin; the board stays the main view and room/progression panels open by button.

## Files and local commands

`engine.js` contains the shared rules. `room-match.js` validates server match commands and projects private views. `room-server.js` handles authentication, persistence, broadcasts, alarms and room lifecycle. `room-core.js` owns membership/lobby rules. `game-ui.js` renders the same game UI in local and online modes; online mode has no perspective switch and never creates a local authoritative match. `room-ui.js` handles entry/lobby/room management. `main.js` mounts the application. `i18n.js` and `room-text.js` provide bilingual text.

Node 22.12+: `npm install`, `npm test`, then `npm run dev:worker`. Use the Worker-served local address Wrangler prints. Generated `node_modules/`, `dist/` and `.wrangler/` are ignored and do not belong in GitHub. All authored source/test/configuration files remain in root.

## Verification performed

**114 automated tests pass**, including game rules, 50 seeded local-match simulations, lobby permissions, real-rule server protocol simulations with multiple socket identities, role privacy, competing guesses, server deadlines, Second Chance, action draws, rematches, storage recreation, transport errors and local/online component interaction checks.

The socket/storage simulations run in-process, and component checks use a lightweight harness. They do not replace actual Cloudflare/network/browser testing. Dependency downloads were blocked with HTTP 403 in the preparation environment, so a full Vite/Worker build and deployed browser checks could not run here. Your existing Cloudflare workflow runs all tests before its Vite build; use the checks above after that deployment succeeds.
