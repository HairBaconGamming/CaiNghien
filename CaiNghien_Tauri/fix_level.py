import re

with open('CaiNghien_Tauri/src/components/dashboard/LevelProgress.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'\{progressPercent\}%\s+ho.*?\s+th.*?</', '{progressPercent}% hoàn thành</', content)
content = re.sub(r'\{progressPercent\}%\s+Ho.*?\s+th.*?</', '{progressPercent}% hoàn thành</', content)

with open('CaiNghien_Tauri/src/components/dashboard/LevelProgress.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed LevelProgress.")
