# passnames — UI Pass 2 (v0.4.1)

Shared multiplayer gameplay on the existing `passnames` Cloudflare Worker. Both modes retain the working 3B gameplay, with automatic disconnect pauses, timed admin transfer and controlled spy replacement. All authored files are directly in the repository root.

## Playing experience in Pass 2

This is the complete project, including Pass 1's entry/lobby/tabletop styling and all working 3C recovery. No new setup, assets, packages or backend migration is required. Every authored file remains at the repository root.

- The current clue appears in a paper briefing panel above the board, with its count and the n+1 guess budget. Used guesses have visible counters; zero permits one guess; Unlimited shows no numerical cap. Posted zero/Unlimited clues carry the streak warning, as does the spy's selector. Clue preparation stays untimed. Guess/Second Chance countdowns still display the server's deadline and never send client ticks.
- The player role and guidance distinguish clue preparation, agents' choices, the opponent's turn, recovery, spectators and connection loss. Only the local playtest has a perspective selector.
- Suspects use small teammate-initial markers, with the full names retained in accessible labels/tooltips. The same top-right click icon reveals immediately, with no new confirmation. Spy highlights remain private frame-only assistance.
- Expanded hands now contain illustrated SVG/CSS action cards, short effect descriptions, and specific availability reasons. Initial/future-turn locks, opponent turns, used actions, Scan-before-first-guess, Swap-before-clue and Second Chance's decision phase remain enforced. Only the owning agents receive the hand/private outcomes. The spy's manual draw station shows a generic card back and faded/available Draw button; it never displays the card identity.
- Scan and Swap selections show the chosen word labels and numbered board positions. Tap a selected word/chip to remove it; Cancel changes no game state. Confirm spends the action only when the server accepts it. Valid selections survive a busy acknowledgement, a rejected request, or temporary reconnect; if the turn/card eligibility changes, the stale tool is cleared. No background action replay is added.
- The two-step streak display explains progress toward a draw. The team sidebar has separate Teams, Clues and Events tabs, including recorded clue counts and turn/team labels. All history comes from the existing role-specific projection.

Sound, new draw/reveal/turn animations and the remaining celebration/accessibility polish belong to Pass 3. Existing victory effects are retained.

## Review and test Pass 2

A separate `passnames-pass2-preview.html` shows Entry, Lobby, Agent board, Spy board, Action hand, Swap selection and Clue log in Arabic/English. Use its preview toolbar to navigate. It renders sample states with the actual components and CSS; game/network controls are inactive. The preview is not needed in GitHub.

After uploading the source and waiting for Cloudflare deployment:

1. Send clues with 1, an Expanded 0, and Unlimited. Check the displayed guess budget and streak warning. Check that Standard still omits 0/action cards.
2. Suspect a word as an agent. Only teammates should see the marker; the reveal icon still acts immediately. Spy frames must remain private.
3. During a later own turn in Expanded, select Scan or Swap if the team holds it. Choose words and Cancel: no card or guess should be spent. Confirm a legal selection: everyone sees the resulting permitted state; scan outcomes stay private to owning agents. Card buttons explain unavailable phases.
4. Open Teams, then switch to Clues and Events. Check the Arabic clue text and Latin counts under either UI language.
5. Try a short timed match, refresh/reconnect, and use admin Pause/Resume/Rematch. Busy commands should not flash a false disconnected state. Rejected tool requests should leave valid selections available to review/retry.

## Update your existing deployment

1. Extract the ZIP. Open the extracted folder and select **its files**, then upload them to the **root of your existing private GitHub repository**, replacing the old versions. Commit the upload. Do not upload the ZIP or an enclosing folder. Keep your own `words.json` if you have customized it; this package contains the same word pool as 3A.
2. Keep your existing Cloudflare Worker **passnames**, connected repository, production branch, and root directory. Build command stays **`npm run build`**; deploy command stays **`npx wrangler deploy`**; use **Node 22**. Your GitHub commit should trigger the existing deployment workflow.
3. Include every new source file, including **`recovery.test.js`**, the updated **`room-match.js`**, **`room-server.js`**, **`room-client.js`**, **`room-ui.js`**, and **`game-ui.js`**, plus the updated existing files. Keep `wrangler.jsonc`: the existing Setup/Rooms bindings and v1/v2 migrations are unchanged. No new Worker, database, API key, paid service, or manual Cloudflare binding is needed for this update.
4. Wait for Cloudflare's build and deployment to succeed, then refresh the site on each device. Refresh every player’s page so all devices use the new heartbeat protocol. Existing rooms, seats and active matches are compatible; missing required roles may put a running match into recovery pause.

This archive is source code for your existing GitHub → Cloudflare workflow, not a deployment already made to your account.

## Play a multiplayer match

