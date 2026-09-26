import json
import subprocess
import datetime
import sys

version = '1.3.2'

# Update tauri-update.json
sig_path = f'CaiNghien_Tauri/src-tauri/target/release/bundle/nsis/cainghien_tauri_{version}_x64-setup.exe.sig'
with open(sig_path, 'r', encoding='utf-8') as f:
    signature = f.read().strip()

update_json_path = 'web/public/data/tauri-update.json'
with open(update_json_path, 'r', encoding='utf-8') as f:
    update_data = json.load(f)
    
update_data['version'] = f"v{version}"
update_data['notes'] = f"Cập nhật tự động lên phiên bản v{version}."
update_data['pub_date'] = datetime.datetime.now(datetime.timezone.utc).isoformat()

exe_url = f"https://github.com/HairBaconGamming/CaiNghien/releases/download/v{version}/cainghien_tauri_{version}_x64-setup.exe"

update_data['platforms']['windows-x86_64']['url'] = exe_url
update_data['platforms']['windows-x86_64']['signature'] = signature

with open(update_json_path, 'w', encoding='utf-8') as f:
    json.dump(update_data, f, indent=2, ensure_ascii=False)
    
# Build Web App
print("Building Web App...")
subprocess.run(['npm.cmd', 'run', 'build'], cwd='web')

# Git Commit & Tag
print("Committing to Git...")
subprocess.run(['git', 'add', '.'])
subprocess.run(['git', 'commit', '-m', f"chore(release): full auto-update release v{version}"])
subprocess.run(['git', 'tag', '-a', f"v{version}", '-m', f"Release v{version}"])
subprocess.run(['git', 'push', 'origin', 'main'])
subprocess.run(['git', 'push', 'origin', f"v{version}"])

# Create GitHub Release
print("Creating GitHub Release...")
exe_path = f"CaiNghien_Tauri/src-tauri/target/release/bundle/nsis/cainghien_tauri_{version}_x64-setup.exe"
msi_path = f"CaiNghien_Tauri/src-tauri/target/release/bundle/msi/cainghien_tauri_{version}_x64_en-US.msi"

gh_cmd = [
    'gh', 'release', 'create', f"v{version}", 
    exe_path, msi_path, sig_path,
    '--title', f"v{version}", 
    '--notes', f"Bản phát hành hỗ trợ Auto Update qua Tauri."
]
subprocess.run(gh_cmd)

# Clean up
print("Cleaning cargo...")
subprocess.run(['cargo', 'clean'], cwd='CaiNghien_Tauri/src-tauri')
print("DONE!")
