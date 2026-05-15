const crypto = require('node:crypto');

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SALT_BYTES = 16;
const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function randomKey() {
  return crypto.randomBytes(KEY_BYTES);
}

function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, KEY_BYTES, SCRYPT_PARAMS);
}

function encryptWithKey(plaintext, key) {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new Error('Key must be 32 bytes long');
  }
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function decryptWithKey(payload, key) {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

function encryptWithPassword(plaintext, password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = deriveKey(password, salt);
  const inner = encryptWithKey(plaintext, key);
  return Buffer.concat([salt, Buffer.from(inner, 'base64')]).toString('base64');
}

function decryptWithPassword(payload, password) {
  const buf = Buffer.from(payload, 'base64');
  const salt = buf.subarray(0, SALT_BYTES);
  const rest = buf.subarray(SALT_BYTES).toString('base64');
  const key = deriveKey(password, salt);
  return decryptWithKey(rest, key);
}

module.exports = {
  randomKey,
  encryptWithKey,
  decryptWithKey,
  encryptWithPassword,
  decryptWithPassword,
  KEY_BYTES,
};
