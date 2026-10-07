import re

with open(r'C:\Users\Admin\Desktop\CAINGHIEN_CONTROL_TOOL.bat', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'Write-Host "  11. Commit & Dong goi Release v1.4.0 (Build Release)" -ForegroundColor Green',
    'Write-Host "  11. Commit & Dong goi Release (Nhap phien ban tuy chon)" -ForegroundColor Green'
)

old_opt11 = r"""        "11" {
            Write-Host ""
            Write-Host ">>> DANG COMMIT VA DONG GOI RELEASE V1.4.0..." -ForegroundColor Yellow
            $repoDir = "d:\Projects\APPs\CaiNghien-main"
            if (Test-Path $repoDir) {
                Set-Location $repoDir
                git add .
                git commit -m "chore: release v1.4.0 (Big Update)"
                Write-Host " [OK] Da commit vao nhanh main!" -ForegroundColor Green
                
                Write-Host " [2/2] Dang dong goi bang tauri build..." -ForegroundColor Cyan
                cd CaiNghien_Tauri; npm.cmd run tauri build; cd ..
                
                Write-Host " [OK] DONG GOI THANH CONG! File nam trong CaiNghien_Tauri\src-tauri\target\release\bundle\nsis" -ForegroundColor Green
            } else {
                Write-Host " [!] Khong tim thay thu muc ma nguon tai $repoDir" -ForegroundColor Red
            }
            Write-Host ""
            Read-Host " Bam Enter de tiep tuc..."
        }"""

new_opt11 = r"""        "11" {
            Write-Host ""
            $ver = Read-Host " Nhap so phien ban ban muon Build & Release (VD: 1.4.1)"
            if ([string]::IsNullOrWhiteSpace($ver)) {
                Write-Host " [!] Da huy thao tac (Khong nhap phien ban)." -ForegroundColor Yellow
            } else {
                Write-Host ">>> DANG COMMIT VA DONG GOI RELEASE v$ver..." -ForegroundColor Yellow
                $repoDir = "d:\Projects\APPs\CaiNghien-main"
                if (Test-Path $repoDir) {
                    Set-Location $repoDir
                    
                    Write-Host " [1/3] Cap nhat so phien ban trong code (package.json, tauri.conf.json)..." -ForegroundColor Cyan
                    try {
                        cd CaiNghien_Tauri
                        $tconf = Get-Content "src-tauri\tauri.conf.json" -Raw
                        $tconf = $tconf -replace '("version":\s*")([^"]+)(")', "`${1}$ver`${3}"
                        [System.IO.File]::WriteAllText("$(Get-Location)\src-tauri\tauri.conf.json", $tconf, [System.Text.Encoding]::UTF8)
                        
                        $pkg = Get-Content "package.json" -Raw
                        $pkg = $pkg -replace '("version":\s*")([^"]+)(")', "`${1}$ver`${3}"
                        [System.IO.File]::WriteAllText("$(Get-Location)\package.json", $pkg, [System.Text.Encoding]::UTF8)
                        cd ..
                        Write-Host " [OK] Da cap nhat phien ban thanh v$ver" -ForegroundColor Green
                    } catch {
                        Write-Host " [!] Loi khi cap nhat phien ban: $_" -ForegroundColor Yellow
                    }

                    Write-Host " [2/3] Commit vao Git..." -ForegroundColor Cyan
                    git add .
                    git commit -m "chore: release v$ver"
                    Write-Host " [OK] Da commit vao nhanh main!" -ForegroundColor Green
                    
                    Write-Host " [3/3] Dang dong goi bang tauri build..." -ForegroundColor Cyan
                    cd CaiNghien_Tauri; npm.cmd run tauri build; cd ..
                    
                    Write-Host " [OK] DONG GOI THANH CONG! File nam trong CaiNghien_Tauri\src-tauri\target\release\bundle\nsis" -ForegroundColor Green
                } else {
                    Write-Host " [!] Khong tim thay thu muc ma nguon tai $repoDir" -ForegroundColor Red
                }
            }
            Write-Host ""
            Read-Host " Bam Enter de tiep tuc..."
        }"""

text = text.replace(old_opt11, new_opt11)

with open(r'C:\Users\Admin\Desktop\CAINGHIEN_CONTROL_TOOL.bat', 'w', encoding='utf-8') as f:
    f.write(text)
