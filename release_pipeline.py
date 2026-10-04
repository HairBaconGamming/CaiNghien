import os
import json
import subprocess
import datetime
import sys

def run_cmd(cmd, cwd=None, env=None):
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, env=env)
    if result.returncode != 0:
        print(f"Command failed with exit code {result.returncode}")
        sys.exit(1)

def main():
    # 1. Get current version from tauri.conf.json
    with open('CaiNghien_Tauri/src-tauri/tauri.conf.json', 'r', encoding='utf-8') as f:
        tauri_conf = json.load(f)
    version = tauri_conf['version']
    print(f"--- Starting Release Pipeline for v{version} ---")

    # 2. Build Tauri App with Signer
    env = os.environ.copy()
    key_path = os.path.abspath('CaiNghien_Tauri/tauri.key')
    
    with open(key_path, 'r', encoding='utf-8') as f:
        priv_key = f.read()
        
    env['TAURI_SIGNING_PRIVATE_KEY'] = priv_key
    env['TAURI_SIGNING_PRIVATE_KEY_PASSWORD'] = 'Cosmos123!'
    
    run_cmd(['npm.cmd', 'run', 'tauri', 'build'], cwd='CaiNghien_Tauri', env=env)

    # 3. Read Signature
    sig_path = f'CaiNghien_Tauri/src-tauri/target/release/bundle/nsis/cainghien_tauri_{version}_x64-setup.exe.sig'
    if not os.path.exists(sig_path):
        print(f"Error: Signature file not found at {sig_path}")
        sys.exit(1)
        
    with open(sig_path, 'r', encoding='utf-8') as f:
        signature = f.read().strip()
        
    print("Read signature successfully.")

    # 4. Update tauri-update.json
    update_json_path = 'web/public/data/tauri-update.json'
    with open(update_json_path, 'r', encoding='utf-8') as f:
        update_data = json.load(f)
        
    update_data['version'] = f"v{version}"
    update_data['notes'] = f"Cập nhật tự động lên phiên bản v{version}."
    update_data['pub_date'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    zip_url = f"https://github.com/HairBaconGamming/CaiNghien/releases/download/v{version}/cainghien_tauri_{version}_x64-setup.exe"
    
    update_data['platforms']['windows-x86_64']['url'] = zip_url
    update_data['platforms']['windows-x86_64']['signature'] = signature

    with open(update_json_path, 'w', encoding='utf-8') as f:
        json.dump(update_data, f, indent=2, ensure_ascii=False)
        
    print("Updated tauri-update.json")

    # 5. Build Web App
    run_cmd(['npm.cmd', 'run', 'build', '--', '--emptyOutDir=false'], cwd='web')
    
    # 6. Git Commit & Tag
    run_cmd(['git', 'add', '.'])
    subprocess.run(['git', 'commit', '-m', f"chore(release): full auto-update release v{version}"])
    subprocess.run(['git', 'tag', '-a', f"v{version}", '-m', f"Release v{version}"])
    run_cmd(['git', 'push', 'origin', 'main'])
    run_cmd(['git', 'push', 'origin', f"v{version}"])
    
    # 7. Create GitHub Release
    exe_path = f"CaiNghien_Tauri/src-tauri/target/release/bundle/nsis/cainghien_tauri_{version}_x64-setup.exe"
    msi_path = f"CaiNghien_Tauri/src-tauri/target/release/bundle/msi/cainghien_tauri_{version}_x64_en-US.msi"
    zip_path = f"CaiNghien_Tauri/src-tauri/target/release/bundle/nsis/cainghien_tauri_{version}_x64-setup.exe"
    
    gh_cmd = [
        'gh', 'release', 'create', f"v{version}", 
        exe_path, msi_path, zip_path, sig_path,
        '--title', f"v{version}", 
        '--notes', f"Bản phát hành hỗ trợ Auto Update qua Tauri."
    ]
    print(f"Running: {' '.join(gh_cmd)}")
    subprocess.run(gh_cmd) # Don't crash if release already exists
    
    # 8. Clean up
    print("Cleaning up Cargo...")
    run_cmd(['cargo', 'clean'], cwd='CaiNghien_Tauri/src-tauri')
    
    print("--- RELEASE PIPELINE COMPLETED SUCCESSFULLY ---")

if __name__ == '__main__':
    main()
