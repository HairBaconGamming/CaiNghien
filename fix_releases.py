import json
from datetime import datetime

file_path = r"D:\Projects\APPs\CaiNghien-main\web\public\data\releases.json"

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# Set 1.4.0 is_latest to false
for rel in data.get("releases", []):
    rel["is_latest"] = False

# Prepare 1.4.1 release
new_release = {
    "version": "1.4.1",
    "tag": "v1.4.1",
    "published_at": datetime.now().strftime("%Y-%m-%d"),
    "is_latest": True,
    "title": "Bản Phát Hành Ổn Định v1.4.1 (Fixes & Stability)",
    "summary": "Phiên bản tối ưu hóa, sửa lỗi crash màn hình Settings và nâng cấp module tự bảo vệ.",
    "notes": [
        "Sửa lỗi Crash màn hình Cài đặt khi dữ liệu JSON bị hỏng hoặc null.",
        "Sửa lỗi parser chặn hệ thống cấp quyền (ACL) của Tauri khiến các nút không hoạt động.",
        "Sửa hiển thị xuống dòng của danh sách chặn website trong Cài đặt.",
        "Cập nhật Control Tool: Thêm tùy chọn Dọn dẹp dung lượng và tự nhập version."
    ],
    "files": {
        "installer": {
            "filename": "cainghien_tauri_1.4.1_x64-setup.exe",
            "url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.4.1/cainghien_tauri_1.4.1_x64-setup.exe",
            "direct_url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.4.1/cainghien_tauri_1.4.1_x64-setup.exe",
            "size_formatted": "11 MB",
            "platform": "Windows 10 / 11 (64-bit)"
        },
        "msi": {
            "filename": "cainghien_tauri_1.4.1_x64_en-US.msi",
            "url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.4.1/cainghien_tauri_1.4.1_x64_en-US.msi",
            "size_formatted": "13 MB",
            "platform": "Windows MSI Installer"
        }
    }
}

data["latest"] = "1.4.1"
data["releases"].insert(0, new_release)

with open(file_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=4)
