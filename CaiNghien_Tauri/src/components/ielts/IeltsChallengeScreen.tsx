import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { Volume2, ArrowRight, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';

interface IeltsTopic {
  id: number;
  name: string;
  description: string;
  icon: string;
}

interface IeltsWord {
  id: number;
  topic_id: number;
  word: string;
}

interface CambridgeEntry {
  pos: string;
  ipa_uk: string;
  ipa_us: string;
  audio_url_uk: string;
  audio_url_us: string;
  definition: string;
  examples: string[];
}

export const IeltsChallengeScreen: React.FC<{
  onClose?: () => void;
  onComplete?: () => void;
  mode?: 'quota' | 'unlock';
}> = ({ onClose, onComplete, mode = 'quota' }) => {
  const [screen, setScreen] = useState<1 | 2 | 3>(1);
  const [topics, setTopics] = useState<IeltsTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<IeltsTopic | null>(null);
  
  // Screen 2
  const [words, setWords] = useState<IeltsWord[]>([]);
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [cambridgeData, setCambridgeData] = useState<Record<string, CambridgeEntry>>({});
  const [isFlipped, setIsFlipped] = useState(false);
  const [loadingWord, setLoadingWord] = useState(false);

  // Screen 3
  const [testWords, setTestWords] = useState<IeltsWord[]>([]);
  const [testIdx, setTestIdx] = useState(0);
  const [testInput, setTestInput] = useState('');
  const [score, setScore] = useState(0);
  const [testComplete, setTestComplete] = useState(false);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'incorrect'>('none');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      const ts = await api.getIeltsTopics();
      setTopics(ts);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTopicSelect = async (t: IeltsTopic) => {
    setSelectedTopic(t);
    setScreen(2);
    try {
      const ws = await api.getTopicWords(t.id);
      setWords(ws);
      setCurrentWordIdx(0);
      setIsFlipped(false);
      if (ws.length > 0) {
        loadCambridge(ws[0].word);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const loadCambridge = async (word: string) => {
    if (cambridgeData[word]) return;
    setLoadingWord(true);
    try {
      const data = await api.fetchCambridge(word);
      setCambridgeData(prev => ({ ...prev, [word]: data }));
    } catch (e) {
      console.error(e);
    }
    setLoadingWord(false);
  };

  const handleNextFlashcard = () => {
    setIsFlipped(false);
    if (currentWordIdx < words.length - 1) {
      const nextIdx = currentWordIdx + 1;
      setCurrentWordIdx(nextIdx);
      loadCambridge(words[nextIdx].word);
    }
  };

  const handlePrevFlashcard = () => {
    setIsFlipped(false);
    if (currentWordIdx > 0) {
      const prevIdx = currentWordIdx - 1;
      setCurrentWordIdx(prevIdx);
      loadCambridge(words[prevIdx].word);
    }
  };

  const playAudio = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (url) {
      const audio = new Audio(url);
      audio.play().catch(console.error);
    }
  };

  const startTest = () => {
    // Shuffle words for test
    const shuffled = [...words].sort(() => 0.5 - Math.random()).slice(0, 10); // max 10 for test
    setTestWords(shuffled);
    setTestIdx(0);
    setScore(0);
    setTestInput('');
    setTestComplete(false);
    setScreen(3);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const submitTestAnswer = async () => {
    if (feedback !== 'none') return; // prevent spam
    const cw = testWords[testIdx];
    const isCorrect = testInput.trim().toLowerCase() === cw.word.toLowerCase();
    
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    
    if (isCorrect) {
      setScore(s => s + 1);
    }
    
    try {
      await api.updateVocabProgress(cw.id, isCorrect);
    } catch (e) {}

    setTimeout(() => {
      setFeedback('none');
      setTestInput('');
      if (testIdx < testWords.length - 1) {
        setTestIdx(i => i + 1);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        finishTest(score + (isCorrect ? 1 : 0));
      }
    }, 1000);
  };

  const finishTest = async (finalScore: number) => {
    setTestComplete(true);
    if (finalScore === testWords.length) {
      try {
        const res = await api.submitIeltsTest(finalScore, testWords.length, mode);
        alert(res.message);
      } catch (e) {
        console.error(e);
      }
      if (onComplete) onComplete();
    }
  };

  // Prevent paste
  const preventPaste = (e: React.ClipboardEvent | React.DragEvent | React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative p-8">
      {screen === 1 && (
        <div className="w-full max-w-5xl relative">
          {onClose && (
            <button 
              onClick={onClose} 
              className="absolute -top-12 left-0 text-cyan-400 hover:text-cyan-300 flex items-center gap-2 font-semibold text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Thoát
            </button>
          )}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 drop-shadow-[0_0_15px_rgba(0,240,255,0.3)] mb-4">
              Học Từ Vựng IELTS
            </h1>
            <p className="text-slate-400">Chọn một chủ đề để bắt đầu rèn luyện</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {topics.map(t => (
              <div 
                key={t.id}
                onClick={() => handleTopicSelect(t)}
                className="glass-panel p-6 rounded-2xl cursor-pointer border border-white/10 hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all group"
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{t.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{t.name}</h3>
                <p className="text-xs text-slate-400 line-clamp-2">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {screen === 2 && words.length > 0 && (
        <div className="w-full max-w-2xl flex flex-col items-center">
          <button onClick={() => setScreen(1)} className="self-start mb-6 text-cyan-400 hover:text-cyan-300 flex items-center gap-2 font-semibold text-sm">
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
          
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">{selectedTopic?.name}</h2>
            <p className="text-slate-400 text-sm">Từ {currentWordIdx + 1} / {words.length}</p>
          </div>

          <div 
            className="relative w-full aspect-[4/3] perspective-1000 mb-8 cursor-pointer"
            onClick={() => !loadingWord && setIsFlipped(!isFlipped)}
          >
            <div className={`w-full h-full transition-transform duration-500 preserve-3d relative ${isFlipped ? 'rotate-y-180' : ''}`}>
              {/* Front */}
              <div className="absolute inset-0 backface-hidden glass-panel border border-white/10 rounded-3xl flex flex-col items-center justify-center p-8 bg-slate-900/80">
                <h1 className="text-5xl font-black text-white mb-4">{words[currentWordIdx].word}</h1>
                {cambridgeData[words[currentWordIdx].word] && (
                  <span className="text-cyan-400 font-semibold italic text-lg">
                    {cambridgeData[words[currentWordIdx].word].pos}
                  </span>
                )}
                {loadingWord && <p className="text-slate-500 mt-4 animate-pulse">Đang tải dữ liệu Cambridge...</p>}
              </div>

              {/* Back */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 glass-panel border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] rounded-3xl p-8 flex flex-col bg-slate-900/90 overflow-y-auto">
                {cambridgeData[words[currentWordIdx].word] && cambridgeData[words[currentWordIdx].word].definition ? (
                  <>
                    <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{words[currentWordIdx].word}</h2>
                        <div className="flex gap-4 text-sm font-mono text-slate-300">
                          {cambridgeData[words[currentWordIdx].word].ipa_uk && (
                            <span className="flex items-center gap-2">
                              UK: {cambridgeData[words[currentWordIdx].word].ipa_uk}
                              <Volume2 
                                className="w-4 h-4 text-cyan-400 hover:text-cyan-300" 
                                onClick={(e) => playAudio(cambridgeData[words[currentWordIdx].word].audio_url_uk, e)} 
                              />
                            </span>
                          )}
                          {cambridgeData[words[currentWordIdx].word].ipa_us && (
                            <span className="flex items-center gap-2">
                              US: {cambridgeData[words[currentWordIdx].word].ipa_us}
                              <Volume2 
                                className="w-4 h-4 text-purple-400 hover:text-purple-300" 
                                onClick={(e) => playAudio(cambridgeData[words[currentWordIdx].word].audio_url_us, e)} 
                              />
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-white/5 rounded-lg text-sm text-cyan-400 font-medium">
                        {cambridgeData[words[currentWordIdx].word].pos}
                      </span>
                    </div>
                    
                    <div className="mb-4 flex-1">
                      <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Định nghĩa</h3>
                      <p className="text-white text-lg">{cambridgeData[words[currentWordIdx].word].definition}</p>
                    </div>

                    {cambridgeData[words[currentWordIdx].word].examples.length > 0 && (
                      <div>
                        <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Ví dụ</h3>
                        <ul className="list-disc pl-5 text-slate-300 space-y-2 text-sm italic">
                          {cambridgeData[words[currentWordIdx].word].examples.map((eg, i) => (
                            <li key={i}>{eg}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400">Không có dữ liệu chi tiết.</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between w-full items-center">
            <button 
              onClick={handlePrevFlashcard} 
              disabled={currentWordIdx === 0}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={startTest}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold uppercase tracking-wider hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-shadow"
            >
              Bắt đầu kiểm tra
            </button>
            <button 
              onClick={handleNextFlashcard} 
              disabled={currentWordIdx === words.length - 1}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {screen === 3 && testWords.length > 0 && !testComplete && (
        <div className="w-full max-w-3xl flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-8">
            <span className="text-slate-400 font-medium">Chủ đề: {selectedTopic?.name}</span>
            <div className="px-4 py-1.5 rounded-full bg-slate-900 border border-white/10 font-bold text-cyan-400">
              Câu {testIdx + 1} / {testWords.length}
            </div>
            <span className="text-slate-400 font-medium">Điểm: {score}</span>
          </div>

          <div className={`w-full glass-panel border rounded-3xl p-8 mb-8 flex flex-col relative transition-all duration-300 ${
            feedback === 'correct' ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]' :
            feedback === 'incorrect' ? 'border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.3)] animate-shake' : 'border-white/10'
          }`}>
            {cambridgeData[testWords[testIdx].word] ? (
              <>
                <div className="mb-6 flex justify-between items-center">
                  <span className="px-3 py-1 bg-white/5 rounded-lg text-sm text-cyan-400 font-medium italic">
                    {cambridgeData[testWords[testIdx].word].pos}
                  </span>
                  <div className="flex gap-2">
                    {cambridgeData[testWords[testIdx].word].audio_url_uk && (
                      <button onClick={(e) => playAudio(cambridgeData[testWords[testIdx].word].audio_url_uk, e)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-cyan-400">
                        <Volume2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-6 text-center leading-relaxed">
                  {cambridgeData[testWords[testIdx].word].definition}
                </h3>
                {cambridgeData[testWords[testIdx].word].examples[0] && (
                  <div className="p-4 bg-slate-950/50 rounded-xl border border-white/5 italic text-slate-300 text-center">
                    "{cambridgeData[testWords[testIdx].word].examples[0].replace(new RegExp(testWords[testIdx].word, 'gi'), '_____')}"
                  </div>
                )}
              </>
            ) : (
              <h3 className="text-xl font-bold text-white text-center">Hãy điền từ tiếng Anh đúng!</h3>
            )}
          </div>

          <form 
            onSubmit={(e) => { e.preventDefault(); submitTestAnswer(); }}
            className="w-full relative"
          >
            <input 
              ref={inputRef}
              type="text"
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              onPaste={preventPaste}
              onDrop={preventPaste}
              onContextMenu={preventPaste}
              disabled={feedback !== 'none'}
              autoComplete="off"
              spellCheck="false"
              className="w-full text-center text-3xl font-black bg-slate-900 border-2 border-white/10 rounded-2xl py-4 focus:outline-none focus:border-cyan-400 transition-colors"
              placeholder="Gõ từ vào đây..."
            />
            {feedback === 'correct' && <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 text-emerald-500" />}
            {feedback === 'incorrect' && <XCircle className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 text-rose-500" />}
          </form>
        </div>
      )}

      {testComplete && (
        <div className="w-full max-w-md glass-panel p-8 rounded-3xl text-center border border-white/10">
          <h2 className="text-3xl font-black text-white mb-2">Hoàn thành!</h2>
          <p className="text-slate-400 mb-8">Bạn đã trả lời đúng</p>
          
          <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-8 drop-shadow-[0_0_15px_rgba(0,240,255,0.3)]">
            {score} / {testWords.length}
          </div>

          {score === testWords.length ? (
            <p className="text-emerald-400 font-bold mb-8 flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" /> Hoàn hảo! Đã nhận thưởng.
            </p>
          ) : (
            <p className="text-amber-400 font-bold mb-8">
              Cần đạt 100% để nhận thưởng. Hãy thử lại!
            </p>
          )}

          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => setScreen(1)}
              className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 font-bold"
            >
              Chọn chủ đề khác
            </button>
            <button 
              onClick={startTest}
              className="px-6 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold"
            >
              Thử lại bài này
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
