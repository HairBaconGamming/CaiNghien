import re

with open('CaiNghien_Tauri/src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

m_start = re.search(r"activeTab === 'settings'", text)
start = m_start.start()
end = text.find('</main>', start)

with open('settings_ui.txt', 'w', encoding='utf-8') as f:
    f.write(text[start:end])
