# Browser profile backups

Open **Saves** in the game header, select a profile, and choose **Export backup**.
This exports its last closed save, not unsaved progress in a running game. Keep
the downloaded `<profile>.uplink-save` filename unchanged. At the original login
screen, use **Import backup** to restore it or move it to another browser. The
profile password remains unchanged. Replacing a matching profile (including its
`.tmp` recovery copy) requires a dialog naming that profile. Cancelling leaves
both copies unchanged. Success is reported after the IndexedDB transaction.
On a brand-new browser origin, finish the original first-time registration and
log out once to reach the login screen before importing.

Version 1 is a JSON envelope containing the original filename, byte length,
base64 `.usr` bytes, and SHA-256 of the filename plus NUL plus those bytes. The
original Redshirt2 wrapper is preserved byte for byte. Imports check both the
envelope digest and the original little-endian SHA-1 wrapper checksum, the SAV62
header, world-map/game-speed fields, strict portable filenames, and an 8 MiB save
limit before any filesystem change. Unknown versions, raw `.usr` uploads,
renamed envelopes, path separators, and malformed/truncated backups are rejected.
Checksums detect damage; they do not authenticate a sender or prove every nested
game field is valid. Use backups from your own known-good profiles. Cross-port,
Steam, older save-version, and maliciously reconstructed save compatibility are
not claimed.

The small native bridge permits import only at the login screen with no pending
load and pauses the main loop during confirmation/persistence. It refreshes the
native roster after a committed import and resumes on cancellation/failure. The
live Game object is never replaced or asked to parse the upload. Files are staged
in MEMFS, atomically renamed, and persisted through the existing serialized save
queue. Failed mutation/transactions restore the old `.usr` and `.tmp` before a
later queued flush can run. If rollback itself fails, further persistence is
blocked until reload. The IndexedDB transaction is atomic; closing/reloading
before its commit retains the prior disk revision. Concurrent writes from other
tabs remain an existing IDBFS limitation; use one game tab per browser origin.

The transfer idea was inspected, without executing source or copying code, from
[arisada commit a28747ddc547e99ffb23290988b97838722768ad](https://gitlab.com/arisada/uplink-source-code/-/commit/a28747ddc547e99ffb23290988b97838722768ad).
Its direct filename-derived `.usr` overwrite was not adopted. Public source
availability provides no additional redistribution license; [RIGHTS.md](../RIGHTS.md)
continues to govern this private workbench.

Run `npm test` for format, rollback and persistence-queue cases, and
`npm run test:browser-profiles` for a real original-game profile download, import
into a browser with no profiles (completed-onboarding options only), named
overwrite/cancellation, invalid inputs, repeated operations,
aborted IndexedDB transaction, reload/password login, and live-game rejection.
CI runs both. Browser evidence belongs under ignored `qa/profiles/`.

Merge coordination: `prototype/game.html` only adds two script tags. Other shared
support edits are `port/link-game.sh`, `port/persistence.js`, Pages asset staging,
test scripts/workflow, README, and repository inventory. This branch does not edit
`prototype/display.js`, font/renderer source, or the autosave constructor. Retest
after the parent serializes the UI-scaling branch merge.
