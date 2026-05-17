# Changelog

All notable changes to this project are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## 1.0.2 - 2026-05-17

### Added
- `xbtp export [file]` — write all profiles + defaults + lastUsed to a JSON file (chmod 0600) or STDOUT. Plain-text passwords, intended for backups and migration.
- `xbtp import <file>` — merge profiles from a JSON export back into the local store. Per-profile overwrite confirmation, defaults replace prompt, non-destructive `lastUsed` merge.
- URL memory: the CF API endpoint and BTP CLI URL you enter for the first profile are remembered and suggested as defaults for subsequent profiles (stored in encrypted `lastUsed` section).
- `XBTP_BACKEND` environment variable to force the storage backend (`keychain` or `password`).

### Changed
- Smoke test now runs in an isolated `XBTP_CONFIG_DIR` with `XBTP_BACKEND=password`, so `npm test` no longer touches the production profile store or Keychain entry.

### Fixed
- Smoke test cleanup is also triggered on test failure.

## 1.0.1 - 2026-05-15

### Changed
- Package renamed to scoped name `@moonraker46/xbtp` on npm (unscoped `xbtp` was rejected as too similar to existing packages). The CLI binary is still invoked as `xbtp`.
- `bin.xbtp` path normalized from `./bin/xbtp.js` to `bin/xbtp.js` to silence the npm publish warning.
- Added `publishConfig.access: public` so scoped publishes work without the `--access=public` flag.

### Docs
- README enriched with shields.io badges (npm version, monthly downloads, Node version, license, platform, SAP BTP, GitHub stars/issues, PRs welcome).
- Expanded installation section with verify, upgrade and uninstall commands.

## 1.0.0 - 2026-05-15

Initial public release.

### Added
- Encrypted profile store (`AES-256-GCM` with scrypt key derivation).
- macOS Keychain integration; master-password fallback on Linux/Windows.
- CF profile management with on-the-fly org/space discovery via an isolated `CF_HOME`.
- BTP profile management (SAP S-User authentication).
- `xbtp defaults` for shared cf/btp credentials inherited by profiles.
- `xbtp env <name>` shortcut to log in to both cf and btp in one call.
- PTY-based login (`node-pty`) with arg-mode fallback when PTY is unavailable.
- Postinstall hook that rebuilds `node-pty` from source if the prebuilt binary is incompatible with the local Node version.
- Cross-platform paths (`XDG_CONFIG_HOME` / `%APPDATA%` / `XBTP_CONFIG_DIR`).
- Environment overrides: `XBTP_LOGIN_MODE`, `XBTP_MASTER_PASSWORD`, `XBTP_CONFIG_DIR`, `XBTP_SKIP_CF_DISCOVERY`.
