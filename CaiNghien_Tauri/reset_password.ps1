# reset_password.ps1
# Công cụ khẩn cấp để phá khóa mật khẩu CaiNghien Focus Guard

$appDataPath = "$env:APPDATA\com.cainghien.app\config.json"
$localDataPath = "$env:LOCALAPPDATA\com.cainghien.app\config.json"

$configPath = $null

if (Test-Path $appDataPath) {
    $configPath = $appDataPath
} elseif (Test-Path $localDataPath) {
    $configPath = $localDataPath
}

if ($null -eq $configPath) {
    Write-Host "Không tìm thấy file cấu hình! Có vẻ bạn chưa đặt mật khẩu hoặc chưa chạy phần mềm." -ForegroundColor Yellow
    exit
}

Write-Host "Đã tìm thấy file cấu hình tại: $configPath" -ForegroundColor Cyan

# Đọc file JSON
$jsonContent = Get-Content -Raw -Path $configPath | ConvertFrom-Json

# Kiểm tra cấu trúc file Tauri mới (schema wrapper)
if ($jsonContent.data) {
    $jsonContent.data.password_hash = $null
    $jsonContent.data.unlock_requested_at = $null
} else {
    $jsonContent.password_hash = $null
    $jsonContent.unlock_requested_at = $null
}

# Lưu lại file
$jsonContent | ConvertTo-Json -Depth 10 | Set-Content -Path $configPath

Write-Host "Đã phá khóa thành công! Bạn có thể mở lại phần mềm và Tắt bảo vệ mà không cần mật khẩu hay chờ 7 ngày." -ForegroundColor Green
