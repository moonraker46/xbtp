const fs = require('node:fs');
const path = require('node:path');
const { loadProfiles } = require('../lib/store');
const { confirm } = require('../lib/prompts');

const EXPORT_VERSION = '1.0';

async function exportProfiles(target) {
  const profiles = await loadProfiles();
  const payload = {
    xbtpExport: {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
    },
    defaults: profiles.defaults || {},
    lastUsed: profiles.lastUsed || {},
    cf: profiles.cf || {},
    btp: profiles.btp || {},
  };

  const json = JSON.stringify(payload, null, 2);

  if (!target || target === '-') {
    process.stdout.write(json + '\n');
    return;
  }

  const abs = path.resolve(target);
  if (fs.existsSync(abs)) {
    const ok = await confirm(`File '${abs}' exists. Overwrite?`, false);
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }

  fs.writeFileSync(abs, json + '\n', { mode: 0o600 });
  const cfCount = Object.keys(payload.cf).length;
  const btpCount = Object.keys(payload.btp).length;
  const hasDefaults = !!(payload.defaults.cf || payload.defaults.btp);
  console.log(`OK: exported to ${abs}`);
  console.log(`  cf profiles: ${cfCount}, btp profiles: ${btpCount}, defaults: ${hasDefaults ? 'yes' : 'no'}`);
  console.error('');
  console.error('WARNING: the export file contains usernames and passwords in PLAIN TEXT.');
  console.error('Treat it like a password — store it encrypted, delete it after transfer.');
}

module.exports = { exportProfiles };
