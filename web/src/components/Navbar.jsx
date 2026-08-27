import React from 'react';
import { Clapperboard, LogIn, LogOut, Search, User, HardDrive, RefreshCw } from 'lucide-react';

export function Navbar({ 
  userProfile, 
  onSignIn, 
  onSignOut, 
  searchQuery, 
  onSearchChange,
  onRefresh,
  loading
}) {
  return (
    <header className="navbar-container">
      <div className="navbar-content">
        {/* Logo */}
        <div className="logo-badge">
          <div className="logo-icon-wrapper">
            <Clapperboard className="logo-icon" />
          </div>
          <div>
            <h1 className="app-title">CineDrive</h1>
            <span className="app-subtitle">5TB Personal Cloud Streamer</span>
          </div>
        </div>

        {/* Search */}
        <div className="search-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm phim, tập, định dạng .mp4, .mkv..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Actions */}
        <div className="navbar-actions">
          {userProfile ? (
            <div className="user-profile-menu">
              <button 
                onClick={onRefresh} 
                className="action-btn icon-only" 
                title="Làm mới danh sách"
                disabled={loading}
              >
                <RefreshCw size={18} className={loading ? 'spin' : ''} />
              </button>

              <div className="user-info-card">
                {userProfile.picture ? (
                  <img 
                    src={userProfile.picture} 
                    alt={userProfile.name} 
                    className="user-avatar"
                  />
                ) : (
                  <div className="user-avatar-placeholder">
                    <User size={18} />
                  </div>
                )}
                <div className="user-details">
                  <span className="user-name">{userProfile.name}</span>
                  <span className="user-email">{userProfile.email}</span>
                </div>
              </div>

              <button 
                onClick={onSignOut} 
                className="action-btn logout-btn"
                title="Đăng xuất"
              >
                <LogOut size={16} />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            <button onClick={onSignIn} className="action-btn login-btn">
              <LogIn size={18} />
              <span>Đăng nhập Google Drive</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
