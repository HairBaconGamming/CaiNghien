import re

with open(r'C:\Users\Admin\Desktop\CAINGHIEN_CONTROL_TOOL.bat', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'git commit -m "chore: release v$ver"',
    'git commit -m "chore: release v$ver"\n                    Write-Host " [2.5/3] Dang day len GitHub (Push)..." -ForegroundColor Cyan\n                    git push origin main'
)

with open(r'C:\Users\Admin\Desktop\CAINGHIEN_CONTROL_TOOL.bat', 'w', encoding='utf-8') as f:
    f.write(text)
