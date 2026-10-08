import json

file_path = r"D:\Projects\APPs\CaiNghien-main\CaiNghien_Tauri\src-tauri\tauri.conf.json"

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

if "bundle" in data and "createUpdaterArtifacts" in data["bundle"]:
    data["bundle"]["createUpdaterArtifacts"] = False

with open(file_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
