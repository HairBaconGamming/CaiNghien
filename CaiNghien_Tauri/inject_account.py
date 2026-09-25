import re

with open('CaiNghien_Tauri/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import_stmt = "import { AccountScreen } from './components/AccountScreen';\n"
if 'AccountScreen' not in content:
    content = content.replace("import { ConfirmModal } from './components/ConfirmModal';", "import { ConfirmModal } from './components/ConfirmModal';\n" + import_stmt)

render_block = '''
            {activeTab === 'account' && (
              <AccountScreen addToast={addToast} />
            )}
'''

if "activeTab === 'account'" not in content:
    content = content.replace("            {activeTab === 'settings' && appConfig && (", render_block.lstrip('\n') + "\n            {activeTab === 'settings' && appConfig && (")

with open('CaiNghien_Tauri/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Injected AccountScreen to App.tsx")
