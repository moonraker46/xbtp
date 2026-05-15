const { loadProfiles, backendInfo, STORE_FILE, profileUsesDefaults } = require('../lib/store');
const { modeInfo } = require('../lib/exec');

async function listAll() {
  const profiles = await loadProfiles();
  const cfNames = Object.keys(profiles.cf).sort();
  const btpNames = Object.keys(profiles.btp).sort();
  const defaults = profiles.defaults || {};
  const mi = modeInfo();

  console.log(`Vault:      ${STORE_FILE}`);
  console.log(`Backend:    ${backendInfo()}`);
  console.log(`Login mode: ${mi.mode}${mi.mode === 'arg' && !mi.available ? ' (install node-pty for PTY mode)' : ''}`);
  console.log('');

  console.log('Default credentials:');
  console.log(`  cf:  ${defaults.cf?.username ? defaults.cf.username + ' (password stored)' : '(not set)'}`);
  console.log(`  btp: ${defaults.btp?.username ? defaults.btp.username + ' (password stored)' : '(not set)'}`);
  console.log('');

  if (cfNames.length === 0) {
    console.log('CF profiles: (none)');
  } else {
    console.log('CF profiles:');
    for (const name of cfNames) {
      const p = profiles.cf[name];
      const user = p.username || defaults.cf?.username || '(no user)';
      const tag = profileUsesDefaults(p) ? ' [default]' : '';
      const target = p.space ? `${p.org}/${p.space}` : p.org;
      console.log(`  ${name.padEnd(20)} ${user}${tag} @ ${target}`);
    }
  }
  console.log('');
  if (btpNames.length === 0) {
    console.log('BTP profiles: (none)');
  } else {
    console.log('BTP profiles:');
    for (const name of btpNames) {
      const p = profiles.btp[name];
      const user = p.username || defaults.btp?.username || '(no user)';
      const tag = profileUsesDefaults(p) ? ' [default]' : '';
      console.log(`  ${name.padEnd(20)} ${user}${tag} @ ${p.subdomain}`);
    }
  }
  console.log('');
  const shared = cfNames.filter((n) => btpNames.includes(n));
  if (shared.length) {
    console.log(`env shortcuts (cf+btp): ${shared.join(', ')}`);
  }
}

module.exports = { listAll };
