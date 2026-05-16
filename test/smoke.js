const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const TEST_CONFIG_DIR = path.join(
  os.tmpdir(),
  `xbtp-smoke-${process.pid}-${Date.now()}`,
);

process.env.XBTP_CONFIG_DIR = TEST_CONFIG_DIR;
process.env.XBTP_BACKEND = 'password';
process.env.XBTP_MASTER_PASSWORD = 'smoke-test-master-password';
process.env.XBTP_SKIP_CF_DISCOVERY = '1';

const prompts = require('prompts');
const assert = require('node:assert');

function reset() {
  if (fs.existsSync(TEST_CONFIG_DIR)) {
    fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
  }
}

async function main() {
  reset();

  const cf = require('../src/commands/cf');
  const btp = require('../src/commands/btp');
  const defaults = require('../src/commands/defaults');
  const list = require('../src/commands/list');
  const { loadProfiles, resolveProfile } = require('../src/lib/store');

  console.log('--- 1) set defaults (cf + btp) ---');
  prompts.inject([
    'cf-default@example.com',
    'cfDefaultPw',
    'S0012345678',
    'btpDefaultPw',
  ]);
  await defaults.set('both');

  console.log('\n--- 2) show defaults ---');
  await defaults.show();

  console.log('\n--- 3) add cf "dev" inheriting defaults (manual org/space, discovery skipped) ---');
  prompts.inject([
    'https://api.cf.eu10.hana.ondemand.com',
    false,
    true,
    'my-org',
    'dev',
  ]);
  await cf.add('dev');

  console.log('\n--- 4) add cf "prod" with own credentials ---');
  prompts.inject([
    'https://api.cf.us10.hana.ondemand.com',
    false,
    false,
    'prod-user@example.com',
    'prodPw',
    'prod-org',
    'prod',
  ]);
  await cf.add('prod');

  console.log('\n--- 5) add btp "dev" inheriting defaults ---');
  prompts.inject([
    'https://cli.btp.cloud.sap',
    'my-subdomain',
    true,
  ]);
  await btp.add('dev');

  console.log('\n--- 6) verify resolution ---');
  const data = await loadProfiles();

  const cfDev = resolveProfile(data.cf.dev, data.defaults?.cf);
  assert.strictEqual(cfDev.username, 'cf-default@example.com');
  assert.strictEqual(cfDev.password, 'cfDefaultPw');
  assert.strictEqual(cfDev.org, 'my-org');
  assert.strictEqual(cfDev.space, 'dev');

  const cfProd = resolveProfile(data.cf.prod, data.defaults?.cf);
  assert.strictEqual(cfProd.username, 'prod-user@example.com');
  assert.strictEqual(cfProd.password, 'prodPw');

  const btpDev = resolveProfile(data.btp.dev, data.defaults?.btp);
  assert.strictEqual(btpDev.username, 'S0012345678');
  assert.strictEqual(btpDev.password, 'btpDefaultPw');

  assert.strictEqual(data.cf.dev.username, undefined);
  assert.strictEqual(data.cf.dev.password, undefined);
  assert.strictEqual(data.lastUsed.cfApi, 'https://api.cf.us10.hana.ondemand.com');
  assert.strictEqual(data.lastUsed.btpUrl, 'https://cli.btp.cloud.sap');
  console.log('OK: profile resolution + lastUsed work correctly');

  console.log('\n--- 7) ls all ---');
  await list.listAll();

  console.log('\n--- 8) change defaults, verify inheriting profile picks them up ---');
  prompts.inject([true, 'new-cf@example.com', 'newCfPw']);
  await defaults.set('cf');

  const data2 = await loadProfiles();
  const cfDev2 = resolveProfile(data2.cf.dev, data2.defaults?.cf);
  assert.strictEqual(cfDev2.username, 'new-cf@example.com');
  assert.strictEqual(data2.cf.prod.username, 'prod-user@example.com');
  console.log('OK: default change propagates');

  console.log('\n--- 9) remove btp defaults ---');
  prompts.inject([true]);
  await defaults.remove('btp');
  const data3 = await loadProfiles();
  assert.ok(!data3.defaults.btp);
  assert.ok(data3.defaults.cf);
  console.log('OK: partial removal works');

  console.log('\n--- 10) export profiles to JSON ---');
  const exportFile = path.join(os.tmpdir(), `xbtp-smoke-export-${process.pid}.json`);
  const { exportProfiles } = require('../src/commands/export');
  await exportProfiles(exportFile);
  assert.ok(fs.existsSync(exportFile));
  const exported = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
  assert.strictEqual(exported.xbtpExport.version, '1.0');
  assert.ok(exported.cf.dev);
  assert.ok(exported.cf.prod);
  assert.strictEqual(exported.cf.prod.username, 'prod-user@example.com');
  assert.ok(exported.defaults.cf);
  assert.strictEqual(exported.lastUsed.cfApi, 'https://api.cf.us10.hana.ondemand.com');
  console.log('OK: export produced valid JSON with all profiles');

  console.log('\n--- 11) wipe and re-import ---');
  prompts.inject([true]);
  await cf.remove('dev');
  prompts.inject([true]);
  await cf.remove('prod');
  prompts.inject([true]);
  await btp.remove('dev');
  prompts.inject([true]);
  await defaults.remove('both');

  const { importProfiles } = require('../src/commands/import');
  await importProfiles(exportFile);

  const after = await loadProfiles();
  assert.ok(after.cf.dev);
  assert.ok(after.cf.prod);
  assert.ok(after.btp.dev);
  assert.ok(after.defaults.cf);
  assert.strictEqual(after.cf.prod.username, 'prod-user@example.com');
  assert.strictEqual(after.lastUsed.cfApi, 'https://api.cf.us10.hana.ondemand.com');
  console.log('OK: import restored all profiles');

  fs.unlinkSync(exportFile);

  console.log('\n--- 12) cleanup ---');
  prompts.inject([true]);
  await cf.remove('dev');
  prompts.inject([true]);
  await cf.remove('prod');
  prompts.inject([true]);
  await btp.remove('dev');
  prompts.inject([true]);
  await defaults.remove('both');

  console.log('\n--- final state ---');
  await list.listAll();

  console.log('\nSMOKE TEST PASSED');
  reset();
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  reset();
  process.exit(1);
});
