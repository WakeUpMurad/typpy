import { spawn, spawnSync } from 'node:child_process';

const go = process.env.GO_BIN || 'go';
const check = spawnSync(go, ['version'], { encoding: 'utf8' });
if (check.error || check.status !== 0) {
  console.error('Go не найден. Установите Go (macOS: brew install go), затем выполните pnpm dev.');
  console.error('Для нестандартного пути: GO_BIN=/путь/к/go pnpm dev');
  process.exit(1);
}

const children = [];
let stopping = false;
const grouped = process.platform !== 'win32';
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    try {
      if (grouped) process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') console.error(error.message);
    }
  }
  process.exitCode = code;
}
function start(command, args) {
  const child = spawn(command, args, { stdio: 'inherit', detached: grouped });
  children.push(child);
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0);
  });
}
start(process.execPath, ['scripts/speech.mjs']);
start(go, ['run', './server']);
start(process.execPath, ['node_modules/vite/bin/vite.js']);
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
