import json
import re
import os

permissions_file = r"D:\Projects\APPs\CaiNghien-main\CaiNghien_Tauri\src-tauri\permissions\default.toml"
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

with open(permissions_file, "r", encoding="utf-8") as f:
    toml_content = f.read()

# Find existing commands
existing = re.findall(r'commands\.allow\s*=\s*\["([^"]+)"\]', toml_content)
missing_cmds = [c for c in all_cmds if c not in existing]

new_permissions = ""
for cmd in missing_cmds:
    ident = "allow-" + cmd.replace("_", "-")
    new_permissions += f"""
[[permission]]
identifier = "{ident}"
description = "Allows the {cmd} command"
commands.allow = ["{cmd}"]
"""

# Now we need to append the missing_cmds to the [default] permissions list.
# We will just rewrite the file by replacing `permissions = [\n` with `permissions = [\n  "...",\n`
with open(permissions_file, "a", encoding="utf-8") as f:
    f.write(new_permissions)

# Now read again and fix [default] array
with open(permissions_file, "r", encoding="utf-8") as f:
    lines = f.readlines()

out_lines = []
in_default = False
default_permissions_start = -1

for i, line in enumerate(lines):
    if line.strip().startswith("permissions = ["):
        default_permissions_start = i
    elif default_permissions_start != -1 and line.strip() == "]":
        # We are at the end of the permissions array
        for cmd in missing_cmds:
            ident = "allow-" + cmd.replace("_", "-")
            out_lines.append(f'  "{ident}",\n')
        default_permissions_start = -1
    out_lines.append(line)

with open(permissions_file, "w", encoding="utf-8") as f:
    f.writelines(out_lines)

print(f"Added {len(missing_cmds)} commands to permissions/default.toml")
