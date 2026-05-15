const { loadProfiles, resolveProfile, profileUsesDefaults } = require('../lib/store');
const { cfLogin, btpLogin, modeInfo } = require('../lib/exec');

async function login(name) {
  if (!name) throw new Error('Profile name required: xbtp env <name>');
  const profiles = await loadProfiles();
  const cf = profiles.cf[name];
  const btp = profiles.btp[name];
  if (!cf && !btp) {
    throw new Error(`No profile '${name}' found in cf or btp.`);
  }

  const mode = modeInfo().mode;

  if (btp) {
    const resolved = resolveProfile(btp, profiles.defaults?.btp);
    if (!resolved.username || !resolved.password) {
      throw new Error(
        `BTP profile '${name}' has no credentials and no default btp credentials are set.`,
      );
    }
    const tags = [];
    if (profileUsesDefaults(btp)) tags.push('default creds');
    tags.push(mode);
    console.log(`-> btp login as '${name}' [${tags.join(', ')}] (${resolved.username} @ ${resolved.subdomain})`);
    await btpLogin(resolved);
  } else {
    console.log(`(skipped) BTP profile '${name}' not found`);
  }

  if (cf) {
    const resolved = resolveProfile(cf, profiles.defaults?.cf);
    if (!resolved.username || !resolved.password) {
      throw new Error(
        `CF profile '${name}' has no credentials and no default cf credentials are set.`,
      );
    }
    const tags = [];
    if (profileUsesDefaults(cf)) tags.push('default creds');
    tags.push(mode);
    const target = resolved.space ? `${resolved.org}/${resolved.space}` : resolved.org;
    console.log(`-> cf login as '${name}' [${tags.join(', ')}] (${resolved.username} @ ${target})`);
    await cfLogin(resolved);
  } else {
    console.log(`(skipped) CF profile '${name}' not found`);
  }
}

module.exports = { login };
