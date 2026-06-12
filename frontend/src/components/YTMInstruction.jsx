import React, { useState } from 'react';
import { Copy, Check, ExternalLink, HelpCircle } from 'lucide-react';

export default function YTMInstruction({ exportData }) {
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);

  if (!exportData) return null;

  const copyToClipboard = (text, setCopied) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel p-6 border-l-4 border-blue-500 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2 text-blue-400">
        <HelpCircle size={20} />
        YouTube Music Upload Helper (上傳 YouTube Music 指南)
      </h3>

      <p className="text-xs text-gray-400 leading-relaxed">
        由於 YouTube Music 官方目前<strong>未提供</strong>公開的個人音樂庫上傳 API，本系統已為您生成標準的 MP3 音訊檔，並自動整理好 Metadata。請按照以下步驟完成上傳：
      </p>

      <div className="bg-gray-950/50 p-4 rounded-lg border border-gray-800 space-y-3">
        <div className="flex justify-between items-center border-b border-gray-800 pb-2">
          <span className="text-xs font-semibold text-gray-300">Recommended Title & Tags</span>
          <button
            onClick={() => copyToClipboard(exportData.ytm_title, setCopiedTitle)}
            className="btn btn-secondary py-1 px-2.5 text-xxs flex items-center gap-1.5"
          >
            {copiedTitle ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            {copiedTitle ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-sm font-medium text-purple-300">{exportData.ytm_title}</p>
        
        <div className="flex justify-between items-center border-b border-gray-800 pt-2 pb-2">
          <span className="text-xs font-semibold text-gray-300">Description / Tracklist (說明欄/曲目表)</span>
          <button
            onClick={() => copyToClipboard(exportData.ytm_description, setCopiedDesc)}
            className="btn btn-secondary py-1 px-2.5 text-xxs flex items-center gap-1.5"
          >
            {copiedDesc ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            {copiedDesc ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="text-xxs text-gray-400 bg-black/30 p-2.5 rounded overflow-x-auto max-h-40 whitespace-pre-wrap">
          {exportData.ytm_description}
        </pre>
      </div>

      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-semibold text-gray-200">How to Upload (如何手動上傳):</h4>
        <ol className="list-decimal pl-5 text-xs text-gray-400 space-y-2">
          <li>
            使用電腦瀏覽器打開{' '}
            <a
              href="https://music.youtube.com"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 inline-flex items-center gap-1 hover:underline"
            >
              YouTube Music 官網 <ExternalLink size={11} />
            </a>
          </li>
          <li>點選右上角的個人頭像 (Profile Picture)。</li>
          <li>從選單中選擇<strong>「上傳音樂」(Upload Music)</strong>。</li>
          <li>選擇下載好的 <strong>{exportData.mp3_name}</strong> 檔案。</li>
          <li>上傳完成後，您可以在<strong>「媒體庫」&gt;「歌曲」&gt;「上傳」</strong>分頁中找到該音訊。</li>
        </ol>
      </div>
    </div>
  );
}
