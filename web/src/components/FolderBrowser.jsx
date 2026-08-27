import React from 'react';
import { Folder, ChevronRight, Home, Video } from 'lucide-react';

export function FolderBrowser({ folders, currentFolder, onSelectFolder, onGoHome }) {
  return (
    <div className="folder-browser-bar">
      <div className="breadcrumbs">
        <button 
          onClick={onGoHome} 
          className={`crumb-btn ${!currentFolder ? 'active' : ''}`}
        >
          <Home size={15} />
          <span>Tất cả phim</span>
        </button>

        {currentFolder && (
          <>
            <ChevronRight size={14} className="crumb-separator" />
            <span className="crumb-current">
              <Folder size={15} />
              <span>{currentFolder.name}</span>
            </span>
          </>
        )}
      </div>

      {folders && folders.length > 0 && (
        <div className="folder-pills-list">
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => onSelectFolder(f)}
              className="folder-pill"
            >
              <Folder size={14} />
              <span>{f.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
