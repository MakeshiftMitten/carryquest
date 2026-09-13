# Carry Quest

Carry Quest is a rainbow-unicorn arithmetic roguelite with a seeded branching map, addition/subtraction/multiplication levels, local player stats, chiptunes, and a 13,000-byte ZIP limit. The game has no runtime dependencies; production builds use esbuild and Terser for minification, compact CSS selectors, Roadroller packing, and Zopfli for ZIP compression.

Run commands from this workspace root (`C:\source\carry-quest-portable`). On Windows, use `npm.cmd run dev`. Edit `src/`; the production build is self-contained in `dist/index.html`. `npm.cmd run zip` builds `carry-quest.zip` and enforces an archive size strictly below 13,000 bytes.

Run `npm.cmd ci` once before building or verifying. Source development with `npm.cmd run dev` still needs no installation.

## Levels, horn pieces, and perks

Ten map rows offer five levels each; clear one per row, then face the boss. Normal movement reaches the same lane or one lane left/right. Tap a reachable level or press **1–5** to select its lane, from left to right. Press **Enter** or the **same lane key again** to start from its briefing. Each level shows its operation types, difficulty score, timers, shared mistake allowance, and horn colors before entry. The briefing fills the screen on phones and touch devices; its rules scroll while the Start and Back buttons stay available. Every map has a connected route collecting all seven colors; challenge levels award two distinct colors. Collected colors appear in the horn on the map. The header, lives, and horn stay visible while only the map scrolls. Opening the map or rotating the screen brings the current row into view.

Level difficulty = operation points + arithmetic difficulty + speed (1–10) + mistake strictness (1–5) + (questions − 5). Levels have **5–10 questions**, with one point per additional question. Operation presence costs **+ = 1, − = 2, × = 4**, plus one per additional type: two types add 1, all three add 2. Thus +− costs 4, +× costs 6, −× costs 7, and +−× costs 9.

Initial map difficulties rise by two points per row, starting at 7; challenges add two more. Later rows, Road perks, and the boss can raise arithmetic difficulty above 5. Each extra arithmetic point raises the operand limit by 300. Multiplication always uses a single-digit bottom operand (1–9); only its top operand grows.

A cleared level awards **its current difficulty minus all mistakes in that attempt**, including forgiven wrong entries and timeouts. Negative awards are possible. The reward panel shows this calculation; failed attempts award no points.

| Arithmetic / strictness rating | Mistakes forgiven per level | Operand maximum (top operand for multiplication) |
| --- | --- | --- |
| 1 | 5 | 9 |
| 2 | 4 | 20 |
| 3 | 3 | 99 |
| 4 | 1 | 200 |
| 5 | 0 | 999 |

Speed is separate: **time = 11 − speed rating**, so speed 1 gives 10 seconds, speed 5 gives 6 seconds, and speed 10 gives 1 second. Every step on a multiplication problem gets **two extra seconds**, including carry adjustments. Its whole-problem budget uses the increased step time too.

Addition and multiplication enforce every carry, including overflow into a new leftmost place. The carry dial starts at zero and shows no target value or preferred direction. Swipe up/down or press ↑/↓ to change it by one, wrapping between 0 and 9. For `9 × 7 = 63`, enter `3`, then swipe up six times (or down four times) to set the carry to six, then enter `6`. For `3 × 7`, enter `1`, adjust the carry to `2`, then enter `2`; simply typing `1, 2` is rejected. Intermediate adjustments are neutral, not mistakes. Subtraction still requires the full borrow chain. Swipe anywhere in the problem board to operate the highlighted column, or tap the up/down buttons on its right. A clear vertical movement locks the direction until release, so release wobble cannot reverse a swipe. Short or mostly horizontal motions, cancelled touches, and swipes during digit entry are ignored.

