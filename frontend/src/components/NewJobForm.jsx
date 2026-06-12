import React, { useState, useEffect } from 'react';
import { 
  Sparkles, FileText, Image as ImageIcon, Book, ChevronDown, ChevronUp, Settings2, Link as LinkIcon, Key
} from 'lucide-react';

export default function NewJobForm({ onSubmit, loading }) {
  const [sourceType, setSourceType] = useState('text');
  const [textContent, setTextContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [bookFile, setBookFile] = useState(null);
  
  // Settings
  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem('backend_url') || 'http://localhost:8000');
  const [ttsEngine, setTtsEngine] = useState('edge');
  const [enVoice, setEnVoice] = useState('en-US-GuyNeural');
  const [zhVoice, setZhVoice] = useState('zh-TW-HsiaoChenNeural');
  const [speed, setSpeed] = useState('+0%');
  const [pauseMs, setPauseMs] = useState(1500);
  const [showSettings, setShowSettings] = useState(false);

  // API Keys
  const [googleCreds, setGoogleCreds] = useState(() => localStorage.getItem('google_credentials') || '');
  const [elevenlabsKey, setElevenlabsKey] = useState(() => localStorage.getItem('elevenlabs_key') || '');

  // Sync settings to localStorage
  useEffect(() => {
    localStorage.setItem('backend_url', backendUrl);
  }, [backendUrl]);

  useEffect(() => {
    localStorage.setItem('google_credentials', googleCreds);
  }, [googleCreds]);

  useEffect(() => {
    localStorage.setItem('elevenlabs_key', elevenlabsKey);
  }, [elevenlabsKey]);

  // Adjust default voices based on TTS engine selection
  useEffect(() => {
    if (ttsEngine === 'google') {
      setEnVoice('en-US-Journey-F');
      setZhVoice('zh-TW-Wavenet-A');
    } else if (ttsEngine === 'elevenlabs') {
      setEnVoice('21m00Tcm4TlvDq8ikWAM'); // Rachel voice id
      setZhVoice('21m00Tcm4TlvDq8ikWAM'); 
    } else {
      setEnVoice('en-US-GuyNeural');
      setZhVoice('zh-TW-HsiaoChenNeural');
    }
  }, [ttsEngine]);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleBookChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setBookFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validations
    if (sourceType === 'text' && !textContent.trim()) return;
    if (sourceType === 'image' && !imageFile) return;
    if (sourceType === 'book' && !bookFile) return;

    let targetFile = null;
    let targetType = sourceType;
    if (sourceType === 'image') {
      targetFile = imageFile;
    } else if (sourceType === 'book') {
      targetFile = bookFile;
      targetType = bookFile.name.toLowerCase().endsWith('.epub') ? 'epub' : 'txt_file';
    }

    onSubmit({
      sourceType: targetType,
      textContent: sourceType === 'text' ? textContent : null,
      file: targetFile,
      backendUrl,
      ttsEngine,
      enVoice,
      zhVoice,
      speed,
      pauseMs,
      googleCreds,
      elevenlabsKey
    });
  };

  return (
    <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold flex items-center gap-2 text-purple-400">
          <Sparkles size={20} />
          Create Audiobook (製作英文有聲書)
        </h3>
      </div>

      {/* Backend Connection Config */}
      <div className="form-group bg-black/10 border border-gray-900 rounded-lg p-3 space-y-2">
        <label className="form-label font-semibold flex items-center gap-1.5 text-xs text-gray-300">
          <LinkIcon size={12} className="text-purple-400" />
          Render / Local Python Backend URL
        </label>
        <input
          type="text"
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.target.value)}
          className="form-input text-xs"
          placeholder="e.g. http://localhost:8000 or your-render-url.onrender.com"
        />
      </div>

      {/* Input Source Toggle */}
      <div className="grid grid-cols-3 gap-2 bg-black/20 p-1 rounded-lg border border-gray-950">
        <button
          type="button"
          onClick={() => setSourceType('text')}
          className={`py-2 text-xxs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
            sourceType === 'text' 
              ? 'bg-purple-600 text-white shadow-sm' 
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <FileText size={12} />
          Text (輸入)
        </button>
        <button
          type="button"
          onClick={() => setSourceType('image')}
          className={`py-2 text-xxs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
            sourceType === 'image' 
              ? 'bg-purple-600 text-white shadow-sm' 
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <ImageIcon size={12} />
          Image (拍照)
        </button>
        <button
          type="button"
          onClick={() => setSourceType('book')}
          className={`py-2 text-xxs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
            sourceType === 'book' 
              ? 'bg-purple-600 text-white shadow-sm' 
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Book size={12} />
          Ebook (書籍)
        </button>
      </div>

      {/* Input fields */}
      {sourceType === 'text' && (
        <div className="form-group">
          <label className="form-label font-semibold text-xs">Paste English Text & Translations (貼上英文與中文對照內容)</label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            className="form-textarea h-40 text-xs"
            placeholder="例如：
1. Apple 蘋果
2. Banana 香蕉

或是課文：
Today is a nice day.
今天天氣很好。"
          />
        </div>
      )}

      {sourceType === 'image' && (
        <div className="space-y-3">
          <label className="form-label font-semibold text-xs">Upload Photo (上傳單字或課文照片)</label>
          <div className="upload-box relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-2">
              <ImageIcon size={32} className="text-gray-500" />
              <span className="text-xs text-purple-400 font-semibold hover:underline">
                {imageFile ? 'Change Photo (換張照片)' : 'Choose Photo (選取照片)'}
              </span>
              <span className="text-xxs text-gray-500">Supports PNG, JPG, JPEG</span>
            </div>
          </div>
          {imageFile && (
            <div className="bg-emerald-950/20 border border-emerald-500/20 p-2 rounded text-xs text-center text-emerald-400 font-medium">
              Selected Image: {imageFile.name}
            </div>
          )}
        </div>
      )}

      {sourceType === 'book' && (
        <div className="space-y-3">
          <label className="form-label font-semibold text-xs">Upload Book File (上傳書籍 TXT 或 EPUB 檔案)</label>
          <div className="upload-box relative">
            <input
              type="file"
              accept=".epub,.txt"
              onChange={handleBookChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-2">
              <Book size={32} className="text-gray-500" />
              <span className="text-xs text-purple-400 font-semibold hover:underline">
                {bookFile ? 'Change Ebook (更換書籍)' : 'Select TXT or EPUB (選取電子書或文字檔)'}
              </span>
              <span className="text-xxs text-gray-500">Supports .epub, .txt</span>
            </div>
          </div>
          {bookFile && (
            <div className="bg-emerald-950/20 border border-emerald-500/20 p-2 rounded text-xs text-center text-emerald-400 font-medium">
              Selected File: {bookFile.name}
            </div>
          )}
        </div>
      )}

      {/* Advanced Speech Settings */}
      <div className="space-y-2">
        <div 
          onClick={() => setShowSettings(!showSettings)}
          className="settings-header flex items-center justify-between cursor-pointer"
        >
          <span className="text-xs font-semibold text-gray-300 flex items-center gap-2">
            <Settings2 size={14} className="text-gray-400" />
            TTS Engine & Audio Settings (音軌發音與引擎設定)
          </span>
          {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>

        {showSettings && (
          <div className="bg-black/10 border border-gray-900 rounded-lg p-4 space-y-4 animate-fadeIn">
            
            {/* Engine Selection */}
            <div className="form-group">
              <label className="form-label text-xs">TTS Engine (語音生成核心)</label>
              <select
                value={ttsEngine}
                onChange={(e) => setTtsEngine(e.target.value)}
                className="form-select text-xs"
              >
                <option value="edge">Edge TTS (Free / 免金鑰)</option>
                <option value="google">Google Cloud TTS (Journey 擬真模型)</option>
                <option value="elevenlabs">ElevenLabs API (頂級情感表達)</option>
              </select>
            </div>

            {/* API Keys based on engine selection */}
            {ttsEngine === 'google' && (
              <div className="form-group space-y-1">
                <label className="form-label text-xs flex items-center gap-1">
                  <Key size={12} className="text-purple-400" />
                  Google Cloud Credentials JSON
                </label>
                <textarea
                  value={googleCreds}
                  onChange={(e) => setGoogleCreds(e.target.value)}
                  className="form-textarea h-20 text-xxs font-mono"
                  placeholder='{"type": "service_account", "project_id": ...}'
                />
              </div>
            )}

            {ttsEngine === 'elevenlabs' && (
              <div className="form-group space-y-1">
                <label className="form-label text-xs flex items-center gap-1">
                  <Key size={12} className="text-purple-400" />
                  ElevenLabs API Key
                </label>
                <input
                  type="password"
                  value={elevenlabsKey}
                  onChange={(e) => setElevenlabsKey(e.target.value)}
                  className="form-input text-xs"
                  placeholder="Enter ElevenLabs API Key"
                />
              </div>
            )}

            {/* Voice select inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label text-xs">English Voice</label>
                {ttsEngine === 'edge' && (
                  <select value={enVoice} onChange={(e) => setEnVoice(e.target.value)} className="form-select text-xs">
                    <option value="en-US-GuyNeural">US Accent (Guy)</option>
                    <option value="en-US-JennyNeural">US Accent (Jenny)</option>
                    <option value="en-GB-SoniaNeural">UK Accent (Sonia)</option>
                  </select>
                )}
                {ttsEngine === 'google' && (
                  <select value={enVoice} onChange={(e) => setEnVoice(e.target.value)} className="form-select text-xs">
                    <option value="en-US-Journey-F">Journey Female (擬真)</option>
                    <option value="en-US-Journey-D">Journey Male (擬真)</option>
                    <option value="en-US-Wavenet-F">Wavenet Female</option>
                  </select>
                )}
                {ttsEngine === 'elevenlabs' && (
                  <input
                    type="text"
                    value={enVoice}
                    onChange={(e) => setEnVoice(e.target.value)}
                    className="form-input text-xs"
                    placeholder="ElevenLabs Voice ID"
                  />
                )}
              </div>

              <div className="form-group">
                <label className="form-label text-xs">Chinese Voice</label>
                {ttsEngine === 'edge' && (
                  <select value={zhVoice} onChange={(e) => setZhVoice(e.target.value)} className="form-select text-xs">
                    <option value="zh-TW-HsiaoChenNeural">HsiaoChen (Taiwan)</option>
                    <option value="zh-TW-YunJheNeural">YunJhe (Taiwan)</option>
                  </select>
                )}
                {ttsEngine === 'google' && (
                  <select value={zhVoice} onChange={(e) => setZhVoice(e.target.value)} className="form-select text-xs">
                    <option value="zh-TW-Wavenet-A">Wavenet Female (TW)</option>
                    <option value="zh-TW-Wavenet-B">Wavenet Male (TW)</option>
                  </select>
                )}
                {ttsEngine === 'elevenlabs' && (
                  <input
                    type="text"
                    value={zhVoice}
                    onChange={(e) => setZhVoice(e.target.value)}
                    className="form-input text-xs"
                    placeholder="ElevenLabs Voice ID"
                  />
                )}
              </div>
            </div>

            {/* Speed & Pause */}
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label text-xs">Speech Speed (語速)</label>
                <select value={speed} onChange={(e) => setSpeed(e.target.value)} className="form-select text-xs">
                  <option value="-15%">Slow (-15%)</option>
                  <option value="+0%">Normal (正常)</option>
                  <option value="+10%">Fast (+10%)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label text-xs">Pause Delay (停頓間隔)</label>
                <select value={pauseMs} onChange={(e) => setPauseMs(parseInt(e.target.value))} className="form-select text-xs">
                  <option value="1000">1.0s</option>
                  <option value="1500">1.5s</option>
                  <option value="2000">2.0s</option>
                  <option value="2500">2.5s</option>
                </select>
              </div>
            </div>

          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
      >
        <Sparkles size={16} />
        {loading ? 'Processing File / Textbook (正在上傳處理中)...' : 'Start Task / Load Ebook (載入書籍與單字)'}
      </button>
    </form>
  );
}
