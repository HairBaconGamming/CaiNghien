const fs = require('fs');
const data = {
  "latest": "v1.3.0",
  "releases": [
    {
      "version": "1.3.0",
      "tag": "v1.3.0",
      "published_at": "2026-09-25",
      "is_latest": true,
      "title": "B?n c?p nh?t B?o m?t Tuy?t d?i & ?n d?nh H? th?ng v1.3.0",
      "summary": "S?a hon 30 l?i b?o m?t nghiêm tr?ng, tích h?p React Error Boundaries, t?i uu RAM Web Audio và si?t ch?t phân quy?n h? th?ng.",
      "notes": [
        "S?a hon 30 l?i b?o m?t nghiêm tr?ng (du?c báo cáo b?i h? th?ng Audit Ð?c l?p).",
        "Trang b? công ngh? React Error Boundaries giúp thoát kh?i Kiosk Mode an toàn.",
        "Thi?t k? l?i lu?ng phân quy?n Windows (UAC): Ho?t d?ng hoàn toàn du?i quy?n ngu?i dùng.",
        "S?a d?t di?m l?i tràn RAM rò r? b? nh? khi nghe nh?c Lofi.",
        "Co ch? ch?ng gian l?n m?i: Khóa API n?i b? ch?n hack gi? choi (Study-to-Earn).",
        "Thay d?i ID c?a Co s? d? li?u SQLite ch?ng s?p khi spam phím."
      ],
      "files": {
        "installer": {
          "filename": "cainghien_tauri_1.3.0_x64-setup.exe",
          "url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.3.0/cainghien_tauri_1.3.0_x64-setup.exe",
          "direct_url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.3.0/cainghien_tauri_1.3.0_x64-setup.exe",
          "size_formatted": "10 MB",
          "platform": "Windows 10 / 11 (64-bit)"
        },
        "msi": {
          "filename": "cainghien_tauri_1.3.0_x64_en-US.msi",
          "url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.3.0/cainghien_tauri_1.3.0_x64_en-US.msi",
          "size_formatted": "12 MB",
          "platform": "Windows MSI Installer"
        }
      }
    },
    {
      "version": "1.1.0",
      "tag": "v1.1.0",
      "published_at": "2026-09-17",
      "is_latest": false,
      "title": "B?n Phát Hành v1.1.0",
      "summary": "Ð?i tu toàn di?n thi?t k? Cosmos Glassmorphism, tích h?p Heatmap 365 ngày và Focus Room Lofi.",
      "notes": [
        "Ð?i tu giao di?n toàn di?n v?i thi?t k? Cosmos Glassmorphism.",
        "Tích h?p màn hình Dashboard Heatmap 365 ngày.",
        "Tích h?p màn hình Focus Room v?i nh?c Lofi.",
        "Tích h?p màn hình Typing Challenge ch?m di?m theo th?i gian th?c."
      ],
      "files": {
        "installer": {
          "filename": "cainghien_tauri_1.1.0_x64-setup.exe",
          "url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.1.0/cainghien_tauri_1.1.0_x64-setup.exe",
          "size_formatted": "4.5 MB",
          "platform": "Windows 10 / 11 (64-bit)"
        },
        "msi": {
          "filename": "cainghien_tauri_1.1.0_x64_en-US.msi",
          "url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.1.0/cainghien_tauri_1.1.0_x64_en-US.msi",
          "size_formatted": "7.7 MB",
          "platform": "Windows MSI Installer"
        }
      }
    },
    {
      "version": "1.0.0",
      "tag": "v1.0.0",
      "published_at": "2026-09-16",
      "is_latest": false,
      "title": "B?n Phát Hành Kh?i Ð?u v1.0.0",
      "summary": "Phiên b?n chính th?c d?u tiên trên n?n t?ng Rust & Tauri v2 v?i ki?n trúc b?o v? h? th?ng da t?ng.",
      "notes": [
        "Phiên b?n v1.0.0 Chính Th?c v?i ki?n trúc Rust & Tauri t?i uu hóa b? nh? RAM.",
        "Ch? d? khóa c?ng ?ng d?ng (Kiosk Mode) vô hi?u hóa Alt+Tab và Windows Key."
      ],
      "files": {
        "installer": {
          "filename": "cainghien_tauri_0.1.0_x64-setup.exe",
          "url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.0.0/cainghien_tauri_0.1.0_x64-setup.exe",
          "direct_url": "https://github.com/HairBaconGamming/CaiNghien/releases/download/v1.0.0/cainghien_tauri_0.1.0_x64-setup.exe",
          "size_formatted": "4.4 MB",
          "platform": "Windows 10 / 11 (64-bit)"
        }
      }
    }
  ]
};
fs.writeFileSync('web/public/data/releases.json', JSON.stringify(data, null, 2), 'utf8');
