# Stackyard

Preview any public GitHub repo running live, right from its repo page — no clone, no local install.

> **Status:** early scaffold. This README will be filled in properly once the MVP core loop (see roadmap) is working end to end.

## What it does

_TBD — filled in as the MVP core loop lands._

## Scope & limitations

_TBD — will cover supported browsers, supported repo types (JS/Node first), and known gaps._

## Extension detection

The hosted preview page only renders its working UI when it detects it was opened via the Stackyard extension: a content script sets a marker on the page at load, and the page waits briefly for it before falling back to an "install the extension" landing state.

This is a UX nudge, not a security boundary — a visitor could still reach the page directly by other means. It becomes structurally reinforced once the Phase 2 message-relay architecture lands, since GitHub data will only be reachable through the extension at that point too.

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

## Roadmap

See [github-preview-extension-roadmap.md](./github-preview-extension-roadmap.md) for the full phased plan.
