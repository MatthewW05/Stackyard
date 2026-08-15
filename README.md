# Stackyard

Preview any public GitHub repo running live, right from its repo page — no clone, no local install.

[![CI](https://github.com/MatthewW05/Stackyard/actions/workflows/ci.yml/badge.svg)](https://github.com/MatthewW05/Stackyard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> **Status:** the core preview loop is complete and working end to end in both Chrome and Firefox. Not yet published to the Chrome Web Store or Firefox Add-ons — see [Getting Started](#getting-started) to run it from source.

## Demo

![Stackyard demo: clicking the Preview button on a GitHub repo page, then playing a live-running React app](./docs/demo.gif)

Signed in through the extension (for the higher 5,000 requests/hour rate limit) — clicking **Preview** on a repo page, then a quick play-through of a small React app once the live dev server finishes booting.

## Table of Contents

- [Demo](#demo)
- [Features](#features)
- [How It Works](#how-it-works)
- [Getting Started](#getting-started)
- [Scope & Limitations](#scope--limitations)
- [Privacy & Permissions](#privacy--permissions)
- [Development](#development)
- [Credits](#credits)
- [License](#license)

## Features

- **One-click live preview** — a "Preview" button is injected directly into GitHub's own repo header UI; no separate site to visit first.
- **Runs a real dev server, not a mock** — boots an actual Node.js environment in the browser via [WebContainers](https://webcontainers.io/), runs `npm install` and the repo's detected dev/start script, and streams the install/build output live.
- **Static-site fallback** — repos with no `package.json` (plain HTML/CSS/JS) are served directly instead of failing.
- **Honest failure states** — repo types that can't run in this sandbox (Python, Ruby, Java, and other non-Node stacks) get a specific, immediate explanation instead of a silent hang or a generic error.
- **Optional GitHub sign-in** — OAuth Device Flow, running entirely inside the extension with no backend server. Raises the API rate limit from 60 to 5,000 requests/hour and unlocks private-repo previews.
- **On-by-default caching** — a local TTL cache plus ETag-based revalidation means repeat visits to the same repo are near-instant and don't cost extra API calls, without ever serving stale data.
- **Cross-browser** — Chrome and Firefox are both fully supported, including WebContainers' cross-origin-isolation requirements (see [`WEBCONTAINER_NOTES.md`](./WEBCONTAINER_NOTES.md) for the Firefox-specific gotchas this took to get right).

## How It Works

1. A content script matches GitHub repo pages and injects a **Preview** button into the existing header UI.
2. Clicking it asks the background script to open a new tab pointed at Stackyard's hosted preview page (on Vercel), passing the repo's `owner`/`repo` as query params.
3. The hosted page can't run inside the extension itself — Firefox doesn't allow a packaged extension page to become cross-origin isolated, which `WebContainer.boot()` requires (see [`WEBCONTAINER_NOTES.md`](./WEBCONTAINER_NOTES.md)). Hosting it as a real page lets it set its own COOP/COEP headers in every browser instead.
4. The hosted page never talks to GitHub directly. It relays every request through the extension — page → content script → background script → GitHub's REST API — so a visitor without the extension installed can't pull real repo data through it at all (see [Privacy & Permissions](#privacy--permissions)).
5. The extension fetches the repo's file tree and returns it to the page, which mounts it into a WebContainer, detects the project type (Node project vs. static site vs. unsupported), runs `npm install` and the dev/start script, and points an iframe at the running dev server once it's ready.

## Getting Started

Stackyard isn't published to the Chrome Web Store or Firefox Add-ons yet — for now, install it from source.

### Install the extension

```bash
git clone https://github.com/MatthewW05/Stackyard.git
cd Stackyard
npm install
npm run build           # Chrome (Manifest V3)
npm run build:firefox   # Firefox (Manifest V2)
```

Then load the unpacked build:

- **Chrome:** go to `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select `.output/chrome-mv3`.
- **Firefox:** go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", and select `.output/firefox-mv2/manifest.json`.

### Use it

1. Open any public GitHub repository page (e.g. `github.com/<owner>/<repo>`).
2. Click the **Preview** button injected next to Star/Fork/Watch.
3. A new tab opens Stackyard's hosted preview page, which boots a WebContainer, fetches the repo's files, installs dependencies, and runs its dev server — all in the browser, with no clone and no local install.
4. Optional: open the extension popup and sign in with GitHub to raise the API rate limit from 60 to 5,000 requests/hour and preview private repos you have access to.

## Extension detection

The hosted preview page only renders its working UI when it detects it was opened via the Stackyard extension: a content script sets a marker on the page at load, and the page waits briefly for it before falling back to an "install the extension" landing state.

This is a UX nudge, not a hard security boundary — a visitor could still reach the page directly by other means. In practice it's backed up structurally too: the hosted page has no direct path to GitHub at all, since every request is relayed through the extension (see [How It Works](#how-it-works)).

## Credits

Live previews are powered by [WebContainers](https://webcontainers.io/) (StackBlitz). Credit and links will be expanded here.

## Development

Built with [WXT](https://wxt.dev/) (React + TypeScript), targeting Chrome and Firefox.

```bash
npm install

npm run dev           # Chrome, with HMR
npm run dev:firefox   # Firefox, with HMR

npm run build          # production build, Chrome
npm run build:firefox  # production build, Firefox

npm run lint     # ESLint
npm run format   # Prettier (writes)
npm run compile  # TypeScript check, no emit
```

Loading the unpacked build:

- **Chrome:** `chrome://extensions` → enable Developer Mode → "Load unpacked" → select `.output/chrome-mv3`
- **Firefox:** `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on" → select `.output/firefox-mv2/manifest.json`
