import json

with open('web/public/data/releases.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

new_release = {
    "version": "v1.3.1",
    "date": "2026-09-26",
    "tag_name": "v1.3.1",
    "is_latest": True,
    "notes": "🚀 Cập nhật v1.3.1:\n- Cải thiện System Menu và Titlebar (Hỗ trợ menu Tệp, Xem, Cửa sổ tích hợp).\n- Bổ sung Widget Âm nhạc đa năng trong Phòng tập trung (Hỗ trợ Lofi Local, Spotify, YouTube).\n- Khắc phục lỗi hiển thị tiếng Việt trên Menu và Level Badge.\n- Sửa lỗi Autostart: Giờ đây chức năng Khởi động cùng Windows đã đồng bộ an toàn với OS thông qua Tauri Plugin, không báo sai hay bị xung đột.\n- Vô hiệu hóa Context Menu mặc định để ứng dụng mượt mà và giống app native hơn.",
    "files": {
        "installer": {
            "name": "cainghien_tauri_1.3.1_x64-setup.exe",
            "url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.3.1/cainghien_tauri_1.3.1_x64-setup.exe",
            "size": "Khoảng 50 MB",
            "type": "Installer (NSIS)"
        },
        "msi": {
            "name": "cainghien_tauri_1.3.1_x64_en-US.msi",
            "url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.3.1/cainghien_tauri_1.3.1_x64_en-US.msi",
            "size": "Khoảng 45 MB",
            "type": "MSI Package"
        }
    }
}

for r in data.get('releases', []):
    r['is_latest'] = False

data['latest'] = "v1.3.1"
data['releases'].insert(0, new_release)

with open('web/public/data/releases.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('Updated releases.json')
