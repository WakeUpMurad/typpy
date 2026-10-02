import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['scripts/speech.mjs'], { stdio: 'inherit' }),
  spawn(process.env.TYPPY_BIN || 'go', process.env.TYPPY_BIN ? [] : ['run', './server'], {
    stdio: 'inherit',
  }),
];
let stopped = false;
function stop(code = 0) {
  if (stopped) return;
  stopped = true;
  children.forEach((child) => child.kill('SIGTERM'));
  process.exitCode = code;
}
children.forEach((child) => {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => stop(code || 0));
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
