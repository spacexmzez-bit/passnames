# passnames — Phase 2

Arabic-only local game prototype, ready to update the existing Cloudflare Worker named `passnames`.

## Upload and deployment

1. Extract the ZIP. Upload the files themselves to the existing GitHub repository root, replacing earlier versions. Do not upload the ZIP or an enclosing directory.
2. Keep all files at root, including engine.js, engine.test.js, words.json, worker.js and wrangler.jsonc.
3. Cloudflare Workers Builds settings remain: build `npm run build`, deploy `npx wrangler deploy`, Node 22, repository root, production branch main (or the branch already configured).
4. Build automatically runs the 28 rules tests, then Vite. The existing PartyServer binding and v1 migration remain unchanged; no manual binding changes or new database are required.
5. Open the existing workers.dev address. If the old setup screen appears, refresh the page or close and reopen its tab.

## Phase 2 scope

- Standard 5x5 and expanded 6x6, Arabic RTL interface, 4–10 local player personas.
- One spymaster and at least one agent per team, with first player as admin.
- Local player perspective selector; any agent on the active team can confirm a guess.
- Nomination by tapping the word; an independent Confirm button and confirmation dialog reveal it.
- Teammate-agent-only nominations, hands, scans and action logs in the rendered views.
- Clues, n+1 guess cap, unlimited, expanded-only zero; 0/unlimited reset streak with a visible warning.
- Optional 10–600 second guessing timer, no clue timer, settings locked during play.
- Action deck, two-successful-turn rewards, automatic/manual drawing, expiry and next-turn eligibility.
- Second Chance: 10-second decision timer in timed games, then saved remaining guess time; no timer in untimed games.
- Admin pause for local testing and mid-match rematch confirmation; teams/settings preserved in the lobby.
- Current-match clue/event history; no match archive or result storage. Refresh ends the local match.
- Only the first player's entered name is remembered in localStorage.

## Start a test

1. Edit player names and roles in the lobby. The four prefilled names are local test personas, not online players.
2. Choose a mode, optional timer, and optional manual draw (expanded only).
3. Start. In manual mode, switch to each spymaster, take the initial draw, then have the admin start turns. Unclaimed initial draws are forfeited on starting turns.
4. Switch to the active team's spymaster and submit a clue.
5. Switch to an agent. Tap a word to nominate it, then use its Confirm button to reveal it.
6. Switch among players to check different views. Use admin Rematch to return to the lobby.
7. Expanded: after two qualifying own turns, inspect the action hand. For manual draws, switch to that team's spymaster during the opponent's turn and draw before the next own turn starts.
8. Read the built-in Arabic Rules dialog for the full game behavior. RULES.md records the implementation contract.

## Phase 3 boundary

This is intentionally a browser-local game. Different devices/tabs do not share a match, there are no live rooms, invitation links, admissions, kicks, reconnects, or server-enforced identity yet. The entire local state exists on the test device. Rendered role views hide secrets, but this is not a security boundary: Phase 3 must move the rules and secret board to the authoritative server and issue authenticated role-specific views. The temporary player selector will be removed from production multiplayer play.

## Word changes

`words.json` is the single source of game words. Use a JSON array of Arabic strings, at least 36 distinct words. Change that one file, commit, and let Cloudflare rebuild. Words are imported at build time; no parallel copy or embedded fallback list exists. The provided pool contains 150 words from the supplied PDF.

## Optional local commands (not required to use GitHub deployment)

With Node 22.12+ installed:

- npm install
- npm test
- npm run dev:worker (builds UI and serves the whole app, usually localhost:8787)
- npm run check:deploy (build and Worker bundle validation without publishing)

Generated node_modules/, dist/, and .wrangler/ are ignored and must not be committed. All authored files live at root.

## Verification in this delivery

- 28 standalone rules tests pass; the final test completes 50 seeded randomized matches.
- JavaScript syntax checks pass.
- Node-based component smoke checks exercise mode/timer/draw combinations, clue submission, perspective switching, nomination, reveal confirmation, and rematch.
- Full dependency installation/build and real browser visual checks could not run in the preparation environment. Cloudflare will run the build and tests during deployment. The Node component smoke check is not a substitute for a real browser playtest.
