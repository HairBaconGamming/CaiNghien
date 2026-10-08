import json
import re

file_path = r"D:\Projects\APPs\CaiNghien-main\CaiNghien_Tauri\src-tauri\capabilities\default.json"
commands_file = r"D:\Projects\APPs\CaiNghien-main\CaiNghien_Tauri\src-tauri\src\commands.rs"
lib_file = r"D:\Projects\APPs\CaiNghien-main\CaiNghien_Tauri\src-tauri\src\lib.rs"
config_file = r"D:\Projects\APPs\CaiNghien-main\CaiNghien_Tauri\src-tauri\src\config.rs"

def get_commands(filepath):
    cmds = []
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    for match in re.finditer(r'#\[tauri::command\]\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)', content):
        cmds.append(match.group(1))
    return cmds

all_cmds = get_commands(commands_file) + get_commands(lib_file) + get_commands(config_file)
# convert to allow-kebab-case
allow_list = ["allow-" + cmd.replace("_", "-") for cmd in all_cmds]

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# Add all allow-cmds
existing_perms = set(data.get("permissions", []))
for p in allow_list:
    existing_perms.add(p)

# In case some commands are from the main app instead of a plugin
# Tauri v2 format: "core:command" or just "allow-xyz"
data["permissions"] = sorted(list(existing_perms))

with open(file_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
print("Updated permissions with", len(allow_list), "commands")