1. Create/join a room as in 3A. Use four devices or separate browser profiles for four distinct seats. Tabs in the same browser share a saved seat.
2. Assign exactly one spy and at least one agent to each team. All admitted players need a team, and each team's spy plus at least one agent must be connected. Set Standard/Expanded, optional timer, and optional manual draw before starting.
3. Admin presses **Confirm lineup**, then **Start match**. Standard starts with clue preparation. Expanded first shows **Initial draws**. With manual draw enabled, both spies must draw; otherwise both draws happen automatically. Admin then presses **Start play**. Both keys stay concealed until this point.
4. Each player sees their own role only. The active spy sends an Arabic clue and a count. Agents tap words to **suspect** them; same-team agents see these marks. A suspected card has a top-right click icon: tapping it reveals immediately without another confirmation.
5. The **Teams** button opens progression and clue/event logs. Spy/action tools remain below the board. The **Room** button opens invites, roster, admin kick/lock controls, join requests, rename, and Leave room.
6. Admin can choose **Rematch**, including during play, after confirming. Everyone returns to the same lobby with names, teams and settings retained. The old board, clues, cards, scans and history are cleared. Approve waiting players there before starting another match.

English/Arabic interface selection is per browser. Board words and clues remain Arabic. `words.json` is the sole source of board words.

## Shared gameplay retained from 3B

- Server creates/shuffles the board and action deck with server-side random values, keeps the full match in room storage, and validates every action against the authenticated seat.
- Role-specific WebSocket snapshots conceal unrevealed colors from agents, action hands/scans/private action logs from spies/opponents, and deck order from everyone. Pending entrants receive no match data. Finished boards are revealed to all players.
- Shared clues, private same-team suspect marks, immediate reveals, turn changes, scoring, yellow credit, assassin losses, action cards, draw windows, win effects and same-room rematches.
- Suspect and reveal are distinct server commands. Any active-team agent may reveal a word suspected by a teammate. Marks spend no attempts. Spy frame highlights remain private device UI state and send no game command.
- Serialized commands plus match/turn/version checks reject outdated reveals, duplicate clicks, and actions for an earlier match. A stale action is rejected with an explanation; the browser does not replay it automatically.
- Server alarms enforce optional guessing and Second Chance deadlines without a client sending ticks. The browser displays the server deadline using a clock offset. Clue preparation remains untimed. Second Chance gets a new 10-second decision window and restores saved guessing time on acceptance.
- Basic refresh/reconnect restores the same saved seat, role, match, private view and running deadline. In-progress state survives Durable Object recreation.
- All previous game rules, local playtest, bilingual UI, mobile board/sidebar layout, word highlights and timer draft handling remain available.

No result archive is created. The current finished match remains visible for the group until rematch or room expiry; rematch removes its stored state. Empty rooms expire after one hour. Leaving the last admitted seat retires the room immediately.

## Recovery added in 3C

### Automatic pauses and reconnect

The server pauses the whole match when either team's spy is offline or a team has no connected agent. This applies to both teams, including the team waiting for its turn, and also protects the initial draw phase. An extra agent disconnecting does not stop play when another agent on that team remains connected. Multiple tabs belong to one seat: closing one tab does not disconnect that player if another authenticated tab stays responsive.

The recovery panel lists missing roles and saved seconds. Board, clue, guesses, scores, cards, streaks, draw opportunities and private scan history remain intact. Reconnecting restores the same seat and role. Once both teams have a connected spy and at least one agent, the **admin presses Resume**. Play never auto-resumes just because someone reconnects. The timer continues from its saved remainder, rather than restarting. Second Chance preserves both its remaining decision time and the separately saved guessing time. Manual pauses stay paused too.

A closed socket is handled when the server detects the close. To catch silent connections, each browser sends a small heartbeat every 20 seconds. A connection that sends no authenticated activity for 65 seconds is closed and treated as offline. The browser reconnects with its existing token. Switching off Wi-Fi or suspending a phone can therefore take up to roughly 65 seconds from the last activity to be detected; it is not an instant physical-network detector. Phones that suspend background pages may be treated as disconnected; return to the game page to reconnect. Heartbeats do not broadcast game snapshots or rewrite the match.

### Admin transfer

When the server detects that the admin has no responsive connection, it starts a **60-second grace period**. A visible countdown appears for admitted players. Returning before it ends cancels the transfer. Otherwise, the longest-standing currently connected admitted member receives admin rights. Pending applicants cannot inherit control. If nobody eligible is connected, ownership is retained until an admitted member returns after the grace period; the server does not spin a repeating expired alarm.

The former admin keeps their player seat and role when they return, but does not automatically reclaim admin rights. A transfer does not resume a paused match. Explicitly pressing Leave room still transfers ownership immediately as before. Grace periods and paused time survive room object recreation.

