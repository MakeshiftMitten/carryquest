# Carry Quest

Carry Quest is a dependency-free, touch-first arithmetic roguelite. The repo contains the five-room prototype, strict carrying/borrowing state machine, mobile flick controls, desktop keys, local telemetry, a 13 KiB compressed-size gate, and automatic GitHub Pages deployment.

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

To jump straight to a mechanic, append a room number:

```text
http://YOUR-LAN-IP:4173/?room=1
http://YOUR-LAN-IP:4173/?room=2
http://YOUR-LAN-IP:4173/?room=4
```

Room 1 is carrying, room 2 is borrowing, and room 4 is chained borrowing through zeroes. The query parameter also works on the deployed site.

### Recommended two-day cadence

1. Keep `npm run dev` running and make the real phone your primary test screen.
2. Use desktop responsive mode for quick visual edits, then verify every gesture change on the phone.
3. Run `npm run verify` before each checkpoint.
4. Commit and push only coherent checkpoints; GitHub Pages becomes the HTTPS/PWA test build.

The development server unregisters old service workers, so cached production files cannot poison the local loop. Local HTTP is enough for layout, gameplay, touch, and telemetry testing. Use the deployed HTTPS site to verify installation and offline behavior.

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
| `npm run build` | Recreate `dist/` and report compressed size |
| `npm run check` | Check deploy assets and GitHub Pages-safe paths |
| `npm run test:server` | Smoke-test the LAN server and browser asset types |
| `npm run verify` | Test, build, smoke-check, and enforce 13 KiB |
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

The production app stays framework-free. Development scripts and documentation do not count against the 13 KiB app budget; everything copied into `dist/` does.
