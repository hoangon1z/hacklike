import React from 'react';
import { Play } from 'lucide-react';

export function HelpVideoCard({ videoUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ' }: { videoUrl?: string }) {
  return (
    <div className="smm-card smm-side-card">
      <div className="smm-side-card-header">
        <div className="smm-side-card-title">
          <span className="smm-icon-circle blue">
            <Play size={14} fill="currentColor" />
          </span>
          <b>Video hướng dẫn</b>
        </div>
        <a
          href="https://www.youtube.com"
          target="_blank"
          rel="noopener noreferrer"
          className="smm-yt-badge"
        >
          <span className="smm-yt-play">▶</span>
          <span>Xem trên YouTube</span>
        </a>
      </div>
      <div className="smm-video-body">
        <div className="smm-video-ratio">
          <iframe
            src={videoUrl}
            title="Video hướng dẫn tạo đơn"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
