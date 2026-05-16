const fs = require('node:fs');
const path = require('node:path');
const { loadProfiles, saveProfiles } = require('../lib/store');
const { confirm } = require('../lib/prompts');

async function importProfiles(source) {
  if (!source) throw new Error('File path required: xbtp import <file>');
  const abs = path.resolve(source);
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${abs}`);
  }

  let imported;
  try {
    imported = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    throw new Error(`Invalid JSON in ${abs}: ${err.message}`);
  }

  if (!imported || typeof imported !== 'object' || !imported.xbtpExport) {
    throw new Error('Not an xbtp export file (missing xbtpExport metadata)');
  }

  const profiles = await loadProfiles();
  const summary = {
    cf: { added: [], replaced: [], skipped: [] },
    btp: { added: [], replaced: [], skipped: [] },
    defaults: false,
    lastUsed: false,
  };

  if (imported.defaults && (imported.defaults.cf || imported.defaults.btp)) {
    const hasExisting = !!(profiles.defaults && (profiles.defaults.cf || profiles.defaults.btp));
    let take = true;
    if (hasExisting) {
      take = await confirm('Replace existing default credentials with imported ones?', false);
    }
    if (take) {
      profiles.defaults = imported.defaults;
      summary.defaults = true;
    }
  }

  for (const type of ['cf', 'btp']) {
    const src = imported[type] || {};
    for (const [name, profile] of Object.entries(src)) {
      if (profiles[type][name]) {
        const ok = await confirm(`${type.toUpperCase()} profile '${name}' exists. Overwrite?`, false);
        if (ok) {
          profiles[type][name] = profile;
          summary[type].replaced.push(name);
        } else {
          summary[type].skipped.push(name);
        }
      } else {
        profiles[type][name] = profile;
        summary[type].added.push(name);
      }
    }
  }

  if (imported.lastUsed && typeof imported.lastUsed === 'object') {
    profiles.lastUsed = profiles.lastUsed || {};
    if (imported.lastUsed.cfApi && !profiles.lastUsed.cfApi) profiles.lastUsed.cfApi = imported.lastUsed.cfApi;
    if (imported.lastUsed.btpUrl && !profiles.lastUsed.btpUrl) profiles.lastUsed.btpUrl = imported.lastUsed.btpUrl;
    summary.lastUsed = true;
  }

  await saveProfiles(profiles);

  console.log('Import summary:');
  console.log(`  defaults: ${summary.defaults ? 'imported' : 'unchanged'}`);
  console.log(`  cf:       added ${summary.cf.added.length}, replaced ${summary.cf.replaced.length}, skipped ${summary.cf.skipped.length}`);
  console.log(`  btp:      added ${summary.btp.added.length}, replaced ${summary.btp.replaced.length}, skipped ${summary.btp.skipped.length}`);
  if (summary.cf.added.length) console.log(`    cf added:    ${summary.cf.added.join(', ')}`);
  if (summary.cf.replaced.length) console.log(`    cf replaced: ${summary.cf.replaced.join(', ')}`);
  if (summary.btp.added.length) console.log(`    btp added:    ${summary.btp.added.join(', ')}`);
  if (summary.btp.replaced.length) console.log(`    btp replaced: ${summary.btp.replaced.join(', ')}`);
}

module.exports = { importProfiles };
