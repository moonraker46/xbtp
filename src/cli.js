const { Command } = require('commander');
const pkg = require('../package.json');

const program = new Command();

program
  .name('xbtp')
  .description(
    'Secure management of SAP CLI credentials (cf, btp).\n\n' +
    'Profiles are stored encrypted with AES-256-GCM. On macOS the encryption key\n' +
    'is kept in the system Keychain; on other platforms a master password is used.\n\n' +
    'Login modes (auto-selected):\n' +
    '  pty   Preferred. Allocates a pseudo-TTY and types the password into the\n' +
    '        cf/btp prompt. Password is never visible in the process list.\n' +
    '        Requires the optional dependency node-pty.\n' +
    '  arg   Fallback when node-pty is not installed. Passes the password via\n' +
    '        the native -p / --password flag. The password is briefly visible\n' +
    '        in the local process list while the login is in flight.\n\n' +
    'Override with XBTP_LOGIN_MODE=pty|arg.\n\n' +
    'Default credentials: you can store one default username/password pair for cf\n' +
    'and one for btp. Profiles created afterwards can opt into those defaults so\n' +
    'you only need to maintain one set of credentials across many profiles.',
  )
  .version(pkg.version)
  .addHelpText(
    'after',
    `
Examples:
  $ xbtp defaults set           Store default cf + btp credentials (interactive)
  $ xbtp defaults               Show current default credentials
  $ xbtp defaults rm cf         Remove cf default credentials

  $ xbtp cf add dev             Create a new CF profile "dev" (interactive)
  $ xbtp cf dev                 Run 'cf login' with the stored "dev" profile
  $ xbtp cf ls                  List all CF profiles
  $ xbtp cf rm dev              Delete the CF profile "dev"

  $ xbtp btp add prod           Create a new BTP profile "prod" (interactive)
  $ xbtp btp prod               Run 'btp login' with the stored "prod" profile
  $ xbtp btp ls                 List all BTP profiles
  $ xbtp btp rm prod            Delete the BTP profile "prod"

  $ xbtp env dev                Log in to both btp AND cf using profile "dev"
  $ xbtp ls                     List all profiles (defaults, cf, btp, env shortcuts)

  $ xbtp export backup.json     Export all profiles to JSON (plain text!)
  $ xbtp import backup.json     Merge profiles from JSON into the local store

Storage:
  Profile store:    ~/.config/xbtp/profiles.enc   (chmod 0600)
  Backend marker:   ~/.config/xbtp/meta.json
  macOS Keychain:   service "xbtp", account "master-key"

Environment variables:
  XBTP_MASTER_PASSWORD   Bypass the master-password prompt (non-macOS fallback).
  XBTP_LOGIN_MODE        Force login mode: "pty" or "arg" (default: auto).
  XBTP_CONFIG_DIR        Override the config directory location.
  XBTP_SKIP_CF_DISCOVERY Set to "1" to disable org/space auto-discovery on add.
  XBTP_BACKEND           Force storage backend: "keychain" or "password".

For per-command help, run:
  $ xbtp defaults --help
  $ xbtp cf --help
  $ xbtp btp --help
  $ xbtp env --help
`,
  );

program
  .command('defaults [action] [target]')
  .summary('Manage default cf/btp credentials used by profiles')
  .description(
    'Store, show or remove the default username/password pair for cf and btp.\n\n' +
    'When a profile is created without its own credentials, it falls back to the\n' +
    'default credentials of its type. Profiles that store their own username and\n' +
    'password always win over the defaults.\n\n' +
    'Action defaults to "show". Target defaults to "both" for set/rm.',
  )
  .addHelpText(
    'after',
    `
Actions:
  show              Show current defaults (passwords masked)         [default]
  set [target]      Set defaults interactively
  rm  [target]      Remove defaults

Targets:
  cf                Only the cf side
  btp               Only the btp side
  both              Both sides                                       [default]

Examples:
  $ xbtp defaults
  $ xbtp defaults set
  $ xbtp defaults set cf
  $ xbtp defaults set btp
  $ xbtp defaults rm cf
  $ xbtp defaults rm
`,
  )
  .action(async (action, target) => {
    const defaults = require('./commands/defaults');
    const a = action || 'show';
    if (a === 'show' || a === 'ls' || a === 'list') return defaults.show();
    if (a === 'set') return defaults.set(target);
    if (a === 'rm' || a === 'remove' || a === 'clear') return defaults.remove(target);
    throw new Error(`Unknown action '${action}'. Use: show, set, rm`);
  });

program
  .command('cf <action_or_name> [extra]')
  .summary('Cloud Foundry profile management and login')
  .description(
    'Manage Cloud Foundry profiles or log in with a stored profile.\n\n' +
    'The first argument is either a subcommand (add, rm, ls) or the name of\n' +
    'a stored profile to log in with. When using "add" or "rm", pass the\n' +
    'profile name as the second argument.\n\n' +
    'During "add" you can opt into the default cf credentials so the profile\n' +
    'inherits username and password from "xbtp defaults".',
  )
  .addHelpText(
    'after',
    `
Subcommands:
  add <name>       Create a new CF profile (interactive prompts)
  rm <name>        Delete a CF profile (with confirmation)
  ls, list         List all CF profiles
  <name>           Run 'cf login' with the stored profile

Prompts when creating (add):
  - CF API endpoint (e.g. https://api.cf.eu10.hana.ondemand.com)
  - Skip SSL validation (yes/no)
  - Use default credentials? (only if defaults are set)
  - Username (email)                    [skipped when using defaults]
  - Password (hidden input)             [skipped when using defaults]
  - Organization (picked from a list discovered via cf)
  - Space (picked from a list, optional)

xbtp logs in temporarily into an isolated CF_HOME, fetches the list of
orgs and spaces visible to the credentials, and offers them as a menu.
Each list also has "— (none, leave empty) —" and "— Enter manually —"
options. Your existing cf session is not touched.

If discovery fails (network, wrong credentials, etc.), xbtp falls back
to plain text entry. Set XBTP_SKIP_CF_DISCOVERY=1 to disable discovery.

Examples:
  $ xbtp cf add dev
  $ xbtp cf dev
  $ xbtp cf ls
  $ xbtp cf rm dev
`,
  )
  .action(async (actionOrName, extra) => {
    const cf = require('./commands/cf');
    if (actionOrName === 'add') return cf.add(extra);
    if (actionOrName === 'rm' || actionOrName === 'remove') return cf.remove(extra);
    if (actionOrName === 'ls' || actionOrName === 'list') return cf.list();
    return cf.login(actionOrName);
  });

