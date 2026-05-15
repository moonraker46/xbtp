const { loadProfiles, saveProfiles, resolveProfile, profileUsesDefaults } = require('../lib/store');
const { askCfBasics, pickFromList, askText, confirm } = require('../lib/prompts');
const { cfLogin, modeInfo } = require('../lib/exec');
const cfDiscovery = require('../lib/cf-discovery');

async function pickOrgSpace(basics, existing, profilesDefaults) {
  const username = basics.username || profilesDefaults?.cf?.username;
  const password = basics.password || profilesDefaults?.cf?.password;
  const skipDiscovery = process.env.XBTP_SKIP_CF_DISCOVERY === '1';

  let org = existing?.org || '';
  let space = existing?.space || '';

  const fallback = async () => {
    org = await askText({ message: 'Organization', initial: existing?.org || '', isRequired: true });
    space = await askText({ message: 'Space (optional)', initial: existing?.space || '', isRequired: false });
  };

  if (skipDiscovery || !username || !password) {
    if (!skipDiscovery) console.log('(no credentials available - skipping CF discovery)');
    await fallback();
    return { org, space };
  }

  let ctx = null;
  try {
    console.log('Connecting to CF and fetching orgs...');
    ctx = cfDiscovery.connect({
      api: basics.api,
      username,
      password,
      skipSslValidation: basics.skipSslValidation,
    });

    const orgs = cfDiscovery.listOrgs(ctx);
    if (orgs.length === 0) {
      console.log('No orgs returned for this user.');
      org = await askText({ message: 'Organization', initial: existing?.org || '', isRequired: true });
    } else {
      org = await pickFromList({
        message: `Organization (${orgs.length} found)`,
        items: orgs,
        allowNone: true,
        initial: existing?.org || '',
      });
    }

    if (!org) {
      console.log('No org selected - space discovery skipped.');
      space = '';
      return { org, space };
    }

    console.log(`Fetching spaces in '${org}'...`);
    const spaces = cfDiscovery.listSpaces(org, ctx);
    if (spaces.length === 0) {
      console.log('No spaces in this org.');
      space = '';
    } else {
      space = await pickFromList({
        message: `Space (${spaces.length} found, optional)`,
        items: spaces,
        allowNone: true,
        initial: existing?.space || '',
      });
    }
  } catch (err) {
    console.error(`CF discovery failed: ${err.message}`);
    console.log('Falling back to manual entry.');
    await fallback();
  } finally {
    cfDiscovery.cleanup(ctx);
  }

  return { org, space };
}

async function add(name) {
  if (!name) throw new Error('Profile name required: xbtp cf add <name>');
  const profiles = await loadProfiles();
  const existing = profiles.cf[name];
  if (existing) {
    const ok = await confirm(`CF profile '${name}' already exists. Overwrite?`, false);
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }

  const basics = await askCfBasics(existing || {}, profiles.defaults?.cf);
  const { org, space } = await pickOrgSpace(basics, existing, profiles.defaults);

  const data = {
    api: basics.api,
    org,
    space,
    skipSslValidation: basics.skipSslValidation,
  };
  if (basics.username) data.username = basics.username;
  if (basics.password) data.password = basics.password;

  profiles.cf[name] = data;
  await saveProfiles(profiles);
  const usingDefaults = !data.username || !data.password;
  console.log(`OK: CF profile '${name}' saved${usingDefaults ? ' (using default credentials)' : ''}.`);
}

async function login(name) {
  if (!name) throw new Error('Profile name required: xbtp cf <name>');
  const profiles = await loadProfiles();
  const profile = profiles.cf[name];
  if (!profile) {
    const available = Object.keys(profiles.cf);
    const hint = available.length
      ? `Available: ${available.join(', ')}`
      : 'No CF profiles yet. Create one: xbtp cf add <name>';
    throw new Error(`CF profile '${name}' not found. ${hint}`);
  }
  const resolved = resolveProfile(profile, profiles.defaults?.cf);
  if (!resolved.username || !resolved.password) {
    throw new Error(
      `CF profile '${name}' has no credentials and no default cf credentials are set. ` +
      `Run 'xbtp defaults set cf' or recreate the profile with 'xbtp cf add ${name}'.`,
    );
  }
  const tags = [];
  if (profileUsesDefaults(profile)) tags.push('default creds');
  tags.push(modeInfo().mode);
  const tag = ` [${tags.join(', ')}]`;
  const target = resolved.space ? `${resolved.org}/${resolved.space}` : resolved.org;
  console.log(`-> cf login as '${name}'${tag} (${resolved.username} @ ${target})`);
  await cfLogin(resolved);
}

async function remove(name) {
  if (!name) throw new Error('Profile name required: xbtp cf rm <name>');
  const profiles = await loadProfiles();
  if (!profiles.cf[name]) throw new Error(`CF profile '${name}' not found.`);
  const ok = await confirm(`Really delete CF profile '${name}'?`, false);
  if (!ok) {
    console.log('Cancelled.');
    return;
  }
  delete profiles.cf[name];
  await saveProfiles(profiles);
  console.log(`OK: CF profile '${name}' deleted.`);
}

async function list() {
  const profiles = await loadProfiles();
  const names = Object.keys(profiles.cf);
  if (names.length === 0) {
    console.log('No CF profiles.');
    return;
  }
  console.log('CF profiles:');
  for (const name of names.sort()) {
    const p = profiles.cf[name];
    const user = p.username || profiles.defaults?.cf?.username || '(no user)';
    const tag = profileUsesDefaults(p) ? ' [default]' : '';
    const target = p.space ? `${p.org}/${p.space}` : p.org || '(no org)';
    console.log(`  ${name.padEnd(20)} ${user}${tag} @ ${target} (${p.api})`);
  }
}

module.exports = { add, login, remove, list };
