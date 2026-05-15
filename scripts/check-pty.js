const { execSync } = require('node:child_process');

let pty;
try {
  pty = require('node-pty');
} catch {
  // node-pty not installed (optionalDependencies skipped) – nothing to do.
  process.exit(0);
}

let works = true;
try {
  const t = pty.spawn('true', [], { cols: 80, rows: 24, env: process.env });
  try { t.kill(); } catch {}
} catch (err) {
  works = false;
  console.error(`[xbtp] node-pty test failed: ${err.message}`);
}

if (works) process.exit(0);

console.error('[xbtp] Prebuilt node-pty binary not compatible with this Node version. Rebuilding from source...');
try {
  execSync('npm rebuild node-pty --build-from-source', { stdio: 'inherit' });
  console.error('[xbtp] node-pty rebuilt successfully.');
} catch (e) {
  console.error('[xbtp] node-pty rebuild failed. xbtp will use arg-mode login as fallback.');
  console.error('[xbtp] You can retry later: npm rebuild node-pty --build-from-source');
  process.exit(0);
}
