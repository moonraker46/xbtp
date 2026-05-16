const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const prompts = require('prompts');
const cryptoLib = require('./crypto');
const keychain = require('./keychain');

function defaultConfigDir() {
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, 'xbtp');
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, 'xbtp');
}

const CONFIG_DIR = process.env.XBTP_CONFIG_DIR || defaultConfigDir();
const STORE_FILE = path.join(CONFIG_DIR, 'profiles.enc');
const META_FILE = path.join(CONFIG_DIR, 'meta.json');

function ensureDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

function readMeta() {
  if (!fs.existsSync(META_FILE)) return { backend: null };
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  } catch {
    return { backend: null };
  }
}

function writeMeta(meta) {
  ensureDir();
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), { mode: 0o600 });
}

async function promptMasterPassword(isNew) {
  if (process.env.XBTP_MASTER_PASSWORD) return process.env.XBTP_MASTER_PASSWORD;
  if (isNew) {
    const { pw1 } = await prompts({
      type: 'password',
      name: 'pw1',
      message: 'Set new master password (min 8 chars)',
      validate: (v) => (v && v.length >= 8) || 'At least 8 characters',
    });
    if (!pw1) throw new Error('Cancelled');
    const { pw2 } = await prompts({
      type: 'password',
      name: 'pw2',
      message: 'Confirm master password',
    });
    if (pw1 !== pw2) throw new Error('Passwords do not match');
    return pw1;
  }
  const { pw } = await prompts({
    type: 'password',
    name: 'pw',
    message: 'Master password',
  });
  if (!pw) throw new Error('Master password required');
  return pw;
}

function emptyProfiles() {
  return { defaults: {}, lastUsed: {}, cf: {}, btp: {} };
}

function resolveProfile(profile, defaults) {
  if (!profile) return profile;
  const merged = { ...profile };
  if (!merged.username && defaults?.username) merged.username = defaults.username;
  if (!merged.password && defaults?.password) merged.password = defaults.password;
  return merged;
}

function profileUsesDefaults(profile) {
  return !profile.username || !profile.password;
}

function chooseBackend() {
  const forced = (process.env.XBTP_BACKEND || '').toLowerCase();
  if (forced === 'password') return 'password';
  if (forced === 'keychain') return 'keychain';
  return keychain.isMac() ? 'keychain' : 'password';
}

async function loadProfiles() {
  ensureDir();
  const meta = readMeta();
  const storeExists = fs.existsSync(STORE_FILE);

  if (!storeExists) {
    writeMeta({ backend: chooseBackend() });
    return emptyProfiles();
  }

  const ciphertext = fs.readFileSync(STORE_FILE, 'utf8');
  let raw;
  if (meta.backend === 'keychain' && keychain.isMac()) {
    const key = await keychain.getOrCreateMacKey();
    try {
      raw = JSON.parse(cryptoLib.decryptWithKey(ciphertext, key));
    } catch {
      throw new Error('Cannot decrypt profile store (invalid keychain key)');
    }
  } else {
    const password = await promptMasterPassword(false);
    try {
      raw = JSON.parse(cryptoLib.decryptWithPassword(ciphertext, password));
    } catch {
      throw new Error('Wrong master password or corrupted store');
    }
  }
  if (!raw.defaults) raw.defaults = {};
  if (!raw.lastUsed) raw.lastUsed = {};
  if (!raw.cf) raw.cf = {};
  if (!raw.btp) raw.btp = {};
  return raw;
}

async function saveProfiles(profiles) {
  ensureDir();
  let meta = readMeta();
  const json = JSON.stringify(profiles, null, 2);

  if (!meta.backend) {
    meta.backend = chooseBackend();
    writeMeta(meta);
  }

  let ciphertext;
  if (meta.backend === 'keychain' && keychain.isMac()) {
    const key = await keychain.getOrCreateMacKey();
    ciphertext = cryptoLib.encryptWithKey(json, key);
  } else {
    const isNew = !fs.existsSync(STORE_FILE);
    const password = await promptMasterPassword(isNew);
    ciphertext = cryptoLib.encryptWithPassword(json, password);
  }
  fs.writeFileSync(STORE_FILE, ciphertext, { mode: 0o600 });
}

function backendInfo() {
  const meta = readMeta();
  if (meta.backend === 'keychain') return 'macOS Keychain';
  if (meta.backend === 'password') return 'Master password (AES-256-GCM)';
  return keychain.isMac() ? 'macOS Keychain (new)' : 'Master password (new)';
}

module.exports = {
  loadProfiles,
  saveProfiles,
  resolveProfile,
  profileUsesDefaults,
  backendInfo,
  CONFIG_DIR,
  STORE_FILE,
};