### Spy replacement

While the match is paused, the admin can open **Room → Replace an offline spy** (or **Recovery controls** from the pause panel). A connected agent from the **same team** can be promoted only when **another connected agent remains**. Confirm the promotion, then Resume once both teams are complete.

The replacement receives the spy view. The previous spy's retained seat becomes **Spectator** for the rest of that match. Reconnecting is still allowed, but the former spy gets no unrevealed key, private hand, scans, suspect controls or gameplay actions. They can never return as an agent in the same match. Existing agent marks belonging to the promoted player are removed; other agents' marks remain. This does not consume a guess or action card and does not reset time, cards or score.

Replacement only uses existing admitted teammates. New entrants still wait until the next editable lobby, even if the room is unlocked. In a four-player match, promoting the only agent would leave that team incomplete, so it is unavailable: wait for the spy to reconnect or Rematch to edit the lineup. Agents cannot be replaced with someone who has already seen the key. If a team has no connected agents, an existing agent must reconnect or the group must rematch.

Rematch deletes the old board/history, retains current teams/settings, and converts former-spy spectators to ordinary agents in the new lobby. Roles can then be edited normally for a fresh board.

## Test the 3C recovery features

1. **Pause/reconnect:** start a four-player match with a 60-second timer. Submit a clue, let a few seconds pass, then close the nonadmin spy's only game tab. Remaining players should see a recovery pause and saved seconds. Reopen the invitation in that spy's original browser: the same seat returns, the match stays paused, and the admin can Resume with the saved time.
2. **Admin transfer:** close the admin's only tab **without pressing Leave room**. Keep the other players' pages open and responsive. After the displayed 60-second grace period, another admitted player gets admin controls. Reopen the former admin: their seat returns, but admin rights stay with the new admin.
3. **Spy replacement:** use five seats: Blue spy + two Blue agents; Red spy + Red agent. Disconnect the Blue spy. If that player is admin, wait for transfer first. The new admin opens Room/Recovery controls, promotes one Blue agent and confirms. The other Blue agent remains an agent. Resume, then reconnect the original Blue spy: they should be a Spectator, unable to suspect or reveal words. Rematch to restore editable roles.
4. **Extra agent and duplicate tabs:** in the five-seat match, close one Blue agent's tab while the other Blue agent remains connected: play should continue. Open one spy seat in two tabs and close only one: play should also continue.
5. **Silent loss:** disable a spy device's network while keeping the other devices active. If no close event arrives, allow about 65 seconds from its last heartbeat for detection. Restore its network and return to the page; it should reconnect to the same seat and wait for admin Resume.

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

`engine.js` contains the shared rules. `room-match.js` validates server match commands, handles presence recovery/admin failover/spy replacement, and projects private views. `room-server.js` handles authentication, heartbeat leases, persistence, broadcasts, alarms and room lifecycle. `room-core.js` owns membership/lobby rules. `game-ui.js` renders the same game UI in local and online modes; online mode has no perspective switch and never creates a local authoritative match. `room-ui.js` handles entry/lobby/room management. `main.js` mounts the application. `i18n.js` and `room-text.js` provide bilingual text.

Node 22.12+: `npm install`, `npm test`, then `npm run dev:worker`. Use the Worker-served local address Wrangler prints. Generated `node_modules/`, `dist/` and `.wrangler/` are ignored and do not belong in GitHub. All authored source/test/configuration files remain in root.

## Verification performed

**158 automated tests pass**, including game rules, 50 seeded local-match simulations, lobby permissions, real-rule server protocol simulations with multiple socket identities, role privacy, competing guesses, server deadlines, Second Chance, action draws, rematches, storage recreation, transport errors and local/online component interaction checks. UI checks cover dictionary-based entry samples, seating/settings/readiness, clue budgets, private equipment, Scan/Swap selection and cancellation, failed/rejected acknowledgements, busy-versus-disconnected state, stale tools, accessible markers, and sidebar navigation. Recovery scenarios cover critical-role disconnects, extra agents, duplicate tabs, heartbeat expiry, legacy connection upgrades, 60-second failover/cancellation, absent candidates, safe promotion and spectator permissions, persisted recovery, timer preservation and failed storage writes.

The socket/storage simulations run in-process, and component checks use a lightweight harness. They do not verify browser layout. A full dependency build and browser visual QA were unavailable in the preparation environment; npm downloads were blocked with HTTP 403 during earlier setup. JavaScript syntax, relative imports, unchanged backend/configuration/word files and archive structure are checked separately. Your existing Cloudflare workflow runs the tests before its Vite build. After deployment, check the entry/lobby and both board sizes on your phone, switch UI language, and run a short multiplayer match.
