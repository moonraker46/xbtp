const { spawnSync } = require('node:child_process');
const os = require('node:os');
const crypto = require('./crypto');

const SERVICE = 'xbtp';
const ACCOUNT = 'master-key';

function isMac() {
  return os.platform() === 'darwin';
}

function findInKeychain() {
  const res = spawnSync('security', ['find-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w'], {
    encoding: 'utf8',
  });
  if (res.status === 0) return res.stdout.trim();
  return null;
}

function storeInKeychain(hexKey) {
  spawnSync('security', ['delete-generic-password', '-s', SERVICE, '-a', ACCOUNT], { stdio: 'ignore' });
  const res = spawnSync(
    'security',
    ['add-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w', hexKey, '-U'],
    { encoding: 'utf8' },
  );
  if (res.status !== 0) {
    throw new Error(`Failed to create keychain entry: ${res.stderr || res.stdout}`);
  }
}

function deleteFromKeychain() {
  spawnSync('security', ['delete-generic-password', '-s', SERVICE, '-a', ACCOUNT], { stdio: 'ignore' });
}

async function getOrCreateMacKey() {
  const hex = findInKeychain();
  if (hex) {
    const key = Buffer.from(hex, 'hex');
    if (key.length !== crypto.KEY_BYTES) {
      throw new Error('Master key in keychain is corrupted');
    }
    return key;
  }
  const key = crypto.randomKey();
  storeInKeychain(key.toString('hex'));
  return key;
}

function hasMacKey() {
  return findInKeychain() !== null;
}

module.exports = {
  isMac,
  getOrCreateMacKey,
  hasMacKey,
  deleteFromKeychain,
};
