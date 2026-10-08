import json
from datetime import datetime

file_path = r"D:\Projects\APPs\CaiNghien-main\web\public\data\releases.json"

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

for rel in data.get("releases", []):
    rel["is_latest"] = False

new_release = {
    "version": "1.4.3",
    "tag": "v1.4.3",
    "published_at": datetime.now().strftime("%Y-%m-%d"),
    "is_latest": True,
    "title": "Bản Vá Khẩn Cấp v1.4.3 (IELTS ACL Fix Final)",
    "summary": "Sửa lỗi không mở được tính năng Học IELTS do bị chặn bởi hệ thống phân quyền mới của Tauri v2.",
    "notes": [
        "Sửa lỗi 'Command not allowed by ACL' triệt để khi mở tab Học IELTS và thi đấu.",
        "Cấu hình lại toàn bộ hệ thống permissions."
    ],
    "files": {
        "installer": {
            "filename": "cainghien_tauri_1.4.3_x64-setup.exe",
            "url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.4.3/cainghien_tauri_1.4.3_x64-setup.exe",
            "direct_url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.4.3/cainghien_tauri_1.4.3_x64-setup.exe",
            "size_formatted": "11 MB",
            "platform": "Windows 10 / 11 (64-bit)"
        },
        "msi": {
            "filename": "cainghien_tauri_1.4.3_x64_en-US.msi",
            "url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.4.3/cainghien_tauri_1.4.3_x64_en-US.msi",
            "size_formatted": "13 MB",
            "platform": "Windows MSI Installer"
        }
    }
}

data["latest"] = "1.4.3"
data["releases"].insert(0, new_release)

with open(file_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=4)
