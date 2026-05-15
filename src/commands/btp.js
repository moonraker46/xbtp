const { loadProfiles, saveProfiles, resolveProfile, profileUsesDefaults } = require('../lib/store');
const { askBtpProfile, confirm } = require('../lib/prompts');
const { btpLogin, modeInfo } = require('../lib/exec');

async function add(name) {
  if (!name) throw new Error('Profile name required: xbtp btp add <name>');
  const profiles = await loadProfiles();
  if (profiles.btp[name]) {
    const ok = await confirm(`BTP profile '${name}' already exists. Overwrite?`, false);
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }
  const data = await askBtpProfile(profiles.btp[name] || {}, profiles.defaults?.btp);
  profiles.btp[name] = data;
  await saveProfiles(profiles);
  const usingDefaults = !data.username || !data.password;
  console.log(`OK: BTP profile '${name}' saved${usingDefaults ? ' (using default credentials)' : ''}.`);
}

async function login(name) {
  if (!name) throw new Error('Profile name required: xbtp btp <name>');
  const profiles = await loadProfiles();
  const profile = profiles.btp[name];
  if (!profile) {
    const available = Object.keys(profiles.btp);
    const hint = available.length
      ? `Available: ${available.join(', ')}`
      : 'No BTP profiles yet. Create one: xbtp btp add <name>';
    throw new Error(`BTP profile '${name}' not found. ${hint}`);
  }
  const resolved = resolveProfile(profile, profiles.defaults?.btp);
  if (!resolved.username || !resolved.password) {
    throw new Error(
      `BTP profile '${name}' has no credentials and no default btp credentials are set. ` +
      `Run 'xbtp defaults set btp' or recreate the profile with 'xbtp btp add ${name}'.`,
    );
  }
  const tags = [];
  if (profileUsesDefaults(profile)) tags.push('default creds');
  tags.push(modeInfo().mode);
  const tag = ` [${tags.join(', ')}]`;
  console.log(`-> btp login as '${name}'${tag} (${resolved.username} @ ${resolved.subdomain})`);
  await btpLogin(resolved);
}

async function remove(name) {
  if (!name) throw new Error('Profile name required: xbtp btp rm <name>');
  const profiles = await loadProfiles();
  if (!profiles.btp[name]) throw new Error(`BTP profile '${name}' not found.`);
  const ok = await confirm(`Really delete BTP profile '${name}'?`, false);
  if (!ok) {
    console.log('Cancelled.');
    return;
  }
  delete profiles.btp[name];
  await saveProfiles(profiles);
  console.log(`OK: BTP profile '${name}' deleted.`);
}

async function list() {
  const profiles = await loadProfiles();
  const names = Object.keys(profiles.btp);
  if (names.length === 0) {
    console.log('No BTP profiles.');
    return;
  }
  console.log('BTP profiles:');
  for (const name of names.sort()) {
    const p = profiles.btp[name];
    const user = p.username || profiles.defaults?.btp?.username || '(no user)';
    const tag = profileUsesDefaults(p) ? ' [default]' : '';
    console.log(`  ${name.padEnd(20)} ${user}${tag} @ ${p.subdomain} (${p.url})`);
  }
}

module.exports = { add, login, remove, list };
