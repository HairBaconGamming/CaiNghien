import React, { useState, useEffect, useRef } from 'react';
import { CloudRain, Sparkles, Headphones, Volume2, VolumeX, Sliders, Radio, Waves } from 'lucide-react';

export type SoundscapeType = 'lofi_music' | 'cosmic_rain' | 'deep_space' | 'lofi_waves' | 'binaural_432';

export interface SoundscapeTrack {
  id: SoundscapeType;
  title: string;
  category: 'lofi' | 'ambience';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

export const SOUNDSCAPE_TRACKS: SoundscapeTrack[] = [
  {
    id: 'lofi_music',
    title: 'Lofi Music (Cosmic Chill)',
    category: 'lofi',
    icon: Headphones,
    description: 'Âm hưởng Lofi vũ trụ thư thái với hợp âm du dương',
  },
  {
    id: 'cosmic_rain',
    title: 'Cosmic Rain (Mưa vũ trụ)',
    category: 'ambience',
    icon: CloudRain,
    description: 'Tiếng mưa rơi nhẹ nhàng trên vòm kính thiên thạch',
  },
  {
    id: 'deep_space',
    title: 'Deep Space Drone',
    category: 'ambience',
    icon: Radio,
    description: 'Tần số trầm cộng hưởng sâu giữa không gian vũ trụ',
  },
  {
    id: 'lofi_waves',
    title: 'Lofi Waves (Sóng biển vũ trụ)',
    category: 'ambience',
    icon: Waves,
    description: 'Những đợt sóng rì rào nhịp nhàng ru dịu tâm trí',
  },
  {
    id: 'binaural_432',
    title: 'Binaural Alpha 432Hz',
    category: 'ambience',
    icon: Sparkles,
    description: 'Sóng não Alpha 10Hz kích hoạt trạng thái tập trung sâu',
  },
];

export interface LofiPlayerProps {
  className?: string;
  onTrackChange?: (trackId: SoundscapeType) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export const LofiPlayer: React.FC<LofiPlayerProps> = ({
  className = '',
  onTrackChange,
  onPlayStateChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SoundscapeType>('lofi_music');
  const [activeCategory, setActiveCategory] = useState<'ambience' | 'lofi'>('lofi');
  const [volume, setVolume] = useState(0.65);
  const [isMuted, setIsMuted] = useState(false);
  const [showSoundSelector, setShowSoundSelector] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Audio Context & Nodes Reference
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeNodesRef = useRef<{
    sources: (AudioNode | number)[];
    cleanup?: () => void;
  }>({ sources: [] });

  // Initialize Web Audio Context
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
      gain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      masterGainRef.current = gain;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return { ctx: audioCtxRef.current, gain: masterGainRef.current! };
  };

  // Stop currently running audio generators
  const stopCurrentAudio = () => {
    if (activeNodesRef.current.cleanup) {
      try {
        activeNodesRef.current.cleanup();
      } catch (e) {
        console.warn('Audio cleanup error:', e);
      }
    }

    activeNodesRef.current.sources.forEach((item) => {
      if (typeof item === 'number') {
        clearInterval(item);
      } else {
        try {
          if ('stop' in item && typeof (item as AudioScheduledSourceNode).stop === 'function') {
            (item as AudioScheduledSourceNode).stop();
          }
          item.disconnect();
        } catch {
          // Node already stopped or disconnected
        }
      }
    });

    activeNodesRef.current = { sources: [] };
  };

  // --- Genuine Web Audio Synthesis Implementations ---

  // 1. Cosmic Rain: Pink/Brown Noise + Filter + randomized droplet resonance
  const playCosmicRain = (ctx: AudioContext, dest: GainNode) => {
    const bufferSize = ctx.sampleRate * 4; // 4 second loop
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Generate pink noise using Paul Kellet's algorithm
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const rainNoise = ctx.createBufferSource();
    rainNoise.buffer = noiseBuffer;
    rainNoise.loop = true;

    // Filter to soft gentle rain sound
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.setValueAtTime(850, ctx.currentTime);
    rainFilter.Q.setValueAtTime(1.2, ctx.currentTime);

    const rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0.7, ctx.currentTime);

    rainNoise.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(dest);

    rainNoise.start();

    // Procedural gentle water droplets
    const dropletInterval = window.setInterval(() => {
      if (!isPlaying && audioCtxRef.current?.state !== 'running') return;
      try {
        const dropOsc = ctx.createOscillator();
        const dropGain = ctx.createGain();
        const dropFilter = ctx.createBiquadFilter();

        const freq = 1600 + Math.random() * 1400;
        dropOsc.type = 'sine';
        dropOsc.frequency.setValueAtTime(freq, ctx.currentTime);
        dropOsc.frequency.exponentialRampToValueAtTime(freq * 0.7, ctx.currentTime + 0.06);

        dropFilter.type = 'bandpass';
        dropFilter.frequency.setValueAtTime(freq, ctx.currentTime);
        dropFilter.Q.setValueAtTime(12, ctx.currentTime);

        const dropVol = 0.02 + Math.random() * 0.04;
        dropGain.gain.setValueAtTime(dropVol, ctx.currentTime);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);

        dropOsc.connect(dropFilter);
        dropFilter.connect(dropGain);
        dropGain.connect(dest);

        dropOsc.start(ctx.currentTime);
        dropOsc.stop(ctx.currentTime + 0.07);
      } catch {
        // Safe catch on shutdown
      }
    }, 180);

