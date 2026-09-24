import React, { useState, useEffect } from 'react';
import { User, AtSign, Save, Shield, Star, Trophy, Sparkles } from 'lucide-react';
import { api, UserProfile } from '../services/api';

export interface AccountScreenProps {
  addToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ addToast }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    username: '',
    handle: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const data = await api.getUserProfile();
      setProfile(data);
      setEditForm({
        username: data.username || '',
        handle: data.handle || ''
      });
    } catch (e) {
      addToast('error', 'Không thể tải thông tin tài khoản');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    
    // Basic validation
    if (!editForm.username.trim()) {
      addToast('error', 'Tên hiển thị không được để trống');
      return;
    }
    
    let handleToSave = editForm.handle.trim();
    if (handleToSave && !handleToSave.startsWith('@')) {
      handleToSave = '@' + handleToSave;
    }

    try {
      setIsSaving(true);
      const updatedProfile: UserProfile = {
        ...profile,
        username: editForm.username.trim(),
        handle: handleToSave
      };
      
      await api.updateUserProfile(updatedProfile);
      setProfile(updatedProfile);
      setEditForm({
        username: updatedProfile.username,
        handle: updatedProfile.handle || ''
      });
      addToast('success', 'Đã cập nhật thông tin tài khoản thành công!');
    } catch (e) {
      addToast('error', 'Lỗi khi lưu thông tin: ' + e);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !profile) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-purple-600/20 to-pink-500/20 border border-white/15 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.25)] relative overflow-hidden">
              <User className="w-6 h-6 text-cyan-400 relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-wide">Hồ sơ cá nhân</h2>
              <p className="text-sm text-slate-400 mt-0.5">Quản lý định danh của bạn trong vũ trụ Cosmos</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Form */}
          <div className="md:col-span-2 space-y-6">
            <div className="glass-panel rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                Thông tin định danh
              </h3>
              
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 ml-1">
                    Tên hiển thị
                  </label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="text"
                      value={editForm.username}
                      onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="VD: Alex Chen"
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500/50 focus:bg-slate-900/80 transition-all placeholder:text-slate-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 ml-1">Tên công khai sẽ hiển thị trên bảng xếp hạng và các huy hiệu.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 ml-1">
                    Định danh (Handle)
                  </label>
                  <div className="relative group">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                    <input
                      type="text"
                      value={editForm.handle}
                      onChange={(e) => setEditForm(prev => ({ ...prev, handle: e.target.value }))}
                      placeholder="VD: @astro_alex"
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm outline-none focus:border-purple-500/50 focus:bg-slate-900/80 transition-all placeholder:text-slate-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 ml-1">Chuỗi duy nhất định danh bạn trong hệ thống (nên bắt đầu bằng @).</p>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-sm font-semibold shadow-[0_0_20px_rgba(0,240,255,0.2)] hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Cosmic Identity Card */}
          <div className="md:col-span-1">
            <div className="glass-panel rounded-2xl p-6 border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/90 relative overflow-hidden group">
              {/* Decorative background elements */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/10 blur-[30px] rounded-full group-hover:bg-purple-500/20 transition-all duration-700" />
              <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-cyan-500/10 blur-[30px] rounded-full group-hover:bg-cyan-500/20 transition-all duration-700" />
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 p-1 mb-4 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                    <span className="text-2xl font-black text-white">
                      {profile?.username ? profile.username.charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white tracking-wide">
                  {profile?.username || 'Người chơi vô danh'}
                </h3>
                <p className="text-sm text-cyan-400 font-medium mt-1">
                  {profile?.handle || '@unknown'}
                </p>

                <div className="w-full h-[1px] bg-white/10 my-5" />

                <div className="w-full space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5" /> Cấp độ
                    </span>
                    <span className="text-sm font-bold text-white">Cấp {profile?.level || 1}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5" /> Danh hiệu
                    </span>
                    <span className="text-sm font-bold text-purple-300">
                      {profile?.title || 'Tân binh'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Kinh nghiệm
                    </span>
                    <span className="text-sm font-bold text-cyan-300">
                      {profile?.current_xp || 0} / {profile?.next_level_xp || 1000}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountScreen;
