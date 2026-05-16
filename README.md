# xbtp

[![npm version](https://img.shields.io/npm/v/@moonraker46/xbtp?color=cb3837&label=npm&logo=npm)](https://www.npmjs.com/package/@moonraker46/xbtp)
[![npm downloads](https://img.shields.io/npm/dm/@moonraker46/xbtp?color=8d8d8d&logo=npm&label=downloads)](https://www.npmjs.com/package/@moonraker46/xbtp)
[![Node.js](https://img.shields.io/node/v/@moonraker46/xbtp?color=339933&logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/npm/l/@moonraker46/xbtp?color=blue)](LICENSE)

[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)](#platform-support)
[![Built for SAP BTP](https://img.shields.io/badge/built%20for-SAP%20BTP-0070f2?logo=sap)](https://www.sap.com/products/technology-platform.html)
[![GitHub stars](https://img.shields.io/github/stars/moonraker46/xbtp?logo=github&style=flat)](https://github.com/moonraker46/xbtp/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/moonraker46/xbtp?logo=github)](https://github.com/moonraker46/xbtp/issues)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/moonraker46/xbtp/pulls)

Secure management of multiple SAP CLI credentials (`cf`, `btp`) from the command line.

Profiles are stored encrypted (AES-256-GCM). On macOS the encryption key lives in the system Keychain; on Linux/Windows a master password is used as a fallback. You can also store one default username/password pair per CLI and have profiles inherit from it.

## Install

```bash
npm install -g @moonraker46/xbtp
```

Then run `xbtp --help` to see all commands. The package is published on npmjs at [`@moonraker46/xbtp`](https://www.npmjs.com/package/@moonraker46/xbtp); the CLI binary is `xbtp` (unscoped).

## Requirements

- Node.js >= 18 (tested through Node 24)
- Cloud Foundry CLI (`cf`) installed and on `PATH`
- SAP BTP CLI (`btp`) installed and on `PATH`

## Platform support

| Platform | Status | Storage backend | Login mode |
|----------|--------|-----------------|------------|
| macOS (Intel + Apple Silicon) | ✓ | Keychain (default) | pty (preferred), arg fallback |
| Linux | ✓ | Master password (AES-256-GCM via scrypt) | pty (preferred), arg fallback |
| Windows 10/11 | ✓ | Master password (AES-256-GCM via scrypt) | pty (preferred via ConPTY), arg fallback |

Note: on Windows the encrypted store is protected by your Windows user profile (NTFS ACLs) plus the AES master-password layer. POSIX `chmod 600` is a no-op there.

## Installation details

### From npm (recommended)

```bash
npm install -g @moonraker46/xbtp
```

Verify:

```bash
xbtp --version
xbtp --help
```

To upgrade later:

```bash
npm update -g @moonraker46/xbtp
```

To uninstall:

```bash
npm uninstall -g @moonraker46/xbtp
```

### From source

```bash
git clone https://github.com/moonraker46/xbtp.git
cd xbtp
npm install
npm link            # makes 'xbtp' globally available from the cloned tree
```

### About `node-pty`

The optional dependency `node-pty` is installed automatically. A `postinstall` hook verifies the prebuilt binary works on the local Node version and rebuilds from source if not. If `node-pty` is unavailable for any reason, xbtp falls back to `arg` login mode — the tool is never blocked by it.

## Quick start

```bash
# 1) Store default credentials once
xbtp defaults set                  # asks for cf user/pw and btp user/pw

# 2) Create profiles - they inherit the defaults
xbtp cf add dev                    # API, org, space ...
xbtp btp add dev                   # URL, subdomain ...

# 3) Log in
xbtp env dev                       # btp login + cf login in one call
```

## Default credentials

Defaults let you keep one cf-user and one btp-user (with passwords) and reuse them across many profiles. Each profile can still override them by storing its own username/password.

```bash
xbtp defaults                      # show current defaults (password masked)
xbtp defaults set                  # set cf and btp defaults
xbtp defaults set cf               # set only cf defaults
xbtp defaults set btp              # set only btp defaults
xbtp defaults rm                   # remove all defaults (with confirm)
xbtp defaults rm cf                # remove only cf defaults
```

When creating a profile (`xbtp cf add` / `xbtp btp add`), if defaults are set you are asked whether to inherit them. Answer **yes** to skip the username/password prompts and let the profile follow the defaults; answer **no** to enter profile-specific credentials.

Profiles that inherit defaults appear as `[default]` in `xbtp ls`. If you change the defaults later, all inheriting profiles pick up the new values automatically.

## Profiles

### Create

```bash
xbtp cf add dev                    # prompts: API, ssl-skip, [creds], then auto-discovers orgs and spaces
xbtp btp add dev                   # prompts: URL, subdomain, [creds]
```

When adding a CF profile, xbtp logs in temporarily (in an isolated `CF_HOME` so your real cf session is not touched) and shows the available orgs and spaces as a selection menu. Each menu has additional `— (none, leave empty) —` and `— Enter manually —` entries. If discovery fails (network/credentials) it falls back to text entry. Disable with `XBTP_SKIP_CF_DISCOVERY=1`.

### Log in

```bash
xbtp cf dev                        # cf login with profile "dev"
xbtp btp dev                       # btp login with profile "dev"
xbtp env dev                       # btp + cf login with same profile name
```

### List

```bash
xbtp ls                            # everything (defaults, cf, btp, env shortcuts)
xbtp cf ls                         # cf only
xbtp btp ls                        # btp only
xbtp defaults                      # default credentials only
```

### Delete

```bash
xbtp cf rm dev
xbtp btp rm dev
```

### URL memory

The CF API endpoint you enter for the *first* profile is remembered and offered as the default when you create the *next* CF profile. Same for the BTP CLI URL. So you only type your landscape's API URL once.

If you want a different URL for a particular profile, just overwrite the suggestion.

## Export / Import

For backups, sharing between machines, or migrating to a new laptop:

```bash
xbtp export backup.json              # write all profiles + defaults to JSON
xbtp export                          # write JSON to STDOUT
xbtp export - | gpg -c > xbtp.gpg    # encrypted backup via gpg

xbtp import backup.json              # merge profiles into the local store
gpg -d xbtp.gpg | xbtp import /dev/stdin
```

The export file contains usernames **and passwords in plain text** so you can move credentials between systems. Treat the file like a secret — encrypt it, then delete it after transfer.

Import merges into the existing store: name collisions prompt for overwrite confirmation per profile, default credentials prompt once if any are already set, and `lastUsed` URLs are kept where the local store already has them.

JSON format:

```json
{
  "xbtpExport": { "version": "1.0", "exportedAt": "..." },
  "defaults":   { "cf": { "username": "...", "password": "..." }, "btp": { ... } },
  "lastUsed":   { "cfApi": "...", "btpUrl": "..." },
  "cf":         { "dev": { "api": "...", "org": "...", ... } },
  "btp":        { "dev": { "url": "...", "subdomain": "...", ... } }
}
```

## Security

- Profile store lives at `~/.config/xbtp/profiles.enc` with `chmod 600`.
- macOS: a random 32-byte AES key is stored in the login Keychain via `security` (service `xbtp`, account `master-key`).
- Linux/Windows: master password is derived to an AES key via scrypt. Optional `XBTP_MASTER_PASSWORD` environment variable.

### Login modes

xbtp picks the safer mode automatically. Force a specific mode with `XBTP_LOGIN_MODE=pty|arg`.

| Mode | How it works | Trade-off |
|------|--------------|-----------|
| `pty` | Allocates a pseudo-TTY via `node-pty` and types the password into cf/btp's prompt. | Password is **not** visible in `ps aux` / shell history. Requires the optional native dependency `node-pty`. |
| `arg` | Passes the password as `-p` / `--password` flag. | Works without native deps. Password briefly visible in `ps aux` during the login window. Never in shell history (spawn bypasses the shell). |

`xbtp ls` shows which mode is currently active.

`npm install` installs `node-pty` automatically (as `optionalDependencies`). A `postinstall` script verifies that the prebuilt binary actually works on the local Node version and rebuilds from source if not (needed e.g. on Node 24 where the published 1.1.0 prebuilt binary's ABI is incompatible).

If a login ever fails with `posix_spawnp failed`, the runtime falls back to `arg` mode automatically. To force a fresh build:

```bash
npm rebuild node-pty --build-from-source
```

Compilation requires Python 3 and Xcode Command Line Tools (`xcode-select --install`) on macOS.

## Files

The config directory is chosen per platform:

| Platform | Path |
|----------|------|
| macOS / Linux | `$XDG_CONFIG_HOME/xbtp/` (defaults to `~/.config/xbtp/`) |
| Windows | `%APPDATA%\xbtp\` (typically `C:\Users\<user>\AppData\Roaming\xbtp\`) |

Override anywhere with the `XBTP_CONFIG_DIR` environment variable.

Contents:
- `profiles.enc` – encrypted profile store (defaults + cf + btp profiles)
- `meta.json` – records the active backend (`keychain` or `password`)

## Backup / Reset

- Backup: `~/.config/xbtp/profiles.enc` plus, on macOS, the Keychain entry (Keychain Access > `xbtp`).
- Reset: `rm -rf ~/.config/xbtp && security delete-generic-password -s xbtp -a master-key`

## Help

```bash
xbtp --help
xbtp defaults --help
xbtp cf --help
xbtp btp --help
xbtp env --help
xbtp export --help
xbtp import --help
```

## Notes

- BTP login uses an **SAP S-User ID** as the username (e.g. `S0012345678`), not a generic email.
- CF on SAP BTP typically accepts either an email or an S-User depending on the landscape configuration.

## Limitations

Only user/password authentication is supported (no SSO, IdP, JWT, or 2FA).