program
  .command('btp <action_or_name> [extra]')
  .summary('SAP BTP profile management and login')
  .description(
    'Manage SAP BTP profiles or log in with a stored profile.\n\n' +
    'The first argument is either a subcommand (add, rm, ls) or the name of\n' +
    'a stored profile to log in with. When using "add" or "rm", pass the\n' +
    'profile name as the second argument.\n\n' +
    'During "add" you can opt into the default btp credentials so the profile\n' +
    'inherits username and password from "xbtp defaults".',
  )
  .addHelpText(
    'after',
    `
Subcommands:
  add <name>       Create a new BTP profile (interactive prompts)
  rm <name>        Delete a BTP profile (with confirmation)
  ls, list         List all BTP profiles
  <name>           Run 'btp login' with the stored profile

Prompts when creating (add):
  - BTP CLI URL (default: https://cli.btp.cloud.sap)
  - Subdomain (global account)
  - Use default credentials? (only if defaults are set)
  - Username (SAP S-User, e.g. S0012345678)   [skipped when using defaults]
  - Password (hidden input)                    [skipped when using defaults]

Examples:
  $ xbtp btp add prod
  $ xbtp btp prod
  $ xbtp btp ls
  $ xbtp btp rm prod
`,
  )
  .action(async (actionOrName, extra) => {
    const btp = require('./commands/btp');
    if (actionOrName === 'add') return btp.add(extra);
    if (actionOrName === 'rm' || actionOrName === 'remove') return btp.remove(extra);
    if (actionOrName === 'ls' || actionOrName === 'list') return btp.list();
    return btp.login(actionOrName);
  });

program
  .command('env <name>')
  .summary('Log in to both cf and btp with the same profile name')
  .description(
    'Convenience shortcut that runs btp login followed by cf login, using\n' +
    'the cf and btp profiles that share the given name. If only one side\n' +
    'exists, the other side is skipped with a note. btp is logged in first.\n\n' +
    'Each side resolves its credentials against the corresponding defaults\n' +
    'when the profile itself has no username/password stored.',
  )
  .addHelpText(
    'after',
    `
Examples:
  $ xbtp env dev    Run btp login + cf login using profiles named "dev"
`,
  )
  .action(async (name) => {
    const env = require('./commands/env');
    await env.login(name);
  });

program
  .command('export [file]')
  .summary('Export all profiles + defaults to a JSON file')
  .description(
    'Write all stored profiles (cf, btp, defaults, lastUsed) to a JSON file.\n\n' +
    'If no file is given (or "-"), the JSON is written to STDOUT.\n\n' +
    'WARNING: the export contains usernames and passwords in PLAIN TEXT.\n' +
    'Encrypt or delete the file after transferring it.',
  )
  .addHelpText(
    'after',
    `
Examples:
  $ xbtp export                            Write JSON to stdout
  $ xbtp export ./xbtp-backup.json         Write JSON to file (chmod 0600)
  $ xbtp export - | gpg -c > xbtp.gpg      Pipe to gpg for encrypted backup
`,
  )
  .action(async (file) => {
    const { exportProfiles } = require('./commands/export');
    await exportProfiles(file);
  });

program
  .command('import <file>')
  .summary('Import profiles from a JSON file')
  .description(
    'Merge profiles from an xbtp export JSON file into the local store.\n\n' +
    'Existing profiles with the same name prompt for overwrite confirmation.\n' +
    'Default credentials (defaults) prompt for replacement if any are set.\n' +
    'lastUsed values are filled in only where the local store has none.',
  )
  .addHelpText(
    'after',
    `
Examples:
  $ xbtp import ./xbtp-backup.json
  $ gpg -d xbtp.gpg | xbtp import /dev/stdin
`,
  )
  .action(async (file) => {
    const { importProfiles } = require('./commands/import');
    await importProfiles(file);
  });

program
  .command('ls')
  .alias('list')
  .summary('List all profiles')
  .description(
    'List all stored cf and btp profiles together with the vault location,\n' +
    'the active backend, the configured default credentials, and any\n' +
    '"env" shortcuts where both cf and btp share a profile name.\n\n' +
    'Profiles tagged [default] inherit their username/password from the\n' +
    'default credentials of their type.',
  )
  .addHelpText(
    'after',
    `
Examples:
  $ xbtp ls
  $ xbtp list
`,
  )
  .action(async () => {
    const list = require('./commands/list');
    await list.listAll();
  });

program.showHelpAfterError('(run "xbtp --help" for usage)');

program.parseAsync(process.argv).catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
