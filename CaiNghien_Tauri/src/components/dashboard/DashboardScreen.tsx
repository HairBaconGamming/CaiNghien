import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api, UserProfile, HeatmapData, onTelemetryUpdate } from '../../services/api';
import { LevelProgress } from './LevelProgress';
import { ActivityHeatmap } from './ActivityHeatmap';
import { StatsCardsGrid } from './StatsCard';

import { QuotaWidget } from './QuotaWidget';

export interface DashboardScreenProps {
  refreshTrigger?: number;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  refreshTrigger,
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fallback initial data
  const defaultProfile: UserProfile = {
    username: 'Alex Chen',
    title: 'Stargazer',
    level: 1,
    current_xp: 0,
    next_level_xp: 1000,
    rank: 'Cadet'
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
        console.warn('Failed to load user profile:', profileRes.reason);
      }

      if (heatmapRes.status === 'fulfilled') {
        setHeatmapData(heatmapRes.value);
      } else {
        console.warn('Failed to load heatmap data:', heatmapRes.reason);
      }
    } catch (err) {
      console.error('Error in loadDashboardData:', err);
      setError('Không thể đồng bộ dữ liệu. Đang hiển thị bản lưu ngoại tuyến.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    const unsubscribe = onTelemetryUpdate(() => {
      loadDashboardData();
    });

    const handleFocus = () => {
      loadDashboardData();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshTrigger]);

  return (
    <div className="w-full h-full flex flex-col gap-6 p-2 md:p-6 select-none overflow-y-auto">
      {/* Error notification banner */}
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
            <RefreshCw className="w-3 h-3" /> Thử lại
          </button>
        </div>
      )}

      {/* Card A: User Profile & Cosmic Level Progression */}
      <LevelProgress
        profile={userProfile || defaultProfile}
        isLoading={isLoading && !userProfile}
      />

      {/* Quota Widget */}
      <QuotaWidget />

      {/* Stats Cards Grid */}
      <StatsCardsGrid
        totalContributions={heatmapData?.total_contributions ?? 0}
        currentStreak={heatmapData?.current_streak ?? 0}
        longestStreak={heatmapData?.longest_streak ?? 0}
        activityRate={heatmapData?.activity_rate ?? 0}
      />

      {/* Card B: Activity Heatmap */}
      <ActivityHeatmap
        data={heatmapData || undefined}
        isLoading={isLoading && !heatmapData}
      />
    </div>
  );
};

export default DashboardScreen;

