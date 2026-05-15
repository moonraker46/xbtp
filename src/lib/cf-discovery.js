const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const TIMEOUT_MS = 20_000;

function mkTempCfHome() {
  const dir = path.join(os.tmpdir(), `xbtp-cf-${process.pid}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runCf(args, env) {
  const res = spawnSync('cf', args, { encoding: 'utf8', env, timeout: TIMEOUT_MS });
  if (res.error) {
    throw new Error(`cf ${args[0]} could not be executed: ${res.error.message}`);
  }
  if (res.status !== 0) {
    const out = (res.stderr || res.stdout || '').trim();
    const firstLine = out.split(/\r?\n/).find((l) => l.trim().length > 0) || 'unknown error';
    throw new Error(`cf ${args[0]} failed: ${firstLine}`);
  }
  return res.stdout;
}

function parseNameList(stdout) {
  const lines = stdout.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.trim().toLowerCase() === 'name');
  if (idx === -1) return [];
  return lines
    .slice(idx + 1)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function connect({ api, username, password, skipSslValidation }) {
  const tmpHome = mkTempCfHome();
  const env = { ...process.env, CF_HOME: tmpHome };
  try {
    const apiArgs = ['api', api];
    if (skipSslValidation) apiArgs.push('--skip-ssl-validation');
    runCf(apiArgs, env);
    runCf(['auth', username, password], env);
    return { env, tmpHome };
  } catch (err) {
    cleanup({ tmpHome });
    throw err;
  }
}

function listOrgs(ctx) {
  return parseNameList(runCf(['orgs'], ctx.env));
}

function listSpaces(orgName, ctx) {
  runCf(['target', '-o', orgName], ctx.env);
  return parseNameList(runCf(['spaces'], ctx.env));
}

function cleanup(ctx) {
  if (!ctx || !ctx.tmpHome) return;
  try {
    fs.rmSync(ctx.tmpHome, { recursive: true, force: true });
  } catch {}
}

module.exports = { connect, listOrgs, listSpaces, cleanup };
