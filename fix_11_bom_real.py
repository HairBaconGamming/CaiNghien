import re

with open(r'C:\Users\Admin\Desktop\CAINGHIEN_CONTROL_TOOL.bat', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix tauri.conf.json line if it still has [System.Text.Encoding]::UTF8
text = text.replace(
    r'[System.IO.File]::WriteAllText("$(Get-Location)\src-tauri\tauri.conf.json", $tconf, [System.Text.Encoding]::UTF8)',
    r'$utf8NoBom = New-Object System.Text.UTF8Encoding($false); [System.IO.File]::WriteAllText("$(Get-Location)\src-tauri\tauri.conf.json", $tconf, $utf8NoBom)'
)

with open(r'C:\Users\Admin\Desktop\CAINGHIEN_CONTROL_TOOL.bat', 'w', encoding='utf-8') as f:
    f.write(text)
