import re

with open('CaiNghien_Tauri/src/components/dashboard/ActivityHeatmap.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace duplicate T3 with T5 and second CN with T7
lines = content.split('\n')
t3_count = 0
cn_count = 0
for i, line in enumerate(lines):
    if '>T3<' in line:
        t3_count += 1
        if t3_count == 2:
            lines[i] = line.replace('>T3<', '>T5<')
    elif '>CN<' in line:
        cn_count += 1
        if cn_count == 2:
            lines[i] = line.replace('>CN<', '>T7<')

with open('CaiNghien_Tauri/src/components/dashboard/ActivityHeatmap.tsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print("Fixed T3 and CN labels.")
