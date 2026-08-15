# Carry Quest — portable demo

This repository is the current Carry Quest prototype in a small, framework-free web build. It keeps the five-room roguelite, strict carrying/borrowing state machine, touch flicks, desktop keys, local telemetry, relics, and responsive phone layout. It has no package dependencies.

## Tight local feedback loop

Run one command:

```bash
npm run dev
```

It opens the game on the desktop, exposes a `Phone/tablet` URL to every device on the same Wi-Fi, and live-reloads every connected screen when `src/`, `public/`, or `index.html` changes. There is no dependency install or bundling pause. Use `npm run dev:mobile` when you do not want it to open a desktop tab automatically.

For mobile iteration, keep the phone on the game URL and the terminal running. Save a file on the computer; the desktop and phone refresh together. Your firewall may ask whether Node can accept local-network connections.

## Fastest way to play the production build

The repository includes a built `dist/` folder, so no dependency install is needed.

```bash
npm run play
```

That starts a tiny local server and opens Carry Quest in your default browser. It requires Node.js 22.13 or newer, but does **not** require `npm install`. Stop it with `Ctrl+C`.

### Try the production build on a phone or tablet

Put the computer and device on the same Wi-Fi, then run:

```bash
npm run play:mobile
```

Open the printed `Phone/tablet` address on the device. This serves the checked-in `dist/` exactly as it will be deployed.

## Controls

- Enter answer digits with the on-screen keypad or number keys.
- On touch, flick the highlighted top digit up or down.
- On desktop, press `↑` or `↓`; the game applies it to the currently required column.
- Every answer, carry, borrow, direction, column, and operation order is judged.

## Install it like an app

Carry Quest is a PWA. While `npm run play` is running, use **Install app** in Chrome or Edge to give it its own desktop window and launcher icon. For an installed mobile icon, host `dist/` on any HTTPS static host, open it in the mobile browser, then choose **Add to Home Screen**.

The same web build is used everywhere. There is deliberately no Electron, Tauri, Xcode, or Android Studio requirement in this baseline.

## Develop and verify

```bash
npm run dev
```

Edit `src/main.js`, `src/math-engine.js`, or `src/style.css`; the dev server refreshes connected browsers automatically. No dependency installation or framework toolchain is involved.

Before exporting a change:

```bash
npm run verify
```

`verify` runs the arithmetic-state tests, builds the production files, and enforces a 13 KiB gzip budget over everything in `dist/`, including the CSS-drawn art, icon, manifest, and service worker. The checked-in `dist/` is the portable export; rebuild it whenever source changes.

## Deploy to GitHub Pages

The repository includes `.github/workflows/pages.yml`. It tests the arithmetic engine, rebuilds `dist/`, enforces the compressed-size ceiling, and deploys on every push to `main`.

1. Push this repository to GitHub with `main` as the default branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to `main`, or run **Verify and deploy Carry Quest** manually from the Actions tab.

No `gh-pages` package or special branch is needed. All runtime URLs are relative, so both `https://USER.github.io/REPO/` project sites and root user sites work without a repository-name setting.

## Telemetry

Gameplay events stay in this browser under `carry-quest-events-v1`. **Insights** summarizes step accuracy, median solve time, friction codes, and place-value errors. **Export JSON** downloads the raw schema-v1 event stream for analysis. The local store is capped at 5,000 events.

The most useful event fields are:

- `expected` and `actual` action
- `phase`, `place`, `correct`, and `errorCode`
- per-step `latencyMs`
- gesture `distance` and `duration`
- per-problem `elapsedMs` and `mistakes`
- run, problem, seed, and room identifiers

## Project map

```text
src/main.js          game/UI/telemetry loop
src/math-engine.js   deterministic step validator
src/style.css        responsive UI and CSS art
public/              PWA manifest, icon, offline worker
test/                arithmetic-order regression tests
scripts/             local server and compressed-size gate
dist/                ready-to-run production export
```