The step timer resets after each accepted digit or carry/borrow adjustment. From row 4 onward, a whole-problem timer also applies: 80% of the required step count × step time, with a minimum of one step time. Each upward carry increment counts separately in that budget. The overall deadline does not reset on steps. The icon strip summarizes the current rules. The large **PAUSE** button freezes both timers and lists the rules, including the shared mistake pool and boss scaling. Tap Resume or press Enter to continue; Escape toggles pause. Opening Stats also pauses both timers. Paused time does not count toward solve time.

Each level has its advertised 5–10 question positions. Completing a problem advances one position. The shared mistake allowance forgives wrong entries across the entire level; once exhausted, each wrong entry fails the question and moves back one position. Timeouts always fail the question. Falling from Q1 to Q0 loses the level and one life; solving the final position wins the level. Players start with three lives and may retry or choose another reachable level after a loss. Revisited questions receive fresh, seeded problems.

After each map level, draw **three distinct perks** from the bag below. Tap one or press its displayed **1, 2, or 3** key. Offers are seeded and stay fixed while viewing them; maxed-out Jumpstart is excluded. The reward panel stays in the bottom half of the screen.

Owned perks appear as tappable icons beside the larger life counter, with counts for repeated selections. Tap an icon to show or hide its description. Perks apply when chosen; tapping an owned icon does not apply them again.

1. **Quick snack:** restore one life, up to three. Its button shows current and resulting lives; uncollected horn pieces show muted versions of their actual colors.
2. **Pegacorn:** reach two lanes left/right in the next row, including retries there.
3. **Jumpstart:** start one question ahead in future levels; stacks three times, up to Q4.
4. **Hard Road:** add five difficulty points to all remaining map rows. Stacks.
5. **Easy Road:** subtract five difficulty points from all remaining map rows, to a minimum of four. Stacks. Completed rows stay unchanged.

The last row leads to a **ten-question boss fight**, always starting at difficulty **6**. Its increment is the **number of missing horn colors**: each solved question adds it; each failed question subtracts it, to a floor of 6. With a complete horn the increment is zero. This ties difficulty to progress, so repeated setbacks cannot inflate it forever. Road perks do not alter this boss rule. Falling below Q1 loses a life and allows a retry at 6. Jumpstart does not skip boss questions. Solving Q10 wins the run; the boss awards its final difficulty minus mistakes.

## Fast mobile loop

Install Node.js 24, open this folder in a terminal, and run:

```bash
npm run dev
```

No `npm install` is needed. The command:

- opens the game on the computer;
- prints one or more `Phone/tablet` URLs;
- serves the source directly over the local network;
- refreshes CSS in place when it changes; and
- refreshes every connected browser after HTML or JavaScript changes.

Put the phone and computer on the same home network, open the printed phone URL once, and leave that tab open while editing. If Windows asks about Node.js network access, allow it on **Private networks**.

Choose Start, then select a connected world on the map. Symbols identify operations; green, yellow, and red indicate easy, medium, and hard. Later sectors increase number ranges. Login selects a local player profile.

### Recommended two-day cadence

1. Keep `npm run dev` running and make the real phone your primary test screen.
2. Use desktop responsive mode for quick visual edits, then verify every gesture change on the phone.
3. Run `npm run verify` before each checkpoint.
4. Commit and push only coherent checkpoints; GitHub Pages becomes the HTTPS test build.

The development server unregisters old service workers, so cached production files cannot poison the local loop. Local HTTP is enough for layout, gameplay, touch, and telemetry testing. The compact production HTML embeds its assets and omits PWA installation files.

## Inspect the real Android browser

For console, network, and performance debugging on the phone:

1. Enable Developer options and USB debugging on Android.
2. Connect the phone to the computer with USB and accept the debugging prompt.
3. Open `chrome://inspect/#devices` in desktop Chrome.
4. Find the Carry Quest tab and click **Inspect**.

