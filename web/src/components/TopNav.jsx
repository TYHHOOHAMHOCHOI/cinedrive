import React from 'react';
import { Search, Bell, RefreshCw, LogIn } from 'lucide-react';

export function TopNav({ userProfile, onSignIn, onRefresh, loading, searchQuery, onSearchChange }) {
  return (
    <header className="top-nav">
      {/* Search */}
      <div className="search-box">
        <Search />
        <input
          id="search-input"
          type="text"
          placeholder="Tìm kiếm phim, định dạng .mp4, .mkv..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          aria-label="Tìm kiếm phim"
        />
        <span className="search-kbd">/</span>
      </div>

      {/* Actions */}
      <div className="nav-actions">
        {userProfile ? (
          <>
            <button
              className="icon-btn"
              onClick={onRefresh}
              disabled={loading}
              title="Làm mới kho phim"
              aria-label="Refresh"
            >
              <RefreshCw className={loading ? 'spin' : ''} />
            </button>

            {userProfile.picture ? (
              <img
                src={userProfile.picture}
                alt={userProfile.name}
                className="nav-avatar"
                title={userProfile.name}
              />
            ) : (
              <div className="nav-avatar" style={{ background:'#374151', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:15 }}>
                {userProfile.name?.[0]}
              </div>
            )}
          </>
        ) : (
          <button id="btn-google-signin" className="btn-signin" onClick={onSignIn}>
            <LogIn size={17} />
            <span>Kết nối Google Drive</span>
          </button>
        )}
      </div>
    </header>
  );
}
