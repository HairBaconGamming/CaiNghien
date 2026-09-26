import React, { useState } from 'react';
import { Music, PlayCircle, Headphones } from 'lucide-react';
import { LofiPlayer } from './LofiPlayer';

export const MusicWidget: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'lofi' | 'spotify' | 'youtube' | 'soundcloud'>('lofi');

  return (
    <div className="flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 w-[340px] shrink-0">
      {/* Tabs */}
      <div className="flex w-full bg-slate-950/50 border-b border-white/10">
        <button
          onClick={() => setActiveTab('lofi')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'lofi' ? 'text-cyan-400 bg-white/5 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Headphones className="w-3 h-3" />
          Lofi
        </button>
        <button
          onClick={() => setActiveTab('spotify')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'spotify' ? 'text-green-400 bg-white/5 border-b-2 border-green-400' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Music className="w-3 h-3" />
          Spotify
        </button>
        <button
          onClick={() => setActiveTab('youtube')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'youtube' ? 'text-red-400 bg-white/5 border-b-2 border-red-400' : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <PlayCircle className="w-3 h-3" />
          YouTube
        </button>
      </div>

      {/* Content */}
      <div className="w-full relative min-h-[160px] flex items-center justify-center">
        {activeTab === 'lofi' && (
          <div className="w-full p-2 flex items-center justify-center">
            <LofiPlayer />
          </div>
        )}
        
        {activeTab === 'spotify' && (
          <iframe 
            style={{ borderRadius: '0' }} 
            src="https://open.spotify.com/embed/playlist/37i9dQZF1DWWQRwui0ExPn?utm_source=generator&theme=0" 
            width="100%" 
            height="152" 
            frameBorder="0" 
            allowFullScreen 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            loading="lazy"
            className="w-full h-full bg-transparent"
          ></iframe>
        )}

        {activeTab === 'youtube' && (
          <iframe 
            width="100%" 
            height="152" 
            src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=0" 
            title="lofi hip hop radio - beats to relax/study to" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowFullScreen
          ></iframe>
        )}
      </div>
    </div>
  );
};
