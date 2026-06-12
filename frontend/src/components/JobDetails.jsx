import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Play, Save, Trash2, Plus, Volume2, 
  AlertCircle, Download, Check, Settings, Eye, EyeOff, Music, Image as ImageIcon, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import YTMInstruction from './YTMInstruction';

export default function JobDetails({ 
  job, onEdit, onChapterTTS, backendUrl, googleCreds, elevenlabsKey
}) {
  const [activeChapterId, setActiveChapterId] = useState(null);
  
  // Chapter custom fields
  const [chapBookTitle, setChapBookTitle] = useState('');
  const [chapAuthor, setChapAuthor] = useState('');
  const [chapTitle, setChapTitle] = useState('');
  const [chapTrackNum, setChapTrackNum] = useState(1);
  const [chapContent, setChapContent] = useState('');
  
  // Chapter files
  const [bgmFile, setBgmFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [bgmFileUrl, setBgmFileUrl] = useState('');
  const [coverFileUrl, setCoverFileUrl] = useState('');

  // Refs for files
  const bgmInputRef = useRef(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    if (job) {
      if (job.chapters && job.chapters.length > 0 && !activeChapterId) {
        setActiveChapterId(job.chapters[0].id);
      }
    }
  }, [job, activeChapterId]);

  // Sync state when active chapter changes
  useEffect(() => {
    if (job && job.chapters) {
      const activeChap = job.chapters.find(c => c.id === activeChapterId);
      if (activeChap) {
        setChapBookTitle(job.original_filename ? job.original_filename.replace(/\.[^/.]+$/, "") : "Audiobook");
        setChapAuthor("English Learning");
        setChapTitle(activeChap.title || "");
        const index = job.chapters.findIndex(c => c.id === activeChapterId);
        setChapTrackNum(index >= 0 ? index + 1 : 1);
        setChapContent(activeChap.content || "");
        
        // Reset files
        setBgmFile(null);
        setCoverFile(null);
        setBgmFileUrl('');
        setCoverFileUrl('');
        if (bgmInputRef.current) bgmInputRef.current.value = "";
        if (coverInputRef.current) coverInputRef.current.value = "";
      }
    }
  }, [activeChapterId, job]);

  if (!job) {
    return (
      <div className="glass-panel p-8 text-center text-gray-500 h-full min-h-[400px] flex flex-col justify-center items-center gap-4">
        <FileText size={48} className="text-gray-700" />
        <div>
          <p className="text-base font-semibold text-gray-300">Select or Create a Task</p>
          <p className="text-xs text-gray-600">Choose a task to preview or configure.</p>
        </div>
      </div>
    );
  }

  const handleBgmChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setBgmFile(e.target.files[0]);
      setBgmFileUrl(e.target.files[0].name);
    }
  };

  const handleCoverChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setCoverFile(e.target.files[0]);
      setCoverFileUrl(e.target.files[0].name);
    }
  };

  const triggerChapterTTS = (chapterId) => {
    const activeChap = job.chapters.find(c => c.id === chapterId);
    if (!activeChap) return;

    onChapterTTS(job.id, chapterId, {
      bookTitle: chapBookTitle,
      author: chapAuthor,
      chapterTitle: chapTitle,
      trackNum: chapTrackNum,
      content: chapContent,
      bgmFile,
      coverFile
    });
  };

  // Chapter flow layout
  if (job.chapters && job.chapters.length > 0) {
    const activeChap = job.chapters.find(c => c.id === activeChapterId);
    
    return (
      <div className="space-y-6 text-left">
        <div className="glass-panel p-4">
          <h3 className="text-sm font-bold text-purple-400">Ebook: {job.original_filename}</h3>
          <p className="text-xxs text-gray-500 mt-1">Total Chapters: {job.chapters.length}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chapters List */}
          <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            <span className="text-xxs font-bold text-gray-500 block mb-1">CHAPTERS (章節清單)</span>
            {job.chapters.map((chap, idx) => {
              const isActive = chap.id === activeChapterId;
              return (
                <div
                  key={chap.id}
                  onClick={() => setActiveChapterId(chap.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 ${
                    isActive 
                      ? 'bg-purple-950/25 border-purple-500/50' 
                      : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-300 truncate max-w-[80%]">
                      {idx + 1}. {chap.title}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                      chap.status === 'completed' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' :
                      chap.status === 'failed' ? 'bg-rose-950/40 text-rose-400 border border-rose-500/20' :
                      ['tts_generating', 'merging'].includes(chap.status) ? 'bg-purple-900/40 text-purple-300 border border-purple-500/20 animate-pulse' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {chap.status === 'completed' ? 'Ready' :
                       chap.status === 'failed' ? 'Failed' :
                       ['tts_generating', 'merging'].includes(chap.status) ? 'Generating' : 'Pending'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 truncate">
                    {chap.content.substring(0, 45)}...
                  </span>
                </div>
              );
            })}
          </div>

          {/* Active Chapter Details & TTS Config */}
          {activeChap && (
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-panel p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-gray-900 pb-3">
                  <h4 className="text-sm font-bold text-purple-400">Chapter Setup & Tagging</h4>
                  <span className="text-xxs text-gray-500">ID: {activeChap.id.substring(0, 8)}</span>
                </div>

                {/* Status Indicator */}
                {activeChap.status === 'failed' && (
                  <div className="bg-rose-950/20 border border-rose-500/30 p-3 rounded text-xxs text-rose-300 flex gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <strong>Synthesis failed:</strong> {activeChap.error_message}
                    </div>
                  </div>
                )}

                {/* Edit Content */}
                <div className="form-group space-y-1">
                  <label className="form-label text-xxs font-semibold text-gray-400">Chapter Text Content (內容預覽與編輯)</label>
                  <textarea
                    value={chapContent}
                    onChange={(e) => setChapContent(e.target.value)}
                    className="form-textarea h-36 text-xxs"
                  />
                </div>

                {/* Metadata Settings */}
                <div className="bg-black/20 p-3 rounded-lg border border-gray-950 space-y-3">
                  <span className="text-xxs font-bold text-gray-400 block border-b border-gray-900 pb-1">
                    ID3 Music Metadata Tagging (寫入 MP3 資訊，上傳 YouTube Music 後能完美分類)
                  </span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="form-label text-xxs">Book Album Title (專輯名稱)</label>
                      <input
                        type="text"
                        value={chapBookTitle}
                        onChange={(e) => setChapBookTitle(e.target.value)}
                        className="form-input text-xs"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label text-xxs">Author Artist (演出者/歌手)</label>
                      <input
                        type="text"
                        value={chapAuthor}
                        onChange={(e) => setChapAuthor(e.target.value)}
                        className="form-input text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="form-group col-span-2">
                      <label className="form-label text-xxs">Track Title (音軌標題)</label>
                      <input
                        type="text"
                        value={chapTitle}
                        onChange={(e) => setChapTitle(e.target.value)}
                        className="form-input text-xs"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label text-xxs">Track Number (音軌編號)</label>
                      <input
                        type="number"
                        value={chapTrackNum}
                        onChange={(e) => setChapTrackNum(parseInt(e.target.value) || 1)}
                        className="form-input text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Media assets upload (BGM + Cover) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="form-label text-xxs font-semibold text-gray-400 flex items-center gap-1">
                      <Music size={12} className="text-purple-400" />
                      Chapter BGM (輕音樂背景音)
                    </label>
                    <button
                      type="button"
                      onClick={() => bgmInputRef.current.click()}
                      className="w-full py-2 bg-gray-900/40 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded text-xxs font-semibold text-purple-400 flex items-center justify-center gap-1.5"
                    >
                      <Download size={12} />
                      {bgmFile ? 'BGM Loaded' : 'Select Audio'}
                    </button>
                    <input
                      type="file"
                      ref={bgmInputRef}
                      accept="audio/*"
                      onChange={handleBgmChange}
                      className="hidden"
                    />
                    {bgmFileUrl && (
                      <span className="text-[9px] text-gray-500 block truncate text-center mt-1">{bgmFileUrl}</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="form-label text-xxs font-semibold text-gray-400 flex items-center gap-1">
                      <ImageIcon size={12} className="text-purple-400" />
                      Album Cover Art (書本封面圖)
                    </label>
                    <button
                      type="button"
                      onClick={() => coverInputRef.current.click()}
                      className="w-full py-2 bg-gray-900/40 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded text-xxs font-semibold text-purple-400 flex items-center justify-center gap-1.5"
                    >
                      <Download size={12} />
                      {coverFile ? 'Cover Loaded' : 'Select Image'}
                    </button>
                    <input
                      type="file"
                      ref={coverInputRef}
                      accept="image/*"
                      onChange={handleCoverChange}
                      className="hidden"
                    />
                    {coverFileUrl && (
                      <span className="text-[9px] text-gray-500 block truncate text-center mt-1">{coverFileUrl}</span>
                    )}
                  </div>
                </div>

                {/* Generator Button */}
                <button
                  onClick={() => triggerChapterTTS(activeChap.id)}
                  disabled={['tts_generating', 'merging'].includes(activeChap.status)}
                  className="btn btn-primary w-full py-2 text-xs flex items-center justify-center gap-2"
                >
                  <Volume2 size={14} />
                  {['tts_generating', 'merging'].includes(activeChap.status) 
                    ? 'Synthesizing audiobook on Render server (正在遠端轉檔處理中)...' 
                    : 'Generate Audiobook Chapter MP3 (轉換成此章節 MP3)'}
                </button>

                {/* Completed Download & Player */}
                {activeChap.status === 'completed' && activeChap.output_mp3_path && (
                  <div className="border-t border-gray-950 pt-4 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-lg gap-2">
                      <div className="text-left">
                        <span className="text-[9px] text-emerald-400 font-bold block mb-0.5">MP3 GENERATED SUCCESSFULLY</span>
                        <span className="text-xs font-semibold text-gray-300">{activeChap.title}.mp3</span>
                      </div>
                      <a
                        href={`${backendUrl}/api/jobs/${job.id}/chapters/${activeChap.id}/download-mp3`}
                        className="btn btn-primary bg-emerald-600 hover:bg-emerald-500 text-white border-none text-xxs py-1.5 px-4 flex items-center gap-1.5"
                      >
                        <Download size={12} /> Download Tagged MP3
                      </a>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-xxs text-gray-500 block">Listen to output track (試聽音訊)</span>
                      <audio
                        src={`${backendUrl}/api/jobs/${job.id}/chapters/${activeChap.id}/download-mp3`}
                        controls
                        className="w-full bg-transparent"
                      />
                    </div>

                    {/* Instruction integration */}
                    <YTMInstruction exportData={{
                      mp3_name: `${activeChap.title}.mp3`,
                      ytm_title: `${chapBookTitle} - ${chapTitle}`,
                      ytm_description: `Track: ${chapTrackNum}\nBook Album: ${chapBookTitle}\nArtist/Author: ${chapAuthor}\nGenerated by English Audiobook Maker`
                    }} />
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback for single raw text blocks or image OCR results
  const isProcessing = ['ocr_processing', 'classifying', 'parsing', 'tts_generating', 'merging'].includes(job.status);
  return (
    <div className="space-y-6 text-left">
      {isProcessing && (
        <div className="glass-panel p-6 flex flex-col items-center justify-center gap-4 text-center">
          <div className="loader-ring"></div>
          <div>
            <h3 className="text-base font-bold text-purple-300">Processing on Render...</h3>
            <p className="text-xs text-gray-500 mt-1">Generating Speech & Merging audio segments. Please wait.</p>
          </div>
        </div>
      )}

      {job.status === 'failed' && (
        <div className="bg-rose-950/20 border border-rose-500/30 p-6 rounded-lg space-y-3">
          <div className="flex items-center gap-3 text-rose-400">
            <AlertCircle size={24} />
            <h4 className="font-bold text-sm">Failed to generate audiobook</h4>
          </div>
          <p className="text-xs text-rose-300 pl-9">{job.error_message}</p>
        </div>
      )}

      {job.status === 'completed' && job.output_mp3_path && (
        <div className="glass-panel p-6 space-y-4">
          <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
            <Check size={20} />
            Audiobook Generated Successfully!
          </h3>
          <div className="flex justify-between items-center bg-gray-950/40 p-4 rounded border border-gray-800">
            <div>
              <span className="text-xxs text-gray-500 block">AUDIO FILE</span>
              <span className="text-xs font-semibold text-gray-200">audiobook_{job.id.substring(0, 8)}.mp3</span>
            </div>
            <a
              href={`${backendUrl}/api/jobs/${job.id}/download-mp3`}
              className="btn btn-primary flex items-center gap-2"
            >
              <Download size={16} /> Download MP3
            </a>
          </div>
          <div className="space-y-1.5">
            <span className="text-xxs text-gray-500">Audio Preview</span>
            <audio src={`${backendUrl}/api/jobs/${job.id}/download-mp3`} controls className="w-full bg-transparent" />
          </div>
        </div>
      )}
    </div>
  );
}