This gives you desktop DevTools attached to the actual mobile tab while the LAN live-reload server continues running.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Source server, desktop launch, LAN URL, live reload |
| `npm run dev:mobile` | Same loop without opening a desktop tab |
| `npm test` | Arithmetic state-machine regression tests |
| `node scripts/browser-smoke.mjs` | Windows/Edge mobile browser playthrough of the current build |
| `npm run build` | Build `dist/index.html` and report ZIP size |
| `npm run zip` | Build and create `carry-quest.zip` |
| `npm run check` | Check deploy assets and GitHub Pages-safe paths |
| `npm run test:server` | Smoke-test the LAN server and browser asset types |
| `npm run verify` | Test, build, smoke-check, and enforce 13,000 bytes |
| `npm run preview` | Serve the exact production build over the LAN |

If port 4173 is occupied, set another port before starting the server. In PowerShell:

```powershell
$env:PORT=4174
npm run dev
```

## GitHub Pages hosting

The repo already contains `.github/workflows/pages.yml`. The workflow tests the math engine, rebuilds the static app, checks all deploy paths, enforces the size ceiling, and publishes `dist/`. When several pushes happen quickly, an obsolete deployment is cancelled so the newest commit wins.

For a new GitHub repository:

```bash
git remote add origin https://github.com/YOUR-USER/carry-quest.git
git push -u origin main
```

Then, once on GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**. Every later push to `main` publishes automatically. The site URL will normally be:

```text
https://YOUR-USER.github.io/carry-quest/
```

All app URLs are relative, so a GitHub Pages repository subpath works without editing the code. Pull requests run verification but do not deploy.

## Production check

Before pushing:

```bash
npm run verify
npm run preview
```

Open the printed phone URL from `npm run preview`. That is the exact `dist/` tree GitHub Pages will receive.

## Where to edit

- `src/main.js` — game loop, touch/keyboard input, screens, telemetry
- `src/math-engine.js` — ordered carrying and borrowing rules
- `src/style.css` — responsive layout and visual design
- `test/math-engine.test.mjs` — arithmetic-order regressions
- `scripts/server-smoke.mjs` — local-server regression check
- `public/` — manifest, icon, and offline worker
- `dist/` — generated deploy output

The production app stays framework-free. Development scripts and documentation do not count against the 13,000-byte ZIP budget; the actual ZIP containing only the self-contained `dist/index.html` is measured. HTML whitespace is compacted, and JavaScript and CSS are minified and packed together. The embedded Roadroller decoder uses eval with a 32 MB decoding memory cap, then installs the styles and starts the game. The uncompressed HTML may exceed 13,000 bytes. Upload `dist/index.html` to any static host, or use `npm run preview` locally; no Node server is needed on the host.

## Telemetry

Users, runs, and gameplay events stay in this browser as JSON under `carry-quest-store-v2`. Each visible username receives a stable global username made from its first four normalized characters plus an eight-character GUID fragment (for example, `alex-4f8c2a10`). Use the player selector to create or switch users. **Insights** switches among global (this device by default), user lifetime, and current-run metrics; its run archive reviews or exports finished runs. Active runs are saved locally but excluded from every Insights scope and the archive until won, lost, or abandoned. **Export all JSON** downloads the complete schema-v2 store. Existing profiles and schema-v1 events are upgraded automatically.

The global scope has a provider boundary. To supply aggregate metrics from an API or another source, set `globalThis.carryQuestGlobalMetricsProvider` before `main.js` loads. It must expose a `label` and an async `load()` function returning the same summary shape as `summarize()` in `src/telemetry-store.js`; otherwise the app uses local metrics across all users.

The most useful event fields are:

- `expected` and `actual` action
- `phase`, `place`, `correct`, and `errorCode`
- per-step `latencyMs`
- gesture `distance` and `duration`
- per-problem `elapsedMs` and `mistakes`
- run, problem, seed, and room identifiers

The ZIP budget is decimal: **strictly fewer than 13,000 bytes**, including the archive headers. Build and ZIP commands check both optimized compression and standard level-6 DEFLATE. `npm run zip` writes the smaller optimized archive; Windows Compress-Archive is also checked during release verification.
