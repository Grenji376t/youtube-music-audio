import React from 'react';
import { Play, FileAudio, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function JobList({ jobs, selectedId, onSelectJob }) {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'created':
        return <span className="badge badge-created">Created</span>;
      case 'ocr_processing':
      case 'classifying':
      case 'parsing':
      case 'tts_generating':
      case 'merging':
        return <span className="badge badge-processing">Processing</span>;
      case 'completed':
        return <span className="badge badge-completed">Done</span>;
      case 'failed':
        return <span className="badge badge-failed">Failed</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const getJobIcon = (job) => {
    if (job.status === 'completed') {
      return <FileAudio className="text-emerald-500" size={18} />;
    }
    if (job.status === 'failed') {
      return <AlertTriangle className="text-rose-500" size={18} />;
    }
    return <Play className="text-purple-500 animate-pulse" size={18} />;
  };

  return (
    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
      {jobs.length === 0 ? (
        <div className="text-center p-6 border border-dashed border-gray-800 rounded-md text-gray-500 text-xs">
          No tasks created yet.
        </div>
      ) : (
        jobs.map((job) => (
          <div
            key={job.id}
            onClick={() => onSelectJob(job.id)}
            className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
              selectedId === job.id
                ? 'bg-purple-950/20 border-purple-500/50 shadow-sm'
                : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              {getJobIcon(job)}
              <div className="text-left overflow-hidden">
                <p className="text-sm font-semibold truncate">
                  {job.source_type === 'image' && job.original_filename
                    ? job.original_filename
                    : `Text Task (${job.id.substring(0, 8)})`}
                </p>
                <p className="text-xxs text-gray-500">
                  {new Date(job.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div>{getStatusBadge(job.status)}</div>
          </div>
        ))
      )}
    </div>
  );
}
