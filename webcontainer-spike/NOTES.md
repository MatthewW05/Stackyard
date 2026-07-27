# WebContainer spike — findings

Throwaway proof-of-concept for `spike/webcontainer-hello-world`. Not merged as-is; feeds `feature/webcontainer-page` in Phase 1.

## Setup that worked

- Dev server: plain Vite, with `server.headers` in `vite.config.js` setting:
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `Cross-Origin-Opener-Policy: same-origin`
- These two headers make the page **cross-origin isolated** (`window.crossOriginIsolated === true`), which is what unlocks `SharedArrayBuffer`. `WebContainer.boot()` throws immediately if this isn't true — checking `crossOriginIsolated` before calling `boot()` gives a clear error instead of a confusing one from inside the library.
- `@webcontainer/api` bundles fine through Vite's normal dependency pre-bundling — no special config needed beyond the headers.
- Confirmed via `curl -I` that Vite actually sends both headers (config alone isn't proof — worth checking with curl/DevTools Network tab any time this gets reconfigured later, e.g. when this becomes an actual extension page in Phase 1).

## API shape used (carries over to `feature/webcontainer-page`)

1. `WebContainer.boot()` — async, returns the instance. **Can only be called once per page** — booting twice throws. Matters in Phase 1 because Vite HMR / React effects re-running in dev can trigger a second boot if not guarded.
2. `instance.mount(fileTree)` — writes files into the container's virtual filesystem in one shot.
3. `instance.on('server-ready', (port, url) => ...)` — fires once a process inside the container starts listening on a port. `url` is a unique proxied URL — that's what you point an iframe's `src` at, not `localhost:<port>`.
4. `instance.spawn(cmd, args)` — returns a process; `process.output` is a stream you pipe to see stdout/stderr live. Used here for a zero-dependency `node:http` server so the spike needed no `npm install` step. Phase 1's `feature/npm-install-run` will need this same output-streaming pattern for `npm install` and the dev-server process, since those take real time and users need to see progress.

## Browser support — the actual gotcha

- **Chrome/Chromium**: full support, `crossOriginIsolated` + `SharedArrayBuffer` + WebContainers all work as documented.
- **Firefox**: officially **alpha support** per StackBlitz's own docs. Firefox does support COOP/COEP and `SharedArrayBuffer` as a general web-platform feature (has since ~2020), so the _headers/isolation_ part of this spike works fine in Firefox. The catch is deeper: Firefox doesn't fully implement the "new mode" of cross-origin isolation StackBlitz relies on, and their docs specifically call out that **third-party assets can get blocked in a preview iframe** in Firefox, with "open the preview in a separate window" as their suggested workaround.
  - Our hello-world page doesn't hit this — it has no external/third-party assets, just one inline HTML string served from the container itself — so it should render fine in the iframe on both browsers.
  - This becomes a real risk in Phase 1/2 once we're previewing arbitrary real repos: a Vite/React dev server pulling in fonts, images, or other cross-origin requests could hit this Firefox limitation. Worth explicitly testing a repo with external assets early in `feature/webcontainer-page`, and having "open preview in a new tab" as a fallback ready rather than assuming the iframe always works.
- **COEP `credentialless` vs `require-corp`**: `credentialless` is the more forgiving mode (doesn't require every embedded resource to opt in via CORP headers), but it's Chromium-only — Firefox has no timeline for it and Safari has said they won't implement it. `require-corp` (what we used) is the only option that works across all three, so that's the right default for this project's stated Chrome + Firefox scope.

## Confirmed: packaged extension pages cannot be cross-origin isolated in Firefox

This spike gets its headers from Vite's dev server config — that mechanism won't exist once this is a packaged extension page (no server sitting in front of a built extension). The real mechanism differs by browser, and it's not symmetric:

- **Chrome (MV3)**: extensions can self-declare COOP/COEP directly in `manifest.json` — no server needed:
  ```json
  "cross_origin_embedder_policy": { "value": "require-corp" },
  "cross_origin_opener_policy": { "value": "same-origin" }
  ```
- **Firefox: confirmed unsupported, not just undocumented.** Loading an extension with these keys produces two explicit warnings: `Reading manifest: Warning processing cross_origin_embedder_policy: An unexpected property was found in the WebExtension manifest.` (and the same for `cross_origin_opener_policy`). Firefox doesn't silently ignore them — it rejects them as unrecognized. Result: `crossOriginIsolated: false`, `SharedArrayBuffer` unavailable, inside any `moz-extension://` page. There is no manifest-level workaround; this is a firm platform limitation, not a documentation gap.

### Why "open it in a full tab instead of a popup" doesn't fix it on its own

Tempting fix: instead of booting the WebContainer in the extension's popup, open a full browser tab (still an extension page) with an iframe pointed at the WebContainer's internal preview URL. **This does not work in Firefox.** Cross-origin isolation is a property of the _entire document chain_ — every ancestor frame up to the top-level document must be isolated for a nested iframe to be isolated. If the top-level document is an unisolated `moz-extension://...` page (which it necessarily is in Firefox, per above), everything nested inside it — including an iframe pointing at a perfectly well-configured external page — inherits that lack of isolation. The popup-vs-tab distinction is irrelevant; what matters is the origin scheme of the _top-level_ document.

### The actual fix: real top-level navigation to a page you host

A real HTTP(S) server can set whatever headers it wants, in every browser — that's exactly what this spike's own `vite.config.js` has been demonstrating the whole time. So `feature/webcontainer-page` should be:

1. The extension injects its "Preview" button/UI on the GitHub repo page (`feature/content-script-button`, unaffected by any of this).
2. On click: `browser.tabs.create({ url: 'https://<your-hosted-domain>/preview?owner=X&repo=Y' })` — a genuine top-level navigation to a page **you host** (GitHub Pages, Vercel, Netlify, anything with header control), not to an extension-owned page.
3. That hosted page is functionally what already exists in this spike folder: check `crossOriginIsolated`, `WebContainer.boot()`, mount, spawn, and its own internal `<iframe>` for the running dev server — all of which is safe to nest, because now the _top-level_ document is the one that's properly isolated.

This changes the shape of `feature/webcontainer-page` from "a page bundled into the extension" to "the extension links out to a page you host separately" — worth deciding as the first task of that branch, not discovering mid-build.

## Follow-up experiments — results

### Test A — does a packaged extension page actually get cross-origin isolated? (`extension-check/`)

- [x] Chrome: `crossOriginIsolated: true`, `SharedArrayBuffer available: true`
- [x] Firefox: `crossOriginIsolated: false`, `SharedArrayBuffer available: false`, plus the two "unexpected property" manifest warnings above. **Confirmed blocker for the packaged-page approach; resolved by the hosted-page architecture above.**

### Test B — does Firefox's iframe actually block a real cross-origin asset? (`external-asset-check.html`)

- [x] Chrome: image renders in the iframe.
- [x] Firefox: image renders in the iframe too — StackBlitz's documented "third-party assets blocked" issue did **not** reproduce for a plain cross-origin `<img>`.

Caveat: this is one image from `avatars.githubusercontent.com`, which likely sends permissive CORP/CORS headers already. Real Vite/React dev servers pull in heavier stuff — `@font-face` assets, HMR websocket connections, dynamically-imported chunks — that weren't tested here. Treat this as "no evidence of a problem at the simple end," not "confirmed non-issue for all real repos." Worth revisiting with an actual framework's dev-server output once `feature/webcontainer-page` exists for real (and once it's a hosted page rather than an extension page, per the fix above — that's the config it'll actually run under).

## Licensing — flag for later, not blocking now

StackBlitz's docs state a commercial license is required for "production usage... in a commercial, for-profit setting," but prototypes/POCs are exempt, and the docs don't explicitly address free/open-source personal projects. Worth a direct confirmation with StackBlitz before Phase 3 publishing (same flag as in the main README's Credits section) — doesn't block this spike or the MVP build.

## Verified

- [x] Standalone page served with COOP/COEP headers (confirmed via `curl -I`)
- [x] Dev server boots clean, `@webcontainer/api` resolves through Vite with no build errors
- [x] Manual confirmation in an actual Chrome window: `crossOriginIsolated`/`SharedArrayBuffer` true, iframe renders "Hello from inside a WebContainer!"
- [x] Same manual confirmation in an actual Firefox window

All four Definition of Done items for `spike/webcontainer-hello-world` are met. Manually confirmed working in both browsers.
