const { spawn } = require('child_process');
const path = require('path');

console.log('\n======================================================');
console.log('  Starting St. Paul Raffle App with Local SQLite');
console.log('======================================================\n');

// 1. Start the SQLite Storage Server
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  shell: true
});

// 2. Start the Angular Dev Server
const ng = spawn('npx', ['ng', 'serve'], {
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\nStopping servers...');
  server.kill('SIGINT');
  ng.kill('SIGINT');
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

