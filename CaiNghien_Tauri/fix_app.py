import re

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add appConfig state
import_api = "import { api, UserProfile, onTelemetryUpdate, notifyTelemetryUpdate, AppConfig } from './services/api';"
content = re.sub(
    r"import \{ api, UserProfile, onTelemetryUpdate, notifyTelemetryUpdate \} from '\./services/api';",
    import_api,
    content
)

state_add = """  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [blockedDomainsInput, setBlockedDomainsInput] = useState('');

  const refreshConfig = useCallback(async () => {
    try {
      const c = await api.getAppConfig();
      if (c) {
        setAppConfig(c);
        setBlockedDomainsInput(c.blocked_domains.join('\\n'));
      }
    } catch (e) {
      console.warn('Failed to load app config:', e);
    }
  }, []);

  const updateConfig = async (updates: Partial<AppConfig>) => {
    if (!appConfig) return;
    const newConfig = { ...appConfig, ...updates };
    setAppConfig(newConfig);
    try {
      await api.saveAppConfig(newConfig);
      refreshConfig();
    } catch (e) {
      console.error('Failed to save config:', e);
      alert('Failed to save config: ' + e);
      refreshConfig();
    }
  };
"""

content = re.sub(
    r"  const \[userProfile, setUserProfile\] = useState<UserProfile \| null>\(null\);",
    state_add,
    content
)

# 2. Add refreshConfig to useEffect
effect_add = """  useEffect(() => {
    refreshProfile();
    refreshConfig();
  }, [refreshProfile, refreshConfig]);"""

content = re.sub(
    r"  useEffect\(\(\) => \{\n    refreshProfile\(\);\n  \}, \[refreshProfile\]\);",
    effect_add,
    content
)

# 3. Handle save domains
save_domains_fn = """
  const handleSaveDomains = () => {
    const domains = blockedDomainsInput.split('\\n').map(d => d.trim()).filter(d => d.length > 0);
    updateConfig({ blocked_domains: domains });
  };
"""

content = re.sub(
    r"  const handleManualCheck = async \(\) => \{",
    save_domains_fn + "\n  const handleManualCheck = async () => {",
    content
)

# 4. Replace Settings JSX
settings_jsx = """{activeTab === 'settings' && appConfig && (
              <div className="w-full h-full flex flex-col p-6 overflow-y-auto">
                <div className="glass-panel rounded-2xl p-6 border border-white/10 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <SettingsIcon className="w-6 h-6 text-sky-400" />
                    <div>
                      <h2 className="text-xl font-bold text-white">Focus Guard & Cosmos Settings</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Configure discipline thresholds, password protection, and deep space aesthetics.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-xl border border-white/10">
                    <span className="text-sm font-bold text-white">Master Protection</span>
                    <input 
                      type="checkbox" 
                      checked={appConfig.protection_enabled} 
                      onChange={(e) => updateConfig({ protection_enabled: e.target.checked })}
                      className="toggle-checkbox accent-cyan-400 w-6 h-6 cursor-pointer" 
                      disabled={settingsLocked} 
                    />
                  </div>
                </div>

                <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6">
                  {settingsLocked && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#030712]/80 backdrop-blur-sm rounded-2xl border border-white/10">
                      <Shield className="w-12 h-12 text-cyan-400 mb-4 animate-pulse" />
                      <h3 className="text-white font-bold text-xl mb-2">Active Protection Engaged</h3>
                      <p className="text-slate-300 text-sm mb-6 text-center max-w-sm">
                        Focus Guard is active. Settings and password modifications are strictly locked. Complete a challenge to unlock.
                      </p>
                      <button
                        onClick={() => setShowUnlockModal(true)}
                        className="px-6 py-2.5 rounded-xl font-bold text-sm tracking-wider uppercase text-white flex items-center gap-2 bg-gradient-to-r from-cyan-500/40 to-sky-500/30 border border-cyan-400 shadow-[0_0_18px_rgba(0,240,255,0.45)] hover:shadow-[0_0_25px_rgba(0,240,255,0.7)] transition-all cursor-pointer"
                      >
                        <Shield className="w-4 h-4 text-cyan-300" />
                        <span>Type to Unlock</span>
                      </button>
                    </div>
                  )}

                  {/* Password Protection Box */}
                  <div className="glass-panel rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <Lock className="w-5 h-5 text-fuchsia-400" />
                      <h3 className="text-base font-bold text-white">Password & Security</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <div>
                           <p className="text-sm font-semibold text-slate-200">App Password is {appConfig.password_hash ? 'Set' : 'Not Set'}</p>
                           <p className="text-xs text-slate-400">Enforce strict exit barriers</p>
                         </div>
                      </div>
                      <div className="pt-2 border-t border-white/10">
                        <button
                          disabled={settingsLocked}
                          onClick={() => {
                            const newPwd = prompt("Enter new password (leave empty to remove):");
                            if (newPwd !== null) {
                               import('@tauri-apps/api/core').then(({ invoke }) => {
                                  invoke('set_password', { password: newPwd || null })
                                    .then(() => alert('Password updated'))
                                    .catch(e => alert(e));
                               });
                            }
                          }}
                          className="w-full py-2 rounded-lg border border-fuchsia-500/30 text-xs font-bold uppercase tracking-wider text-fuchsia-300 hover:bg-fuchsia-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Change Password
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <Shield className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-base font-bold text-white">Discipline Enforcement</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Blocked Domains</p>
                          <p className="text-xs text-slate-400 mb-2">One domain per line</p>
                        </div>
                        <textarea 
                          value={blockedDomainsInput}
                          onChange={(e) => setBlockedDomainsInput(e.target.value)}
                          disabled={settingsLocked}
                          className="w-full h-24 bg-slate-900/50 border border-white/10 rounded-lg p-2 text-sm text-white resize-none"
                        />
                        <button 
                           disabled={settingsLocked}
                           onClick={handleSaveDomains}
                           className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                           Save Domains
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <Cpu className="w-5 h-5 text-purple-400" />
                      <h3 className="text-base font-bold text-white">System & Startup</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Start with Windows</p>
                          <p className="text-xs text-slate-400">Launch CaiNghien in background on system boot</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={appConfig.start_with_windows} 
                          onChange={(e) => updateConfig({ start_with_windows: e.target.checked })}
                          className="toggle-checkbox accent-purple-400 w-5 h-5 cursor-pointer" 
                          disabled={settingsLocked}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Block NSFW</p>
                          <p className="text-xs text-slate-400">Automatically block known adult content</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={appConfig.block_nsfw} 
                          onChange={(e) => updateConfig({ block_nsfw: e.target.checked })}
                          className="toggle-checkbox accent-purple-400 w-5 h-5 cursor-pointer" 
                          disabled={settingsLocked}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <RefreshCw className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-base font-bold text-white">System Updates</h3>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Cosmic Core Engine</p>
                          <p className="text-xs text-slate-400">Check for the latest features</p>
                        </div>
                        <button
                          onClick={handleManualCheck}
                          disabled={isCheckingUpdate || settingsLocked}
                          className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-emerald-600/80 hover:bg-emerald-500 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          {isCheckingUpdate ? 'Checking...' : 'Check'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}"""

content = re.sub(
    r"\{activeTab === 'settings' && \([\s\S]*?\n            \)\}",
    settings_jsx,
    content
)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
