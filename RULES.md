# Passnames rules contract — Phase 3C

## Modes and players

Standard: 25 cards; randomly chosen starting team has 9, opponent 8, neutrals 7, assassin 1. Positive clues and unlimited; no zero or action cards.
Expanded: 36 cards; blue 11, red 10, neutral 11, yellow 2, assassin 2. Blue starts. Positive clues, zero, unlimited, and action cards. A revealed yellow is credited to its revealing team, continues guessing, and counts toward that team's target (11 blue / 10 red). It never reduces the other team's target. Revealing any team's final required colored card wins for that team immediately, even on its opponent's guess. Assassin immediately loses for the revealing team.
4–10 players, exactly one spymaster and at least one agent per team. The room creator is admin; explicit departure transfers ownership to another admitted member. The local playtest uses its first persona as admin. Roles/team/settings change only in the lobby. A rematch returns to the lobby and clears the old board/history while preserving roster/settings. Mid-match rematch requires admin confirmation.

## Clues and guesses

The UI requests one Arabic word. Validation permits up to two space-separated Arabic words for compounds. Hyphens/underscores, punctuation and more than two words are rejected. Exact normalized matches to unrevealed board words are rejected; semantic roots/part-word disputes are left to the group, with no AI or repeated-one-clue detection.
A numerical clue may range up to the team’s fixed original target: Standard starter 9 / opponent 8; Expanded blue 11 / red 10. Reveals and yellow credits never lower that maximum. Maximum confirmed guesses are n+1, including neutral/opponent guesses; Scan and Swap consume none. Zero therefore permits one guess. Unlimited has no numeric cap. After at least one confirmed guess, agents can stop voluntarily. Own color/yellow continues subject to limit/time; opponent/neutral ends the turn, except eligible Second Chance after neutral. Assassin always ends the match.
Suspecting toggles a per-player mark without spending attempts or revealing. Only same-team agents see each other's marks. Revealing is a separate immediate click-icon action available to any active-team agent on a word suspected by a teammate; no confirmation popup is shown; suspects are advisory and do not require votes. Clear marks on turn change, swap, rematch, and match end.

## Time

Optional per match: 10–600 seconds, locked once started. No clue-preparation timer. Start guess timer when clue is submitted. Timeout ends turn and breaks streak even if the numerical target was already achieved. Online timers use server deadlines and Durable Object alarms; browsers only display countdowns. Local playtest also uses deadlines.
Second Chance decision in a timed match has a new 10-second deadline. Save remaining guess time on entering the decision. Accepting resumes that saved amount, never a full new guess timer. Decline/decision timeout ends turn. Untimed matches have no decision or guessing timer. Card use cannot otherwise reset time. Admin pause freezes the currently running deadline in both online and local play.

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

Online: the browser remembers the chosen name, interface language and private room-session token. The server stores only a hash of that token, membership, settings and current match state. Refresh/reconnect restores the same seat and role. Keys and deck order are server-only; only the role-specific projection is sent to each player. New arrivals during a match wait for the next editable lobby and see no match data. Finished state remains visible until rematch or room expiry, with no separate results archive. Rematch deletes the stored old match/history while preserving room membership/settings. Empty rooms expire after one hour; the final admitted member explicitly leaving retires the room.

Local playtest: personas and board are local and not secure against developer tools; refreshing clears that local match. The first persona's name and interface language are remembered. Online secrecy comes from server-held state and authenticated, role-specific projections, not CSS hiding.

## Interface assistance and layout

Arabic and English UI are selectable, including help, errors and event descriptions. Board words/clues stay Arabic; names stay as entered. All displayed numeric UI values use Latin 0–9. Timer entry accepts Latin, Arabic-Indic, and Persian digits. Enabled state is separate from the draft; invalid enabled timer drafts block Start, never untoggle themselves.

Spies can toggle private word-frame highlights in their local perspective after play starts. These are separate UI state keyed by spy ID and word, follow words through swaps, never affect the rules or agent views, and clear on rematch.

