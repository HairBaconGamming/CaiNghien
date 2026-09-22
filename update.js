const fs = require('fs');

async function update() {
  const version = '1.2.0';
  const dateStr = new Date().toISOString().split('T')[0];
  const url = `https://github.com/HairBaconGamming/CaiNghien/releases/download/v${version}/cainghien_tauri_${version}_x64-setup.exe`;
  
  // Wait until the .exe and .sig exist
  let sigContent = '';
  let retryCount = 0;
  const sigPath = `CaiNghien_Tauri/src-tauri/target/release/bundle/nsis/cainghien_tauri_${version}_x64-setup.exe.sig`;
  
  while (true) {
    if (fs.existsSync(sigPath)) {
      sigContent = fs.readFileSync(sigPath, 'utf8').trim();
      break;
    }
    console.log('Waiting for .sig file...');
    await new Promise(r => setTimeout(r, 2000));
    retryCount++;
    if(retryCount > 60) {
      console.log("Timeout waiting for signature");
      return;
    }
  }

  // Generate SHA256 of the .exe
  // In Tauri, the signature is what matters for the updater, but we also want the tauri-update.json
  
  // Update tauri-update.json
  const updaterJsonPath = 'web/public/data/tauri-update.json';
  const updaterData = {
    "version": version,
    "notes": "Tích hợp tính năng Tự động Cập nhật, sửa lỗi gõ tiếng Việt, và khắc phục lỗi Uninstall.",
    "pub_date": new Date().toISOString(),
    "platforms": {
      "windows-x86_64": {
        "signature": sigContent,
        "url": url
      }
    }
  };
  fs.writeFileSync(updaterJsonPath, JSON.stringify(updaterData, null, 2), 'utf8');
  console.log('Updated tauri-update.json');

  // Update releases.json
  const releasesJsonPath = 'web/public/data/releases.json';
  let releasesDataStr = fs.readFileSync(releasesJsonPath, 'utf8');
  if (releasesDataStr.charCodeAt(0) === 0xFEFF) releasesDataStr = releasesDataStr.slice(1);
  let releasesData = JSON.parse(releasesDataStr);
  const newRelease = {
    version: version,
    published_at: dateStr,
    notes: [
      "Ra mắt tính năng Tự động cập nhật (Auto Updater).",
      "Sửa lỗi gõ tiếng Việt (VNI/Telex) khi gõ phím.",
      "Thêm nút tùy chỉnh số phút tập trung.",
      "Thay đổi Logo ứng dụng phong cách vũ trụ.",
      "Vá lỗi kẹt tiến trình khi gỡ cài đặt (Uninstall)."
    ],
    files: {
      installer: {
        url: url,
        sha256: "",
        size_bytes: fs.statSync(`CaiNghien_Tauri/src-tauri/target/release/bundle/nsis/cainghien_tauri_${version}_x64-setup.exe`).size
      }
    }
  };
  releasesData.latest = {
    version: version,
    published_at: dateStr,
    notes: newRelease.notes
  };
  releasesData.releases.unshift(newRelease);
  fs.writeFileSync(releasesJsonPath, JSON.stringify(releasesData, null, 2), 'utf8');
  console.log('Updated releases.json');
}

update();
