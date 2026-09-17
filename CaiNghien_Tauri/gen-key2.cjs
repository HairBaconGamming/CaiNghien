const { spawn } = require('child_process');
const p = spawn('npx.cmd', ['@tauri-apps/cli', 'signer', 'generate', '-w', '.tauri'], { shell: false });
p.stdout.on('data', d => {
  const out = d.toString();
  console.log(out);
  if (out.toLowerCase().includes('password')) {
    p.stdin.write('\r\n');
  }
});
p.stderr.on('data', d => console.error(d.toString()));
p.on('close', code => console.log('exited with', code));
