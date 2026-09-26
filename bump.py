import json
import os
import re

# 1. package.json
with open('CaiNghien_Tauri/package.json', 'r', encoding='utf-8') as f:
    pkg = json.load(f)
pkg['version'] = '1.3.1'
with open('CaiNghien_Tauri/package.json', 'w', encoding='utf-8') as f:
    json.dump(pkg, f, indent=2)

# 2. tauri.conf.json
with open('CaiNghien_Tauri/src-tauri/tauri.conf.json', 'r', encoding='utf-8') as f:
    tauri = json.load(f)
tauri['version'] = '1.3.1'
with open('CaiNghien_Tauri/src-tauri/tauri.conf.json', 'w', encoding='utf-8') as f:
    json.dump(tauri, f, indent=2)

# 3. Cargo.toml
with open('CaiNghien_Tauri/src-tauri/Cargo.toml', 'r', encoding='utf-8') as f:
    cargo = f.read()

cargo = re.sub(r'version = ".*?"', 'version = "1.3.1"', cargo, count=1)
with open('CaiNghien_Tauri/src-tauri/Cargo.toml', 'w', encoding='utf-8') as f:
    f.write(cargo)
print('Versions bumped to 1.3.1!')
