import React from 'react';
import { Home, Film, Folder, Clock3, LogOut, RefreshCw } from 'lucide-react';

export function MobileBottomNav({ activeTab, onTabChange, onSignOut, onRefresh, loading }) {
  return (
    <nav className="mobile-bottom-nav">
      <button 
        className={`mobile-nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => onTabChange('home')}
      >
        <Home size={20} />
        <span>Trang chủ</span>
      </button>

      <button 
        className={`mobile-nav-item ${activeTab === 'movies' ? 'active' : ''}`}
        onClick={() => onTabChange('movies')}
      >
        <Film size={20} />
        <span>Tất cả phim</span>
      </button>

      <button 
        className="mobile-nav-item"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw size={20} className={loading ? 'spin' : ''} />
        <span>Quét lại</span>
      </button>

      <button 
        className={`mobile-nav-item ${activeTab === 'history' ? 'active' : ''}`}
        onClick={() => onTabChange('history')}
      >
        <Clock3 size={20} />
        <span>Lịch sử</span>
      </button>

      <button 
        className="mobile-nav-item logout"
        onClick={onSignOut}
        title="Đăng xuất"
      >
        <LogOut size={20} />
        <span>Đăng xuất</span>
      </button>
    </nav>
  );
}
