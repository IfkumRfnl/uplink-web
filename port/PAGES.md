# GitHub Pages build and verification

PR #1 was merged after its Codex review finding was fixed and the updated head received a completed review with no major issues. Merge commit: `518ed6259a5b85c5fcc5c7a08a85c27bd26cede4`.

The owner explicitly requested GitHub Pages publication. The original licences and authentication/integrity code remain unchanged. Runtime limitations and historical gameplay evidence are in [CLOUD_RUNTIME_RESULTS.md](CLOUD_RUNTIME_RESULTS.md).

`.github/workflows/pages.yml` builds with official Emscripten 6.0.10 on Ubuntu 24.04. It runs `npm test`, inventory verification, the separate browser harness, actual browser storage/lifecycle tests, and original-game Pages checks. Pushes to `main` deploy only after the build/test job succeeds; pull requests run checks without deploying.

`npm run prepare:pages` stages only the built game HTML/JS/Wasm/data and six OGG music files in `_site`. The game HTML becomes `index.html`; the technical harness is excluded. `build.json` records the source revision and asset sizes/hashes. Generated artifacts remain ignored by Git. No backend, threads, SharedArrayBuffer, COOP or COEP headers are required. All assets resolve relative to the page under `/uplink-web/`.

After `npm run build`, install browsers with `npm ci --ignore-scripts` and `npx playwright install chromium`, then run:

```sh
npm run prepare:pages
npm run test:pages
# Test an actual publication with a disposable browser context:
npm run test:pages -- https://ifkumrfnl.github.io/uplink-web/
```

The original-game test checks subpath loading, creates a disposable PagesQA agent through the original registration UI, starts tutorial interactions, verifies original music playback after a gesture, saves, reloads and logs back in. Screenshots, the deployed commit and results are retained in ignored `qa/pages/`. This does not repeat the complete three-section tutorial or normal mission on the live site, establish Windows visual fidelity, or assess audible mix quality.

Saves are IndexedDB data local to the site's browser origin, not cloud backups. Localhost saves are not automatically transferred. Ordinary browser direct TCP/IRC remains unsupported. Other remaining gameplay, fidelity and storage limits are documented in the runtime report.
