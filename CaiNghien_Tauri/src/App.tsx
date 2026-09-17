import { useState, useMemo } from 'react';
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
  ExternalLink
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [showTypingModal, setShowTypingModal] = useState(false);
  const [userProfile] = useState({
    name: 'Alex Chen',
    handle: '@astro_alex',
    level: 28,
    title: 'Stargazer',
    currentXp: 14350,
    nextLevelXp: 15000,
    currentStreak: 128,
    totalContributions: 4185,
    activityRate: 85,
  });

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
      <div className="relative z-10 flex flex-col w-full h-full">
        {/* Cosmos Top Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          userLevel={userProfile.level}
          userTitle={userProfile.title}
          hasNotifications={true}
        />

        {/* Active Workspace Viewport */}
        <main className="flex-1 overflow-hidden relative p-4 md:p-6 flex flex-col items-center justify-center">
          <div className="w-full h-full max-w-[1560px] mx-auto flex flex-col">
            {activeTab === 'dashboard' && (
              <DashboardScreen />
            )}

            {activeTab === 'focus' && (
              <FocusRoomScreen
                onExit={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'typing' && (
              <TypingChallengeScreen
                onClose={() => setActiveTab('dashboard')}
                onComplete={() => setActiveTab('dashboard')}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              onComplete={() => setShowTypingModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
