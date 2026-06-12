import React, { useState, useEffect } from 'react';
import { Headset, Sparkles, History, HelpCircle, Key, Info, RefreshCw, Trash2, FileAudio } from 'lucide-react';
import NewJobForm from './components/NewJobForm';
import JobDetails from './components/JobDetails';
import YTMInstruction from './components/YTMInstruction';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [jobs, setJobs] = useState(() => {
    const saved = localStorage.getItem('local_jobs');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedJobId, setSelectedJobId] = useState(null);
  
  // Backend URL configuration
  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem('backend_url') || 'http://localhost:8000');
  const [googleCreds, setGoogleCreds] = useState(() => localStorage.getItem('google_credentials') || '');
  const [elevenlabsKey, setElevenlabsKey] = useState(() => localStorage.getItem('elevenlabs_key') || '');
  const [showConfig, setShowConfig] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('local_jobs', JSON.stringify(jobs));
  }, [jobs]);

  // Set default selection
  useEffect(() => {
    if (jobs.length > 0 && !selectedJobId) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs]);

  // Polling loop for active jobs
  useEffect(() => {
    const activeJobs = jobs.filter(j => 
      ['ocr_processing', 'classifying', 'parsing', 'tts_generating', 'merging'].includes(j.status) ||
      (j.chapters && j.chapters.some(c => ['tts_generating', 'merging'].includes(c.status)))
    );

    if (activeJobs.length === 0) return;

    const interval = setInterval(async () => {
      for (const j of activeJobs) {
        try {
          const res = await fetch(`${backendUrl}/api/jobs/${j.id}`);
          if (res.ok) {
            const updatedJob = await res.json();
            setJobs(prev => prev.map(p => p.id === j.id ? updatedJob : p));
          }
        } catch (err) {
          console.error("Polling job status failed:", err);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs, backendUrl]);

  const updateJob = (jobId, fields) => {
    setJobs(prev => prev.map(j => {
      if (j.id === jobId) {
        return { ...j, ...fields, updated_at: new Date().toISOString() };
      }
      return j;
    }));
  };

  // One-Click Pipeline Orchestrator (呼叫 Render/Local FastAPI 後端)
  const handleGeneratePipeline = async (config) => {
    // Save configurations
    setBackendUrl(config.backendUrl);
    setGoogleCreds(config.googleCreds);
    setElevenlabsKey(config.elevenlabsKey);

    try {
      // 1. Create Job on backend
      const createFormData = new FormData();
      createFormData.append('source_type', config.sourceType);
      createFormData.append('en_voice', config.enVoice);
      createFormData.append('zh_voice', config.zhVoice);
      createFormData.append('speed', config.speed);
      createFormData.append('pause_ms', String(config.pauseMs));

      const createRes = await fetch(`${config.backendUrl}/api/jobs`, {
        method: 'POST',
        body: createFormData
      });

      if (!createRes.ok) {
        throw new Error(`Failed to initialize job on backend: Status ${createRes.status}`);
      }

      const newJob = await createRes.json();
      
      // Update jobs locally and select it
      setJobs(prev => [newJob, ...prev]);
      setSelectedJobId(newJob.id);

      // 2. Upload file or text to parser endpoint
      const uploadFormData = new FormData();
      if (config.sourceType === 'text') {
        uploadFormData.append('text_content', config.textContent);
      } else {
        uploadFormData.append('file', config.file);
      }

      const uploadRes = await fetch(`${config.backendUrl}/api/jobs/${newJob.id}/upload`, {
        method: 'POST',
        body: uploadFormData
      });

      if (!uploadRes.ok) {
        throw new Error(`Failed to upload file/text to backend: Status ${uploadRes.status}`);
      }

      const updatedJob = await uploadRes.json();
      setJobs(prev => prev.map(j => j.id === newJob.id ? updatedJob : j));

      // 3. For single text or image source, auto trigger TTS
      if (['text', 'image'].includes(config.sourceType)) {
        const ttsFormData = new FormData();
        ttsFormData.append('engine', config.ttsEngine);
        if (config.googleCreds) ttsFormData.append('google_credentials', config.googleCreds);
        if (config.elevenlabsKey) ttsFormData.append('elevenlabs_key', config.elevenlabsKey);

        const ttsRes = await fetch(`${config.backendUrl}/api/jobs/${newJob.id}/tts`, {
          method: 'POST',
          body: ttsFormData
        });

        if (ttsRes.ok) {
          const finalJob = await ttsRes.json();
          setJobs(prev => prev.map(j => j.id === newJob.id ? finalJob : j));
        }
      }

    } catch (err) {
      console.error(err);
      alert(`Pipeline initialization failed: ${err.message}`);
    }
  };

  // Trigger TTS for a specific chapter
  const handleChapterTTS = async (jobId, chapterId, params) => {
    try {
      const formData = new FormData();
      formData.append('engine', localStorage.getItem('google_credentials') || googleCreds ? 'google' : elevenlabsKey ? 'elevenlabs' : 'edge');
      formData.append('book_title', params.bookTitle);
      formData.append('author', params.author);
      formData.append('chapter_title', params.chapterTitle);
      formData.append('track_num', String(params.trackNum));
      
      if (googleCreds) formData.append('google_credentials', googleCreds);
      if (elevenlabsKey) formData.append('elevenlabs_key', elevenlabsKey);
      if (params.bgmFile) formData.append('bgm_file', params.bgmFile);
      if (params.coverFile) formData.append('cover_file', params.coverFile);

      // Optimistically set chapter generating status
      setJobs(prev => prev.map(j => {
        if (j.id === jobId && j.chapters) {
          return {
            ...j,
            chapters: j.chapters.map(c => c.id === chapterId ? { ...c, status: 'tts_generating' } : c)
          };
        }
        return j;
      }));

      const res = await fetch(`${backendUrl}/api/jobs/${jobId}/chapters/${chapterId}/tts`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Failed to start TTS for chapter: Status ${res.status}`);
      }

      const updatedJob = await res.json();
      setJobs(prev => prev.map(j => j.id === jobId ? updatedJob : j));

    } catch (err) {
      console.error(err);
      alert(`Failed to trigger chapter speech synthesis: ${err.message}`);
    }
  };

  const handleEdit = (jobId, payload) => {
    updateJob(jobId, payload);
  };

  const handleDeleteJob = async (jobId, e) => {
    e.stopPropagation();
    try {
      // Call backend to clean up storage
      await fetch(`${backendUrl}/api/jobs/${jobId}`, { method: 'DELETE' });
    } catch (_) {}
    
    setJobs(prev => prev.filter(j => j.id !== jobId));
    if (selectedJobId === jobId) {
      setSelectedJobId(null);
    }
  };

  const handleSaveKeys = (url, gCreds, elKey) => {
    setBackendUrl(url);
    localStorage.setItem('backend_url', url);
    setGoogleCreds(gCreds);
    localStorage.setItem('google_credentials', gCreds);
    setElevenlabsKey(elKey);
    localStorage.setItem('elevenlabs_key', elKey);
    setShowConfig(false);
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <div className="container">
      {/* Header */}
      <header className="header flex-wrap gap-4">
        <div className="header-title flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-xl shadow-lg">
            <Headset className="text-white" size={28} />
          </div>
          <div>
            <h1>English Audiobook Maker</h1>
            <p>Directly convert textbook files & text to YouTube Music albums</p>
          </div>
        </div>

        <button 
          onClick={() => setShowConfig(p => !p)} 
          className="btn btn-secondary flex items-center gap-2"
        >
          <Key size={16} />
          <span>Backend & Keys Configuration</span>
        </button>
      </header>

      {showConfig && (
        <div className="glass-panel p-5 mb-6 space-y-4 text-left animate-fadeIn border-purple-500/30">
          <div className="flex items-start gap-2">
            <Info size={16} className="text-purple-400 mt-0.5 shrink-0" />
            <div className="text-xs text-gray-400">
              <strong>Configuration Manager</strong>：Configure your backend endpoints and cloud API credentials securely. Credentials are saved locally on your browser.
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label text-xs">Python Backend URL</label>
              <input
                type="text"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                className="form-input text-xs"
                placeholder="e.g., http://localhost:8000"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label text-xs">ElevenLabs API Key</label>
              <input
                type="password"
                value={elevenlabsKey}
                onChange={(e) => setElevenlabsKey(e.target.value)}
                className="form-input text-xs"
                placeholder="ElevenLabs Key"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label text-xs">Google Cloud Service Account Credentials JSON</label>
            <textarea
              value={googleCreds}
              onChange={(e) => setGoogleCreds(e.target.value)}
              className="form-textarea h-24 text-xxs font-mono"
              placeholder='{"type": "service_account", "project_id": "..."}'
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button 
              onClick={() => handleSaveKeys(backendUrl, googleCreds, elevenlabsKey)} 
              className="btn btn-primary text-xs px-6"
            >
              Save Credentials
            </button>
          </div>
        </div>
      )}

      {/* Tabs navigation */}
      <nav className="tabs-nav">
        <button 
          onClick={() => setActiveTab('create')}
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
        >
          <Sparkles size={16} />
          <span>Create (製作有聲書)</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
        >
          <History size={16} />
          <span>History (歷史紀錄)</span>
        </button>
      </nav>

      {/* Main content sections based on Active Tab */}
      <main className="min-h-[500px]">
        {activeTab === 'create' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <NewJobForm 
                onSubmit={handleGeneratePipeline} 
                loading={selectedJob ? ['ocr_processing', 'classifying', 'parsing'].includes(selectedJob.status) : false} 
              />
            </div>
            
            <div className="md:col-span-2">
              <JobDetails
                job={selectedJob}
                onEdit={handleEdit}
                onChapterTTS={handleChapterTTS}
                backendUrl={backendUrl}
                googleCreds={googleCreds}
                elevenlabsKey={elevenlabsKey}
              />
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <h3 className="text-left text-base font-bold text-gray-300">Generated History (歷程庫)</h3>
            {jobs.length === 0 ? (
              <div className="glass-panel p-12 text-center text-gray-500">
                No audiobook generated yet. Go to Create tab to build your first one!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-3">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className={`p-4 rounded-lg border transition-all cursor-pointer flex justify-between items-center ${
                        selectedJobId === job.id
                          ? 'bg-purple-950/20 border-purple-500/50'
                          : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden text-left">
                        <FileAudio className="text-purple-400 shrink-0" size={20} />
                        <div className="overflow-hidden">
                          <p className="text-sm font-semibold truncate">
                            {job.original_filename || `Text Task (${job.id.substring(0, 6)})`}
                          </p>
                          <p className="text-xxs text-gray-500">
                            {new Date(job.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={(e) => handleDeleteJob(job.id, e)}
                        className="text-rose-500 hover:text-rose-400 p-1.5 rounded hover:bg-rose-500/10 shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="md:col-span-2">
                  <JobDetails
                    job={selectedJob}
                    onEdit={handleEdit}
                    onChapterTTS={handleChapterTTS}
                    backendUrl={backendUrl}
                    googleCreds={googleCreds}
                    elevenlabsKey={elevenlabsKey}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
