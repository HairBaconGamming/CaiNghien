import React, { useState, useEffect } from 'react';
import {
  Home,
  Calendar,
  Activity,
  SlidersHorizontal,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api, UserProfile, HeatmapData } from '../../services/api';
import { LevelProgress } from './LevelProgress';
import { ActivityHeatmap } from './ActivityHeatmap';
import { StatsCardsGrid } from './StatsCard';

export type DashboardNavTab = 'overview' | 'contributions' | 'streak' | 'options';

export interface DashboardScreenProps {
  onOpenFocusRoom?: () => void;
  onOpenTypingChallenge?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onOpenFocusRoom,
  onOpenTypingChallenge
}) => {
  const [activeSubTab, setActiveSubTab] = useState<DashboardNavTab>('contributions');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fallback initial data matching cain_dashboard.jpg
  const defaultProfile: UserProfile = {
    username: 'Alex Chen',
    title: 'Stargazer',
    level: 28,
    current_xp: 14350,
    next_level_xp: 15000,
    rank: 'Nova Voyager'
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [profileRes, heatmapRes] = await Promise.allSettled([
        api.getUserProfile(),
        api.getHeatmapData()
      ]);

      if (profileRes.status === 'fulfilled') {
        setUserProfile(profileRes.value);
      } else {
        console.warn('Failed to load user profile, using fallback:', profileRes.reason);
        setUserProfile(defaultProfile);
      }

      if (heatmapRes.status === 'fulfilled') {
        setHeatmapData(heatmapRes.value);
      } else {
        console.warn('Failed to load heatmap data, using fallback:', heatmapRes.reason);
      }
    } catch (err) {
      console.error('Error in loadDashboardData:', err);
      setError('Unable to sync telemetry from Cosmos core. Displaying offline snapshot.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-6 p-2 md:p-6 select-none overflow-y-auto">
      {/* Left Sub-navigation Sidebar (matching cain_dashboard.jpg) */}
      <aside className="w-full md:w-52 flex-shrink-0 flex flex-row md:flex-col gap-2 p-2">
        {/* Overview Tab */}
        <button
          type="button"
          onClick={() => setActiveSubTab('overview')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
            activeSubTab === 'overview'
              ? 'bg-gradient-to-r from-purple-600/30 to-purple-800/10 border border-purple-500/40 text-white shadow-[0_0_15px_rgba(168,85,247,0.25)]'
              : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Home className={`w-4 h-4 ${activeSubTab === 'overview' ? 'text-cyan-400' : 'text-slate-400'}`} />
          <span>Overview</span>
        </button>

        {/* Contributions Tab (Active by default in mockup) */}
        <button
          type="button"
          onClick={() => setActiveSubTab('contributions')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
            activeSubTab === 'contributions'
              ? 'bg-gradient-to-r from-purple-600/30 to-purple-800/10 border border-purple-500/40 text-white shadow-[0_0_15px_rgba(168,85,247,0.25)]'
              : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <div className="w-5 h-5 rounded-md bg-purple-500/20 border border-purple-400/30 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-3.5 h-3.5 text-purple-300" />
          </div>
          <span>Contributions</span>
        </button>

        {/* Streak Tab */}
        <button
          type="button"
          onClick={() => setActiveSubTab('streak')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
            activeSubTab === 'streak'
              ? 'bg-gradient-to-r from-purple-600/30 to-purple-800/10 border border-purple-500/40 text-white shadow-[0_0_15px_rgba(168,85,247,0.25)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Activity className="w-4 h-4 text-slate-400" />
          <span>Streak</span>
        </button>

        {/* Heatmap Options Tab */}
        <button
          type="button"
          onClick={() => setActiveSubTab('options')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
            activeSubTab === 'options'
              ? 'bg-gradient-to-r from-purple-600/30 to-purple-800/10 border border-purple-500/40 text-white shadow-[0_0_15px_rgba(168,85,247,0.25)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          <span>Heatmap Options</span>
        </button>

        {/* Quick Launch Station Hooks */}
        {(onOpenFocusRoom || onOpenTypingChallenge) && (
          <div className="mt-4 pt-4 border-t border-white/10 hidden md:flex flex-col gap-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-2">
              Stations
            </span>
            {onOpenFocusRoom && (
              <button
                type="button"
                onClick={onOpenFocusRoom}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-sky-300 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-400/40 transition-all cursor-pointer text-left"
              >
                <span>Focus Sanctuary</span>
              </button>
            )}
            {onOpenTypingChallenge && (
              <button
                type="button"
                onClick={onOpenTypingChallenge}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-400/40 transition-all cursor-pointer text-left"
              >
                <span>Quantum Typing</span>
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Error notification banner if any */}
        {error && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={loadDashboardData}
              className="flex items-center gap-1 text-amber-200 underline hover:text-white ml-3"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Card A: User Profile & Cosmic Level Progression */}
        <LevelProgress
          profile={userProfile || defaultProfile}
          isLoading={isLoading && !userProfile}
        />

        {/* Optional Stats Cards Grid when on Overview Tab */}
        {activeSubTab === 'overview' && (
          <StatsCardsGrid
            totalContributions={heatmapData?.total_contributions ?? 4185}
            currentStreak={heatmapData?.current_streak ?? 128}
            longestStreak={heatmapData?.longest_streak ?? 156}
            activityRate={heatmapData?.activity_rate ?? 85}
          />
        )}

        {/* Card B: Activity Heatmap 2023-2024 */}
        <ActivityHeatmap
          data={heatmapData || undefined}
          isLoading={isLoading && !heatmapData}
          yearRange="2023-2024"
        />
      </main>
    </div>
  );
};

export default DashboardScreen;
