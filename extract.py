import re

with open('CaiNghien_Tauri/src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

m_start = re.search(r"activeTab === 'settings'", text)
m_end = re.search(r"activeTab === 'account'", text)

start = m_start.start() if m_start else -1
end = m_end.start() if m_end else -1

if start != -1 and end != -1:
    # Actually 'account' appears BEFORE 'settings' in App.tsx! Let's check.
    if start > end:
        # Settings is after account
        end = text.find('</main>', start)

    with open('temp_settings.txt', 'w', encoding='utf-8') as f:
        f.write(text[start:end])
    print(f"Extracted {end - start} characters")
else:
    print(start, end)
