import re

with open(r'C:\Users\Admin\Desktop\CAINGHIEN_CONTROL_TOOL.bat', 'r', encoding='utf-8') as f:
    text = f.read()

# Update menu
text = text.replace(
    'Write-Host "  12. Go cai dat hoan toan ung dung CaiNghien (Uninstall)" -ForegroundColor Red',
    'Write-Host "  12. Go cai dat hoan toan ung dung CaiNghien (Uninstall)" -ForegroundColor Red\n    Write-Host "  13. Don dep dung luong ma nguon (Cargo Clean & Node Modules)" -ForegroundColor Yellow'
)
text = text.replace('Nhap lua chon cua ban (0-12)', 'Nhap lua chon cua ban (0-13)')
text = text.replace('Lua chon khong hop le. Vui long chon tu 0 den 12.', 'Lua chon khong hop le. Vui long chon tu 0 den 13.')

# Add switch logic
option13 = r"""        "13" {
            Write-Host ""
            Write-Host ">>> DANG DON DEP DUNG LUONG MA NGUON..." -ForegroundColor Yellow
            $repoDir = "d:\Projects\APPs\CaiNghien-main"
            if (Test-Path $repoDir) {
                Set-Location $repoDir
                Write-Host " [1/3] Dang xoa thu muc node_modules (Web & Tauri)..." -ForegroundColor Cyan
                Remove-Item -Path "web\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
                Remove-Item -Path "CaiNghien_Tauri\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
                
                Write-Host " [2/3] Dang don dep Cargo Target (Co the mat vai chuc giay)..." -ForegroundColor Cyan
                if (Test-Path "CaiNghien_Tauri\src-tauri") {
                    Set-Location "CaiNghien_Tauri\src-tauri"
                    cargo clean
                    Set-Location $repoDir
                }
                
                Write-Host " [3/3] Xoa cac ban sao luu cu..." -ForegroundColor Cyan
                Remove-Item -Path "CaiNghien_Tauri\src-tauri\target" -Recurse -Force -ErrorAction SilentlyContinue
                
                Write-Host " [OK] DA DON DEP THANH CONG! (Ban se phai chay 'npm install' va 'npm run build' vao lan code sau)" -ForegroundColor Green
            } else {
                Write-Host " [!] Khong tim thay thu muc ma nguon tai $repoDir" -ForegroundColor Red
            }
            Write-Host ""
            Read-Host " Bam Enter de tiep tuc..."
        }
"""

text = text.replace('        "0" {', option13 + '        "0" {')

with open(r'C:\Users\Admin\Desktop\CAINGHIEN_CONTROL_TOOL.bat', 'w', encoding='utf-8') as f:
    f.write(text)
