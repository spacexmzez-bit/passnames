# passnames — Phase 2, revision 0.2.1

Arabic-word local game prototype with Arabic/English UI, ready to update the existing Cloudflare Worker named `passnames`.

## Upload and deployment

1. Extract the ZIP. Upload the files themselves to the existing GitHub repository root, replacing earlier versions. Do not upload the ZIP or an enclosing directory.
2. Keep all files at root, including engine.js, engine.test.js, ui.test.js, i18n.js, ui-utils.js, words.json, worker.js and wrangler.jsonc.
3. Cloudflare Workers Builds settings remain: build `npm run build`, deploy `npx wrangler deploy`, Node 22, repository root, production branch main (or the branch already configured).
4. Build automatically runs the 42 rules and component tests, then Vite. The existing PartyServer binding and v1 migration remain unchanged; no manual binding changes or new database are required.
5. Open the existing workers.dev address. If the old setup screen appears, refresh the page or close and reopen its tab.

## Phase 2 scope

- Standard 5x5 and expanded 6x6, Arabic/English interface with Arabic words, 4–10 local player personas. Latin numerals are displayed in both languages; timer inputs accept Arabic, Persian, or Latin digits.
- One spymaster and at least one agent per team, with first player as admin.
- Local player perspective selector; any agent on the active team can confirm a guess.
- Suspect by tapping a word. Only suspected words display a top-right click icon; tapping it immediately reveals, without a confirmation dialog.
- Teammate-agent-only suspects, hands, scans and action logs in the rendered views.
- Clues, n+1 guess cap, unlimited, expanded-only zero; 0/unlimited reset streak with a visible warning.
- Optional 10–600 second guessing timer, no clue timer, settings locked during play.
- Action deck, two-successful-turn rewards, automatic/manual drawing, expiry and next-turn eligibility.
- Second Chance: 10-second decision timer in timed games, then saved remaining guess time; no timer in untimed games.
- Admin pause for local testing and mid-match rematch confirmation; teams/settings preserved in the lobby.
- Current-match clue/event history; no match archive or result storage. Refresh ends the local match.
- Only the first player's entered name and interface language are remembered in localStorage.

## Start a test

1. Edit player names and roles in the lobby. The four prefilled names are local test personas, not online players.
2. Choose a mode, optional timer, and optional manual draw (expanded only).
3. Start. Expanded mode waits in a pregame draw phase. In manual mode, switch to each spy and take both initial draws; in automatic mode both are already drawn. Only then can the admin press Start play. Both spy keys stay hidden until that action.
4. Switch to the active team's spymaster and submit a clue.
5. Switch to an agent. Tap a word to suspect it, then use its top-right click icon to reveal it immediately. There is no reveal confirmation popup.
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

- 31 standalone rules tests and 11 component/input tests pass (42 total); randomized rule checks complete 50 seeded matches.
- JavaScript syntax checks pass.
- Node-based component smoke checks exercise timer editing, both UI languages, perspective switching, suspects, immediate reveals, private highlights, initial draw gating, victory effects, and rematch.
- Full dependency installation/build and real browser visual checks could not run in the preparation environment. Cloudflare will run the build and tests during deployment. The Node component smoke check is not a substitute for a real browser playtest.

## Revision 0.2.1 changes

- Clue count caps are each team’s original target: Standard 9/8; Expanded blue 11/red 10. Neither reveals nor yellow credits lower these caps.
- English and Arabic UI, with Arabic board words and clues. Language preference is local to the browser.
- Purely local, spy-specific word-frame highlights; these follow swapped words, never affect match state, and reset on rematch.
- Immediate reveal icons only on suspected words, replacing both permanent reveal controls and the reveal confirmation dialog. Rematch confirmation remains.
- Arabic roles use الجاسوس and العميل; nomination is تحديد / Suspect.
- Victory banner, trophy, team-colored confetti, and reduced-motion support.
- Timer toggle is independent from its text draft. Invalid or unfinished inputs remain editable and block Start with a localized error.
- The key is hidden from both spies during Expanded setup, including after both initial draws until admin Start play.
- Team-colored glow on the board frame and active team progress card.
- Full-width mobile board; team progress/history in a button-opened sidebar; spy and action controls below the board. Numeric/text inputs use mobile-safe font sizing.

English UI changes interface labels, help, errors, and event descriptions only. Player names, board words and clues are user data and stay as entered.
