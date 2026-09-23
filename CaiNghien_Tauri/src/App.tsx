import { useState, useMemo, useEffect, useCallback } from 'react';
import { Titlebar } from './components/layout/Titlebar';
import { Navbar, NavTabId } from './components/layout/Navbar';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { FocusRoomScreen } from './components/focus/FocusRoomScreen';
import { TypingChallengeScreen } from './components/typing/TypingChallengeScreen';
import {
  Settings as SettingsIcon,
  Shield,
  Cpu,
  Sparkles,
  RefreshCw,
  Lock
} from 'lucide-react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { api, UserProfile, onTelemetryUpdate, notifyTelemetryUpdate, AppConfig } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [showTypingModal, setShowTypingModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
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

  const [dashboardRefreshTrigger, setDashboardRefreshTrigger] = useState(0);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await api.getUserProfile();
      if (p) {
        setUserProfile(p);
      }
    } catch (e) {
      console.warn('Failed to load user profile in App:', e);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
    refreshConfig();
  }, [refreshProfile, refreshConfig]);

  useEffect(() => {
    const unsubscribe = onTelemetryUpdate(() => {
      refreshProfile();
      setDashboardRefreshTrigger((prev) => prev + 1);
    });

    const handleFocus = () => {
      refreshProfile();
      setDashboardRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshProfile]);

  const handleSelectTab = (tab: NavTabId) => {
    setActiveTab(tab);
    if (tab === 'dashboard') {
      refreshProfile();
      setDashboardRefreshTrigger((prev) => prev + 1);
    }
  };

  const [updateObj, setUpdateObj] = useState<any>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Settings Protection
  const [settingsLocked, setSettingsLocked] = useState(true);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  useEffect(() => {
    if (activeTab !== 'settings') {
      setSettingsLocked(true);
      setShowUnlockModal(false);
    }
  }, [activeTab]);

  useEffect(() => {
    check().then((update) => {
      if (update) {
        setUpdateObj(update);
      }
    }).catch(console.error);
  }, []);


  const handleSaveDomains = () => {
    const domains = blockedDomainsInput.split('\\n').map(d => d.trim()).filter(d => d.length > 0);
    updateConfig({ blocked_domains: domains });
  };

  const handleManualCheck = async () => {
    setIsCheckingUpdate(true);
    try {
      const update = await check();
      if (update) {
        setUpdateObj(update);
      } else {
        alert("System is up to date.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to check for updates.");
    }
    setIsCheckingUpdate(false);
  };

  // Generate fixed random starfield coordinates
  const stars = useMemo(() => {
    const starList = [];
    for (let i = 0; i < 90; i++) {
      const top = Math.floor(Math.sin(i * 997) * 50 + 50);
      const left = Math.floor(Math.cos(i * 733) * 50 + 50);
      const size = (i % 3 === 0 ? 2.5 : i % 2 === 0 ? 1.5 : 1);
      const opacity = ((i % 5) + 3) / 10;
      const animDelay = (i % 7) * 0.7;
      starList.push({ id: i, top, left, size, opacity, animDelay });
    }
    return starList;
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden select-none bg-[#030712] text-white flex flex-col relative font-sans">
      {/* Cosmos Custom Titlebar with Drag and Window Controls */}
      <Titlebar />

      {/* Cosmos Background Canvas */}
      <div className="cosmos-canvas">
        {/* Starfield */}
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white transition-opacity"
            style={{
              top: `${star.top}%`,
              left: `${star.left}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              boxShadow: star.size > 2 ? '0 0 6px rgba(255, 255, 255, 0.8)' : undefined,
              animation: `pulseGlow ${2 + (star.id % 4)}s ease-in-out infinite`,
              animationDelay: `${star.animDelay}s`,
            }}
          />
        ))}

        {/* Ambient Nebula Glow Orbs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-br from-fuchsia-600/20 via-purple-600/10 to-transparent blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 -left-32 w-[32rem] h-[32rem] rounded-full bg-gradient-to-tr from-cyan-500/15 via-sky-600/10 to-transparent blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-24 right-1/4 w-[28rem] h-[28rem] rounded-full bg-gradient-to-tl from-violet-600/20 via-indigo-600/10 to-transparent blur-[130px] pointer-events-none" />
      </div>

      {/* Main Glass Shell Container */}
      <div className="relative z-10 flex flex-col w-full h-full overflow-hidden">
        {/* Cosmos Top Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          userLevel={userProfile?.level}
          userTitle={userProfile?.title}
          hasNotifications={true}
        />

        {/* Active Workspace Viewport */}
        <main className="flex-1 overflow-hidden relative p-4 md:p-6 flex flex-col items-center justify-center">
          <div className="w-full h-full max-w-[1560px] mx-auto flex flex-col">
            {activeTab === 'dashboard' && (
              <DashboardScreen refreshTrigger={dashboardRefreshTrigger} />
            )}

            {activeTab === 'focus' && (
              <FocusRoomScreen
                onExit={() => handleSelectTab('dashboard')}
                onSessionComplete={() => {
                  refreshProfile();
                  notifyTelemetryUpdate();
                }}
              />
            )}

            {activeTab === 'typing' && (
              <TypingChallengeScreen
                onClose={() => handleSelectTab('dashboard')}
                onComplete={() => {
                  refreshProfile();
                  notifyTelemetryUpdate();
                  handleSelectTab('dashboard');
                }}
              />
            )}


            {activeTab === 'settings' && appConfig && (
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
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Settings Lock Delay</p>
                          <p className="text-xs text-slate-400">Enforce a delay when disabling protection</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={appConfig.change_delay_enabled} 
                          onChange={(e) => updateConfig({ change_delay_enabled: e.target.checked })}
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
            )}
          </div>
        </main>
      </div>

      {/* Floating Modal Overlay for Typing Challenge (when invoked outside direct tab) */}
      {showTypingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl">
            <TypingChallengeScreen
              asModal
              onClose={() => setShowTypingModal(false)}
              onComplete={() => {
                setShowTypingModal(false);
                refreshProfile();
                notifyTelemetryUpdate();
              }}
            />
          </div>
        </div>
      )}

      {/* Unlock Settings Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl">
            <TypingChallengeScreen
              asModal
              onClose={() => setShowUnlockModal(false)}
              onComplete={() => {
                setSettingsLocked(false);
                setShowUnlockModal(false);
                refreshProfile();
                notifyTelemetryUpdate();
              }}
            />
          </div>
        </div>
      )}

      {/* Update Modal */}
      {updateObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.2)]">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              Cosmic Update Available
            </h2>
            <p className="text-sm text-slate-300 mb-4">
              Version {updateObj.version} is ready for deployment.
            </p>
            {updateObj.body && (
              <div className="bg-slate-900/50 rounded-lg p-3 mb-6 border border-white/5 max-h-32 overflow-y-auto text-xs text-slate-400 whitespace-pre-wrap">
                {updateObj.body}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setUpdateObj(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-300 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                disabled={isUpdating}
              >
                Later
              </button>
              <button
                onClick={async () => {
                  setIsUpdating(true);
                  try {
                    await updateObj.downloadAndInstall();
                    await relaunch();
                  } catch (e) {
                    console.error(e);
                    alert("Failed to install update.");
                  }
                  setIsUpdating(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-cyan-600 hover:bg-cyan-500 transition-colors flex items-center gap-2 cursor-pointer"
                disabled={isUpdating}
              >
                {isUpdating ? 'Deploying...' : 'Install & Restart'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
