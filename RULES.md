# Phase 2 rules contract

## Modes and players

Standard: 25 cards; randomly chosen starting team has 9, opponent 8, neutrals 7, assassin 1. Positive clues and unlimited; no zero or action cards.
Expanded: 36 cards; blue 11, red 10, neutral 11, yellow 2, assassin 2. Blue starts. Positive clues, zero, unlimited, and action cards. A revealed yellow is credited to its revealing team, continues guessing, and counts toward that team's target (11 blue / 10 red). It never reduces the other team's target. Revealing any team's final required colored card wins for that team immediately, even on its opponent's guess. Assassin immediately loses for the revealing team.
4–10 players, exactly one spymaster and at least one agent per team. First roster member is admin. Roles/team/settings change only in the lobby. A rematch returns to the lobby and clears the old board/history while preserving roster/settings. Mid-match rematch requires admin confirmation.

## Clues and guesses

The UI requests one Arabic word. Validation permits up to two space-separated Arabic words for compounds. Hyphens/underscores, punctuation and more than two words are rejected. Exact normalized matches to unrevealed board words are rejected; semantic roots/part-word disputes are left to the group, with no AI or repeated-one-clue detection.
A numerical clue may range up to the team’s fixed original target: Standard starter 9 / opponent 8; Expanded blue 11 / red 10. Reveals and yellow credits never lower that maximum. Maximum confirmed guesses are n+1, including neutral/opponent guesses; Scan and Swap consume none. Zero therefore permits one guess. Unlimited has no numeric cap. After at least one confirmed guess, agents can stop voluntarily. Own color/yellow continues subject to limit/time; opponent/neutral ends the turn, except eligible Second Chance after neutral. Assassin always ends the match.
Suspecting toggles a per-player mark without spending attempts or revealing. Only same-team agents see each other's marks. Revealing is a separate immediate click-icon action available to any active-team agent on a word suspected by a teammate; no confirmation popup is shown; suspects are advisory and do not require votes. Clear marks on turn change, swap, rematch, and match end.

## Time

Optional per match: 10–600 seconds, locked once started. No clue-preparation timer. Start guess timer when clue is submitted. Timeout ends turn and breaks streak even if the numerical target was already achieved. Local timer uses a deadline, rather than a network tick.
Second Chance decision in a timed match has a new 10-second deadline. Save remaining guess time on entering the decision. Accepting resumes that saved amount, never a full new guess timer. Decline/decision timeout ends turn. Untimed matches have no decision or guessing timer. Card use cannot otherwise reset time. Admin pause is a local test convenience, freezing the currently running deadline.

## Action deck and draws

Deck: 2 Second Chance, 2 Scan, 2 Swap, 4 Hard Luck. Each team receives one initial draw. Hard Luck discards immediately with no replacement. If empty, shuffle discard only; held cards remain with their teams.
No action in a team's first turn. At most one action use per own turn. Earned cards can be used from the next own turn; initial cards from own turn 2. Cards remain in hand until used, with no arbitrary hand limit.
A successful turn reveals own/yellow cards at least equal to the positive clue count and ends cleanly. Two consecutive successful own turns grant one draw and reset the streak. Opponent turns do not interrupt the sequence. Neutral, opponent color, insufficient successes or any timeout breaks it. Neutral breaks it even if Second Chance is used. Zero and unlimited immediately reset streak and cannot advance it. Repeated 1 clues are allowed without penalties.
Automatic drawing is default, and no spymaster Draw control appears. Optional manual drawing is locked in pregame: only spymasters draw; button is disabled/faded until a draw is available. Earned draw opportunities expire at the beginning of that team's next turn, allowing the whole opponent turn (including clue preparation) to draw. Late draw does not delay eligibility. Missing a draw forfeits the opportunity and does not restore streak.
Manual initial cards: before play begins, both spymasters have a one-time initial draw in the preparation phase. Admin cannot start play before both initial draws complete. Automatic draws also wait for explicit admin Start play. Both spy keys remain hidden throughout the pregame draw phase, including after both draws until the admin begins play. Agents alone see hands/private outcomes and activate cards; spymasters have no action-use controls.

## Actions

Scan: own turn before first guess (including before clue), select one unrevealed position. Reveal only black / not black to own agents. No guess consumed and word remains unrevealed. Scan history records the fixed position plus the word at scan time.
Swap: own turn before clue, swap two distinct unrevealed words; colors stay at their positions. Everyone sees the new word arrangement; no guess consumed. No action in first turn.
Second Chance: after neutral, only if there are guesses remaining and an eligible card and no other action this turn. Explicit accept/decline phase. Neutral stays revealed and counts as an attempt; streak remains broken. Same remaining attempts and guess time. Cannot save assassin or opponent color, or extend a fully spent guess allowance.

## Storage and privacy

Only the first local persona's name and interface language are remembered in browser storage. No ongoing state/history/results persist across refresh. Finished state remains on screen until rematch/refresh; no archive is created. Rule projection hides unrevealed colors from agents, private hands/scans/action events from spies/opponents, and never projects deck order. Browser-local testing is not secure against developer tools; server secrecy belongs to Phase 3.

## Interface assistance and layout

Arabic and English UI are selectable, including help, errors and event descriptions. Board words/clues stay Arabic; names stay as entered. All displayed numeric UI values use Latin 0–9. Timer entry accepts Latin, Arabic-Indic, and Persian digits. Enabled state is separate from the draft; invalid enabled timer drafts block Start, never untoggle themselves.

Spies can toggle private word-frame highlights in their local perspective after play starts. These are separate UI state keyed by spy ID and word, follow words through swaps, never affect the rules or agent views, and clear on rematch.

Only suspected cards show the top-right immediate reveal icon to active-team agents. Spies have no reveal icons. Team progression and logs live in a button-opened sidebar. The board occupies the full main content width with active-team glow. Spy/action controls appear below it. Victory adds a banner, trophy and confetti; reduced-motion disables motion.
