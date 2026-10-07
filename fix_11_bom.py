import re

with open(r'C:\Users\Admin\Desktop\CAINGHIEN_CONTROL_TOOL.bat', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    '[System.IO.File]::WriteAllText("$(Get-Location)\src-tauri\tauri.conf.json", $tconf, [System.Text.Encoding]::UTF8)',
    '$utf8NoBom = New-Object System.Text.UTF8Encoding($false); [System.IO.File]::WriteAllText("$(Get-Location)\src-tauri\tauri.conf.json", $tconf, $utf8NoBom)'
)

text = text.replace(
    '[System.IO.File]::WriteAllText("$(Get-Location)\package.json", $pkg, [System.Text.Encoding]::UTF8)',
    '$utf8NoBom = New-Object System.Text.UTF8Encoding($false); [System.IO.File]::WriteAllText("$(Get-Location)\package.json", $pkg, $utf8NoBom)'
)

with open(r'C:\Users\Admin\Desktop\CAINGHIEN_CONTROL_TOOL.bat', 'w', encoding='utf-8') as f:
    f.write(text)
