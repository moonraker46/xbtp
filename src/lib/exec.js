const { spawn, spawnSync } = require('node:child_process');

let pty = null;
let ptyLoadError = null;
try {
  pty = require('node-pty');
} catch (err) {
  ptyLoadError = err;
}

const ANSI = /\x1b\[[0-9;]*[a-zA-Z]/g;
const PROMPT_RE = /password\s*[>:]/i;

function resolveBinPath(bin) {
  const isWin = process.platform === 'win32';
  const lookup = isWin ? 'where' : 'which';
  const res = spawnSync(lookup, [bin], { encoding: 'utf8' });
  if (res.status !== 0 || !res.stdout.trim()) {
    throw new Error(`'${bin}' not found. Please install the ${bin} CLI.`);
  }
  return res.stdout.split(/\r?\n/)[0].trim();
}

function explicitMode() {
  return (process.env.XBTP_LOGIN_MODE || '').toLowerCase();
}

function loginMode() {
  const env = explicitMode();
  if (env === 'arg') return 'arg';
  if (env === 'pty') {
    if (!pty) {
      throw new Error(
        'XBTP_LOGIN_MODE=pty but node-pty is not available. ' +
        (ptyLoadError ? `Reason: ${ptyLoadError.message}` : 'Install with: npm install node-pty'),
      );
    }
    return 'pty';
  }
  return pty ? 'pty' : 'arg';
}

function modeInfo() {
  let mode;
  try {
    mode = loginMode();
  } catch {
    mode = 'arg';
  }
  return {
    available: !!pty,
    mode,
    loadError: ptyLoadError?.message || null,
  };
}

function runPty(binPath, args, password) {
  return new Promise((resolve, reject) => {
    let term;
    try {
      term = pty.spawn(binPath, args, {
        name: 'xterm-256color',
        cols: process.stdout.columns || 80,
        rows: process.stdout.rows || 24,
        cwd: process.cwd(),
        env: process.env,
      });
    } catch (err) {
      reject(err);
      return;
    }

    let buffer = '';
    let passwordSent = false;

    const stdinForwarder = (data) => term.write(data.toString('utf8'));
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(true); } catch {}
      process.stdin.resume();
      process.stdin.on('data', stdinForwarder);
    }

    const cleanup = () => {
      if (process.stdin.isTTY) {
        try { process.stdin.setRawMode(false); } catch {}
        process.stdin.pause();
        process.stdin.off('data', stdinForwarder);
      }
    };

    term.onData((data) => {
      process.stdout.write(data);
      if (!passwordSent) {
        buffer += data;
        const clean = buffer.replace(ANSI, '');
        if (PROMPT_RE.test(clean)) {
          passwordSent = true;
          buffer = '';
          setTimeout(() => term.write(password + '\r'), 50);
        }
      }
    });

    term.onExit(({ exitCode }) => {
      cleanup();
      if (exitCode === 0) resolve();
      else reject(new Error(`process exited with code ${exitCode}`));
    });
  });
}

function runArg(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${bin} exited with code ${code}`));
    });
  });
}

function buildCfArgs(profile, withPassword) {
  const args = ['login', '-a', profile.api, '-u', profile.username];
  if (withPassword) args.push('-p', profile.password);
  args.push('-o', profile.org);
  if (profile.space && profile.space.trim()) args.push('-s', profile.space);
  if (profile.skipSslValidation) args.push('--skip-ssl-validation');
  return args;
}

function buildBtpArgs(profile, withPassword) {
  const args = [
    'login',
    '--url', profile.url,
    '--subdomain', profile.subdomain,
    '--user', profile.username,
  ];
  if (withPassword) args.push('--password', profile.password);
  return args;
}

async function attemptLogin(binName, buildArgs, profile) {
  const explicit = explicitMode();
  const mode = loginMode();

  if (mode === 'pty') {
    try {
      const binPath = resolveBinPath(binName);
      await runPty(binPath, buildArgs(profile, false), profile.password);
      return;
    } catch (err) {
      if (explicit === 'pty') throw err;
      console.error(`[xbtp] pty mode failed (${err.message}); retrying in arg mode`);
    }
  }

  await runArg(binName, buildArgs(profile, true));
}

async function cfLogin(profile) {
  await attemptLogin('cf', buildCfArgs, profile);
}

async function btpLogin(profile) {
  await attemptLogin('btp', buildBtpArgs, profile);
}

module.exports = { cfLogin, btpLogin, modeInfo };
