import re

with open('CaiNghien_Tauri/src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add settingsTab state
state_declaration = "const [settingsTab, setSettingsTab] = useState<'general' | 'account'>('general');"
if "const [settingsTab" not in text:
    text = text.replace("const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');",
                        "const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');\n  " + state_declaration)

# 2. Remove old account tab
account_block = """            {activeTab === 'account' && (
              <AccountScreen addToast={addToast} />
            )}"""
text = text.replace(account_block, "")

# 3. Restructure settings
# We need to find the settings block precisely.
start_str = "            {activeTab === 'settings' && appConfig && ("
end_str = "            )}\n          </div>\n        </main>" # We will find the end manually

m_start = text.find(start_str)
if m_start != -1:
    content_start = m_start + len(start_str)
    content_end = text.find("            )}\n          </div>", content_start)
    
    original_settings_content = text[content_start:content_end]
    
    new_settings_block = f"""{start_str}
              <div className="w-full h-full flex overflow-hidden">
                {{/* Left Sidebar */}}
                <div className="w-64 border-r border-white/10 p-6 flex flex-col gap-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Cài đặt</div>
                  
                  <button 
                    onClick={{() => setSettingsTab('general')}}
                    className={{`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all ${{
                      settingsTab === 'general' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }}`}}
                  >
                    Cài đặt chung
                  </button>
                  
                  <button 
                    onClick={{() => setSettingsTab('account')}}
                    className={{`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all ${{
                      settingsTab === 'account' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }}`}}
                  >
                    Tài khoản & Hồ sơ
                  </button>
                </div>
                
                {{/* Main Content */}}
                <div className="flex-1 overflow-y-auto">
                  {{settingsTab === 'general' && (
                    {original_settings_content.strip()}
                  )}}
                  
                  {{settingsTab === 'account' && (
                    <div className="p-6">
                      <AccountScreen addToast={{addToast}} />
                    </div>
                  )}}
                </div>
              </div>
"""
    text = text[:m_start] + new_settings_block + text[content_end:]

with open('CaiNghien_Tauri/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated App.tsx")