    activeNodesRef.current.sources.push(rainNoise, rainGain, rainFilter, dropletInterval);
  };

  // 2. Deep Space Drone: Dual detuned low sines + LFO modulated filter
  const playDeepSpaceDrone = (ctx: AudioContext, dest: GainNode) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    const droneFilter = ctx.createBiquadFilter();
    const droneGain = ctx.createGain();

    // Fundamental cosmic pitch ~55Hz (A1)
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(55, ctx.currentTime);

    // Beating chorus detune ~55.38Hz
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(55.38, ctx.currentTime);

    // Deep sub-bass ~27.5Hz (A0)
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(27.5, ctx.currentTime);

    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(160, ctx.currentTime);
    droneFilter.Q.setValueAtTime(3.5, ctx.currentTime);

    // LFO slowly sweeps filter cutoff
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.06, ctx.currentTime); // 16 second cycle
    lfoGain.gain.setValueAtTime(90, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(droneFilter.frequency);

    droneGain.gain.setValueAtTime(0.5, ctx.currentTime);

    osc1.connect(droneFilter);
    osc2.connect(droneFilter);
    subOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(dest);

    osc1.start();
    osc2.start();
    subOsc.start();
    lfo.start();

    activeNodesRef.current.sources.push(osc1, osc2, subOsc, lfo, lfoGain, droneFilter, droneGain);
  };

  // 3. Lofi Waves: Modulated pink noise swell with rolling surf motion
  const playLofiWaves = (ctx: AudioContext, dest: GainNode) => {
    const bufferSize = ctx.sampleRate * 5;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + (0.04 * white)) / 1.04;
      last = data[i];
      data[i] *= 3.5;
    }

    const waveNoise = ctx.createBufferSource();
    waveNoise.buffer = noiseBuffer;
    waveNoise.loop = true;

    const waveFilter = ctx.createBiquadFilter();
    waveFilter.type = 'bandpass';
    waveFilter.frequency.setValueAtTime(320, ctx.currentTime);
    waveFilter.Q.setValueAtTime(2.2, ctx.currentTime);

    // Wave swell LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // ~8s wave period

    const lfoFilterGain = ctx.createGain();
    lfoFilterGain.gain.setValueAtTime(200, ctx.currentTime);
    lfo.connect(lfoFilterGain);
    lfoFilterGain.connect(waveFilter.frequency);

    const waveGain = ctx.createGain();
    waveGain.gain.setValueAtTime(0.65, ctx.currentTime);

    waveNoise.connect(waveFilter);
    waveFilter.connect(waveGain);
    waveGain.connect(dest);

    waveNoise.start();
    lfo.start();

    activeNodesRef.current.sources.push(waveNoise, waveFilter, lfo, lfoFilterGain, waveGain);
  };

  // 4. Binaural Alpha 432Hz: True 10Hz binaural beat for laser focus
  const playBinaural432 = (ctx: AudioContext, dest: GainNode) => {
    const leftOsc = ctx.createOscillator();
    const rightOsc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();

    const leftPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const rightPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    const binauralGain = ctx.createGain();
    binauralGain.gain.setValueAtTime(0.4, ctx.currentTime);

    leftOsc.type = 'sine';
    leftOsc.frequency.setValueAtTime(432.0, ctx.currentTime); // Left ear 432Hz

    rightOsc.type = 'sine';
    rightOsc.frequency.setValueAtTime(442.0, ctx.currentTime); // Right ear 442Hz -> 10Hz Alpha difference!

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(108.0, ctx.currentTime); // Gentle harmonic anchor

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.08, ctx.currentTime);
    subOsc.connect(subGain);
    subGain.connect(binauralGain);

    if (leftPan && rightPan) {
      leftPan.pan.setValueAtTime(-0.95, ctx.currentTime);
      rightPan.pan.setValueAtTime(0.95, ctx.currentTime);

      leftOsc.connect(leftPan);
      leftPan.connect(binauralGain);

      rightOsc.connect(rightPan);
      rightPan.connect(binauralGain);
    } else {
      leftOsc.connect(binauralGain);
      rightOsc.connect(binauralGain);
    }

    binauralGain.connect(dest);

    leftOsc.start();
    rightOsc.start();
    subOsc.start();

    activeNodesRef.current.sources.push(leftOsc, rightOsc, subOsc, binauralGain);
  };

  // 5. Lofi Music: Cosmic Rhodes Chill Generative Chords
  const playLofiMusic = (ctx: AudioContext, dest: GainNode) => {
    // Generative chord progression: Fmaj7 -> Em7 -> Dm7 -> Cmaj7
    const chords = [
      [174.61, 220.00, 261.63, 329.63], // F3, A3, C4, E4 (Fmaj7)
      [164.81, 196.00, 246.94, 293.66], // E3, G3, B3, D4 (Em7)
      [146.83, 174.61, 220.00, 261.63], // D3, F3, A3, C4 (Dm7)
      [130.81, 164.81, 196.00, 246.94], // C3, E3, G3, B3 (Cmaj7)
    ];

    let chordStep = 0;

    // Soft ambient vinyl crackle
    const crackleBufferSize = ctx.sampleRate * 2;
    const crackleBuffer = ctx.createBuffer(1, crackleBufferSize, ctx.sampleRate);
    const cData = crackleBuffer.getChannelData(0);
    for (let i = 0; i < crackleBufferSize; i++) {
      cData[i] = Math.random() < 0.002 ? (Math.random() * 2 - 1) * 0.15 : 0;
    }
    const crackleSource = ctx.createBufferSource();
    crackleSource.buffer = crackleBuffer;
    crackleSource.loop = true;
    const crackleGain = ctx.createGain();
    crackleGain.gain.setValueAtTime(0.35, ctx.currentTime);
    crackleSource.connect(crackleGain);
    crackleGain.connect(dest);
    crackleSource.start();

    // Function to play one chord with soft synth pad envelope
    const playChord = () => {
      if (!isPlaying && audioCtxRef.current?.state !== 'running') return;
      const currentChord = chords[chordStep % chords.length];
      chordStep++;

      const now = ctx.currentTime;
      const chordDuration = 4.2;

      currentChord.forEach((freq, idx) => {
        try {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(550, now);
          filter.Q.setValueAtTime(2.0, now);

          // Soft attack, warm sustain, gentle release
          noteGain.gain.setValueAtTime(0.0001, now);
          noteGain.gain.exponentialRampToValueAtTime(0.09, now + 1.2);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + chordDuration);

          osc.connect(filter);
          filter.connect(noteGain);
          noteGain.connect(dest);

          osc.start(now);
          osc.stop(now + chordDuration + 0.1);
        } catch {
          // Safe catch on shutdown
        }
      });
    };

    // Play first chord immediately
    playChord();

    // Schedule subsequent chords
    const chordInterval = window.setInterval(playChord, 4000);

    activeNodesRef.current.sources.push(crackleSource, crackleGain, chordInterval);
  };

  // Trigger sound engine based on track
  const startSoundEngine = (trackId: SoundscapeType) => {
    stopCurrentAudio();
    const { ctx, gain } = getAudioContext();

    switch (trackId) {
      case 'lofi_music':
        playLofiMusic(ctx, gain);
        break;
      case 'cosmic_rain':
        playCosmicRain(ctx, gain);
        break;
      case 'deep_space':
        playDeepSpaceDrone(ctx, gain);
        break;
      case 'lofi_waves':
        playLofiWaves(ctx, gain);
        break;
      case 'binaural_432':
        playBinaural432(ctx, gain);
        break;
      default:
        playLofiMusic(ctx, gain);
    }
  };

  // Toggle playback
  const handleTogglePlay = (trackId?: SoundscapeType) => {
    const targetTrack = trackId || currentTrack;

    if (isPlaying && targetTrack === currentTrack) {
      // Pause
      stopCurrentAudio();
      setIsPlaying(false);
      onPlayStateChange?.(false);
    } else {
      // Play
      setCurrentTrack(targetTrack);
      setIsPlaying(true);
      startSoundEngine(targetTrack);
      onTrackChange?.(targetTrack);
      onPlayStateChange?.(true);

      const trackMeta = SOUNDSCAPE_TRACKS.find((t) => t.id === targetTrack);
      if (trackMeta) {
        setActiveCategory(trackMeta.category);
      }
    }
  };

  // Volume slider change
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (isMuted && newVol > 0) {
      setIsMuted(false);
    }
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(newVol, audioCtxRef.current.currentTime, 0.05);
    }
  };

  // Mute toggle
  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (masterGainRef.current && audioCtxRef.current) {
        masterGainRef.current.gain.setTargetAtTime(volume, audioCtxRef.current.currentTime, 0.05);
      }
    } else {
      setIsMuted(true);
      if (masterGainRef.current && audioCtxRef.current) {
        masterGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
      }
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCurrentAudio();
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {
          // Ignored
        }
      }
    };
  }, []);

  return (
    <div className={`relative flex items-center justify-between w-full select-none ${className}`}>
      {/* 1. Left Pill: AMBIENCE Quick Button matching cain_focus_room.jpg */}
      <div className="relative flex items-center">
        <div
          className="px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/15 rounded-full flex items-center gap-3 shadow-lg"
          style={{
            background: 'rgba(15, 23, 42, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <span className="text-[11px] font-bold tracking-[0.2em] text-slate-200 uppercase">
            AMBIENCE
          </span>

          <button
            type="button"
            onClick={() => handleTogglePlay('cosmic_rain')}
            aria-label="Bật tiếng mưa Ambience"
            title="Bật/Tắt Tiếng mưa Vũ trụ (Cosmic Rain)"
            className={`
              w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer
              ${isPlaying && currentTrack === 'cosmic_rain'
                ? 'bg-cyan-400/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_10px_rgba(0,240,255,0.4)] scale-105'
                : 'bg-white/10 hover:bg-white/20 text-slate-300 border border-white/15 hover:border-white/30'
              }
            `}
          >
            <CloudRain size={14} className={isPlaying && currentTrack === 'cosmic_rain' ? 'animate-pulse' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Center Audio Controls: Segmented Pill matching cain_focus_room.jpg */}
      <div className="relative flex items-center justify-center">
        <div 
          className="p-1 rounded-full flex items-center gap-1 shadow-2xl transition-all"
          style={{
            background: 'rgba(11, 16, 32, 0.75)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          {/* Segment 1: AMBIENCE ✨ */}
          <button
            type="button"
            onClick={() => {
              setActiveCategory('ambience');
              if (currentTrack === 'lofi_music' || !isPlaying) {
                handleTogglePlay('cosmic_rain');
              } else {
                setShowSoundSelector((prev) => !prev);
              }
            }}
            className={`
              px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5
              ${isPlaying && activeCategory === 'ambience'
                ? 'bg-white/15 border border-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.25),inset_0_1px_1px_rgba(255,255,255,0.5)]'
                : 'text-slate-400 hover:text-white'
              }
            `}
          >
            <span>AMBIENCE</span>
            <Sparkles size={12} className="text-cyan-300" />
          </button>

          {/* Segment 2: 🎧 LOFI MUSIC (Active pill in cain_focus_room.jpg) */}
          <button
            type="button"
            onClick={() => {
              setActiveCategory('lofi');
              handleTogglePlay('lofi_music');
            }}
            className={`
              px-4 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5
              ${(isPlaying && currentTrack === 'lofi_music') || (!isPlaying && activeCategory === 'lofi')
                ? 'bg-white/15 border border-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.25),inset_0_1px_1px_rgba(255,255,255,0.5)]'
                : 'text-slate-400 hover:text-white'
              }
            `}
          >
            <Headphones size={13} className={isPlaying && currentTrack === 'lofi_music' ? 'text-cyan-300 animate-pulse' : ''} />
            <span>LOFI MUSIC</span>
          </button>

          {/* Additional Sound Selector & Volume Toggle Icons */}
          <button
            type="button"
            onClick={() => setShowSoundSelector((prev) => !prev)}
            title="Danh sách không gian âm thanh"
            className="w-7 h-7 ml-0.5 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Sliders size={12} />
          </button>

          <button
            type="button"
            onClick={() => setShowVolumeSlider((prev) => !prev)}
            title="Âm lượng"
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {isMuted || volume === 0 ? (
              <VolumeX size={12} className="text-rose-400" />
            ) : (
              <Volume2 size={12} />
            )}
          </button>
        </div>

        {/* Floating Soundscape Selector Popover */}
        {showSoundSelector && (
          <div 
            className="absolute bottom-12 left-1/2 -translate-x-1/2 w-72 rounded-2xl p-3 z-50 animate-fade-in shadow-2xl"
            style={{
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(28px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
            }}
          >
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
              <span>CHỌN KHÔNG GIAN ÂM THANH</span>
              <button 
                type="button"
                onClick={() => setShowSoundSelector(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              {SOUNDSCAPE_TRACKS.map((track) => {
                const IconComponent = track.icon;
                const isSelected = isPlaying && currentTrack === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => {
                      handleTogglePlay(track.id);
                      setShowSoundSelector(false);
                    }}
                    className={`
                      w-full px-3 py-2 rounded-xl text-left flex items-center gap-2.5 transition-all cursor-pointer
                      ${isSelected
                        ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-200'
                        : 'hover:bg-white/10 text-slate-300'
                      }
                    `}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isSelected ? 'bg-cyan-400/30 text-cyan-300' : 'bg-white/5 text-slate-400'}`}>
                      <IconComponent size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{track.title}</div>
                      <div className="text-[10px] text-slate-400 truncate">{track.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Floating Volume Slider Popover */}
        {showVolumeSlider && (
          <div 
            className="absolute bottom-12 right-0 w-48 rounded-2xl p-3 z-50 animate-fade-in shadow-2xl flex items-center gap-2"
            style={{
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(28px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
            }}
          >
            <button
              type="button"
              onClick={handleToggleMute}
              className="text-slate-300 hover:text-white cursor-pointer"
            >
              {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
            <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
