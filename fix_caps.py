import json

file_path = r"D:\Projects\APPs\CaiNghien-main\CaiNghien_Tauri\src-tauri\capabilities\default.json"

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# Keep only those that are valid core/opener/process/updater
# Removing anything that starts with allow- unless it is in a known plugin
valid = []
for p in data.get("permissions", []):
    if ":" in p or p == "default":
        valid.append(p)

data["permissions"] = valid

with open(file_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