Only suspected cards show the top-right immediate reveal icon to active-team agents. Spies have no reveal icons. Team progression and logs live in a button-opened sidebar. The board occupies the full main content width with active-team glow. Spy/action controls appear below it. Victory adds a banner, trophy and confetti; reduced-motion disables motion.

## Private rooms and match lifecycle

A room is unlisted, has a random 9-character code and invitation link, requires admin approval by default, and holds at most 10 admitted members. Pending requests are bounded separately to 10. Invitation links never bypass approval. Unlocked rooms allow direct joins only with a code/link while the room is editable; there is no public discovery. Applicants arriving in Ready or during a match remain pending until the next editable lobby.

The creator is admin and initially Blue spy. Admin may approve, reject, kick, lock/unlock, configure settings, and assign roles. Members may assign only themselves. At most one spy per team. Confirm lineup requires every admitted player to have a team, at least 4 members, and both teams to have a connected spy and at least one connected agent. Additional disconnected agents do not block ready teams. Confirming freezes settings/roles into a Ready checkpoint. Admin then starts the match; readiness is checked again on the server. Before launch, required-player disconnection, kicking or admitted departure reopens the checkpoint. Playing roles and settings cannot be reopened through a lobby command; use confirmed Rematch.

Anonymous private browser tokens restore seats after refresh and basic reconnect; a name or player ID is not proof of identity. Kicking/declining revokes that saved seat for this room. Explicit admin departure transfers rights to an admitted member; a disconnected admin receives a 60-second grace period after the server detects the loss of their last responsive connection. On expiry, the oldest connected admitted member inherits admin rights. A returning former admin retains their seat but does not reclaim control. Pending entrants never inherit; if nobody eligible is connected, transfer waits for an admitted member to return. Online actions use the authenticated socket identity, never a browser-supplied player ID. Shared mutations are serialized; match/turn/version checks prevent stale reveals or a previous match's commands from acting on a new match. Marks do not invalidate other agents' reveal versions.

The server pauses when either team's spy disconnects or a team has no connected agent, including pregame. An extra agent disconnecting does not pause a team that retains another connected agent. Multiple tabs count as one seat; a seat remains online while any authenticated tab is responsive. Reconnection preserves the board, clue, attempts, cards, streaks, draw window and remaining time. Both teams must have their spy and at least one agent connected before the admin explicitly resumes. Reconnection, admin transfer and spy replacement never resume automatically. Manual pauses are also preserved.

Browsers send an authenticated heartbeat every 20 seconds. A socket without authenticated activity for 65 seconds expires and reconnects using the same saved token. A silent network loss is recognized on expiry, not necessarily at the moment Wi-Fi is turned off. Hibernation uses server alarms for the earliest timer, host grace, connection expiry or room expiry; there is no server polling loop. Heartbeats update connection state without rewriting/broadcasting the game. Paused guessing and Second Chance decision deadlines retain their remaining amounts; Second Chance's separately saved guessing time also remains intact. A deadline that has already expired is resolved before a newly detected disconnect pauses the next turn.

While paused, admin can promote an existing connected same-team agent to replace an offline/departed spy only when another connected agent remains. The replaced spy's retained seat becomes a spectator for that match; no agent role, secret key projection, hand, scans, marks or gameplay commands are granted on return. The new spy's former agent marks are removed. Promotion preserves board/clue/time/score/cards and never spends an action or guess. Replacing an online spy, using an opponent/pending/spectator as the replacement, or promoting a team's last connected agent is forbidden. The server revalidates eligibility and match/version when confirmation arrives. No midmatch admission or unrestricted role changes are introduced.

New arrivals still wait until the next editable lobby. With only one agent on a team, an absent spy must reconnect or the group must rematch. With no connected agent, an existing agent must reconnect or the group must rematch. A former spy cannot fill an agent vacancy before the old board is deleted. After rematch deletes that board, spectators become agents in the lobby and roles may be edited for the next match.

The complete Phase 2 local playtest remains separately available, including its local perspective selector. Online games have one fixed perspective for the authenticated seat. Admin can rematch during play or after victory, with confirmation, keeping everyone in the same room.
