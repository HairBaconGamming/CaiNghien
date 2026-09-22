@echo off
chcp 65001 >nul
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Dang yeu cau quyen Administrator...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   DANG MO CHAN CAC MANG XA HOI (FACEBOOK, YOUTUBE, ...)
echo ========================================================
echo.

powershell -NoProfile -Command "$hosts = 'C:\Windows\System32\drivers\etc\hosts'; $content = [System.IO.File]::ReadAllText($hosts); $cleaned = [System.Text.RegularExpressions.Regex]::Replace($content, '(?s)\r?\n*# CAINGHIEN START.*?# CAINGHIEN END\r?\n*', ''); [System.IO.File]::WriteAllText($hosts, $cleaned.TrimEnd() + [Environment]::NewLine); Get-NetAdapter | Where-Object Status -eq 'Up' | Set-DnsClientServerAddress -ResetServerAddresses -ErrorAction SilentlyContinue; ipconfig /flushdns"

echo.
echo ========================================================
echo   THANH CONG! DA XOA CHAN VA KHOI PHUC KET NOI!
echo ========================================================
echo.
pause
