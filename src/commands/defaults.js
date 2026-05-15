const { loadProfiles, saveProfiles } = require('../lib/store');
const { askCredentials, confirm } = require('../lib/prompts');

const VALID = ['cf', 'btp', 'both'];

function normalizeTarget(target) {
  if (!target) return 'both';
  if (!VALID.includes(target)) {
    throw new Error(`Unknown target '${target}'. Use one of: ${VALID.join(', ')}`);
  }
  return target;
}

async function show() {
  const profiles = await loadProfiles();
  const d = profiles.defaults || {};
  console.log('Default credentials:');
  if (d.cf && d.cf.username) {
    console.log(`  cf:  ${d.cf.username} (password stored)`);
  } else {
    console.log('  cf:  (not set)');
  }
  if (d.btp && d.btp.username) {
    console.log(`  btp: ${d.btp.username} (password stored)`);
  } else {
    console.log('  btp: (not set)');
  }
  if (!d.cf && !d.btp) {
    console.log('');
    console.log('Set defaults with: xbtp defaults set [cf|btp|both]');
  }
}

async function set(target) {
  target = normalizeTarget(target);
  const profiles = await loadProfiles();
  if (!profiles.defaults) profiles.defaults = {};

  const doSide = async (side) => {
    const existing = profiles.defaults[side];
    if (existing && existing.username) {
      const ok = await confirm(
        `${side} defaults already set (${existing.username}). Overwrite?`,
        false,
      );
      if (!ok) {
        console.log(`Skipped ${side}.`);
        return;
      }
    }
    profiles.defaults[side] = await askCredentials(side, existing || {});
    console.log(`OK: ${side} defaults saved.`);
  };

  if (target === 'cf' || target === 'both') await doSide('cf');
  if (target === 'btp' || target === 'both') await doSide('btp');

  await saveProfiles(profiles);
}

async function remove(target) {
  target = normalizeTarget(target);
  const profiles = await loadProfiles();
  if (!profiles.defaults) profiles.defaults = {};

  if (target === 'both') {
    const hasAny = profiles.defaults.cf || profiles.defaults.btp;
    if (!hasAny) {
      console.log('No defaults set.');
      return;
    }
    const ok = await confirm('Remove ALL default credentials?', false);
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
    profiles.defaults = {};
  } else {
    if (!profiles.defaults[target]) {
      console.log(`No ${target} defaults set.`);
      return;
    }
    const ok = await confirm(`Remove ${target} default credentials?`, false);
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
    delete profiles.defaults[target];
  }

  await saveProfiles(profiles);
  console.log('OK: defaults removed.');
}

module.exports = { show, set, remove };
