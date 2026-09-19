import { useState, useMemo, useEffect, useCallback } from 'react';
import { Titlebar } from './components/layout/Titlebar';
import { Navbar, NavTabId } from './components/layout/Navbar';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { FocusRoomScreen } from './components/focus/FocusRoomScreen';
import { TypingChallengeScreen } from './components/typing/TypingChallengeScreen';
import {
  FolderGit2,
  GitBranch,
  Settings as SettingsIcon,
  Shield,
  Cpu,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Lock
} from 'lucide-react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { api, UserProfile, onTelemetryUpdate, notifyTelemetryUpdate } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [showTypingModal, setShowTypingModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    username: 'Alex Chen',
    handle: '@astro_alex',
    level: 28,
    title: 'Stargazer',
    current_xp: 14350,
    next_level_xp: 15000,
    rank: 'Nova Voyager',
  });
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
  }, [refreshProfile]);

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
          userLevel={userProfile.level}
          userTitle={userProfile.title}
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

            {activeTab === 'projects' && (
              <div className="w-full h-full flex flex-col p-6 overflow-y-auto">
                <div className="glass-panel rounded-2xl p-6 border border-white/10 flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <FolderGit2 className="w-5 h-5 text-cyan-400" />
                      Tracked Projects & Habit Repositories
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Cosmic telemetry monitoring active coding and discipline commitments.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white btn-cosmos-primary flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>New Project</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {['CaiNghien Core', 'Deep Space Focus Suite', 'Rust Tauri IPC Engine'].map((proj, idx) => (
                    <div key={proj} className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-cyan-400/40 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">PROJECT 0{idx + 1}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Active
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mb-2">{proj}</h3>
                      <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                        Automated discipline guard tracking distractions and gamifying focus sessions with cryptographic verification.
                      </p>
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                        <span>Updated 2 hours ago</span>
                        <ExternalLink className="w-3.5 h-3.5 hover:text-cyan-400 cursor-pointer" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'repository' && (
              <div className="w-full h-full flex flex-col p-6 overflow-y-auto">
                <div className="glass-panel rounded-2xl p-6 border border-white/10 mb-6">
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-6 h-6 text-purple-400" />
                    <div>
                      <h2 className="text-xl font-bold text-white">Repository Synchronization</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Discipline commits and cryptographic activity records synchronized with remote repositories.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5">
                    <div>
                      <span className="text-xs font-mono font-bold text-cyan-300">branch: main (verified)</span>
                      <p className="text-xs text-slate-400 mt-0.5">Commit 9f2a4b8: Cosmos UI Shell and design system integration</p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">Just now</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5">
                    <div>
                      <span className="text-xs font-mono font-bold text-purple-300">branch: main</span>
                      <p className="text-xs text-slate-400 mt-0.5">Commit a1c8d3e: Heatmap telemetry 365-day tracking pipeline</p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">Yesterday</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
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
                          <p className="text-sm font-semibold text-slate-200">Require Password to Exit</p>
                          <p className="text-xs text-slate-400">Enforce strict exit barriers</p>
                        </div>
                        <input type="checkbox" defaultChecked className="toggle-checkbox accent-fuchsia-400 w-5 h-5 cursor-pointer" disabled={settingsLocked} />
                      </div>
                      <div className="pt-2 border-t border-white/10">
                        <button
                          disabled={settingsLocked}
                          className="w-full py-2 rounded-lg border border-fuchsia-500/30 text-xs font-bold uppercase tracking-wider text-fuchsia-300 hover:bg-fuchsia-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Active Website Barrier</p>
                          <p className="text-xs text-slate-400">Block adult and distracting domain queries</p>
                        </div>
                        <input type="checkbox" defaultChecked className="toggle-checkbox accent-cyan-400 w-5 h-5 cursor-pointer" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Kiosk Focus Mode Hooks</p>
                          <p className="text-xs text-slate-400">Prevent window switching during active focus sessions</p>
                        </div>
                        <input type="checkbox" defaultChecked className="toggle-checkbox accent-cyan-400 w-5 h-5 cursor-pointer" />
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
                        <input type="checkbox" defaultChecked className="toggle-checkbox accent-purple-400 w-5 h-5 cursor-pointer" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Celestial Particle Dust</p>
                          <p className="text-xs text-slate-400">Enable high-fidelity animated starfield</p>
                        </div>
                        <input type="checkbox" defaultChecked className="toggle-checkbox accent-purple-400 w-5 h-5 cursor-pointer" />
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel rounded-2xl p-6 border border-white/10 md:col-span-2">
                    <div className="flex items-center gap-2 mb-4">
                      <RefreshCw className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-base font-bold text-white">System Updates</h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">Cosmic Core Engine</p>
                        <p className="text-xs text-slate-400">Check for the latest features and security enhancements</p>
                      </div>
                      <button
                        onClick={handleManualCheck}
                        disabled={isCheckingUpdate}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-emerald-600/80 hover:bg-emerald-500 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                      </button>
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
