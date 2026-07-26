# Stackyard

Preview any public GitHub repo running live, right from its repo page — no clone, no local install.

> **Status:** early scaffold. This README will be filled in properly once the MVP core loop (see roadmap) is working end to end.

## What it does

_TBD — filled in as the MVP core loop lands._

## Scope & limitations

_TBD — will cover supported browsers, supported repo types (JS/Node first), and known gaps._

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
