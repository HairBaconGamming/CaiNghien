Write-Host "Building Tauri app..."
npm run tauri build
if ($LASTEXITCODE -eq 0) {
    Write-Host "Creating GitHub Release..."
    gh release create v1.3.1 "src-tauri\target\release\bundle\nsis\cainghien_tauri_1.3.1_x64-setup.exe" "src-tauri\target\release\bundle\msi\cainghien_tauri_1.3.1_x64_en-US.msi" --title "v1.3.1" --notes "Bản cập nhật v1.3.1 với tính năng Music Widget, Menu tích hợp và fix Autostart an toàn."
    
    Write-Host "Cleaning cargo..."
    cd src-tauri
    cargo clean
} else {
    Write-Host "Build failed."
}
