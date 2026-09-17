const { spawn } = require('child_process');
const p = spawn('npx', ['@tauri-apps/cli', 'signer', 'generate', '-w', '.tauri'], { shell: true });
p.stdout.on('data', d => {
  console.log(d.toString());
  if (d.toString().toLowerCase().includes('password')) {
    p.stdin.write('\n');
  }
});
p.stderr.on('data', d => console.error(d.toString()));
p.on('close', code => console.log('exited with', code));
