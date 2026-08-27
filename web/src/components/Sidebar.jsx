import React from 'react';
import { Clapperboard, Home, Film, History, Settings, Folder, HardDrive, LogOut } from 'lucide-react';

const NAV_ITEMS = [
  { icon: Home,    label: 'Trang chủ',   id: 'home' },
  { icon: Film,    label: 'Tất cả phim', id: 'movies' },
  { icon: Folder,  label: 'Thư mục',     id: 'folders' },
  { icon: History, label: 'Lịch sử xem', id: 'history' },
  { icon: Settings,label: 'Cài đặt',     id: 'settings' },
];

export function Sidebar({ activeTab, onTabChange, userProfile, onSignOut, storageUsed = 0, storageTotal = 5 }) {
  const pct = Math.min((storageUsed / storageTotal) * 100, 100).toFixed(1);

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Clapperboard />
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-name">CineDrive</span>
          <span className="sidebar-logo-sub">Personal 5TB Streamer</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <span className="nav-section-label">Menu</span>
        {NAV_ITEMS.map(({ icon: Icon, label, id }) => (
          <button
            key={id}
            className={`nav-item ${activeTab === id ? 'active' : ''}`}
            onClick={() => onTabChange(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Storage Indicator */}
      <div className="sidebar-storage">
        <div className="storage-label">
          <span><HardDrive size={12} style={{ display:'inline', verticalAlign:'middle', marginRight:4 }} />Dung lượng Drive</span>
          <span style={{ color: 'var(--text-h)', fontWeight: 700 }}>{pct}%</span>
        </div>
        <div className="storage-bar-bg">
          <div className="storage-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="storage-val">
          <strong>{storageUsed.toFixed(1)} TB</strong> / {storageTotal} TB sử dụng
        </div>
      </div>

      {/* User + Sign Out */}
      {userProfile && (
        <div style={{ padding: '16px 12px 0', borderTop: '1px solid var(--border)', marginTop: 16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            {userProfile.picture
              ? <img src={userProfile.picture} alt={userProfile.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border-active)' }} />
              : <div style={{ width:32, height:32, borderRadius:'50%', background:'#374151', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ fontSize:14, fontWeight:700 }}>{userProfile.name?.[0]}</span></div>
            }
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{userProfile.name}</div>
              <div style={{ fontSize:10.5, color:'var(--text-p)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{userProfile.email}</div>
            </div>
          </div>
          <button className="nav-item" onClick={onSignOut} style={{ color:'#ef4444', width:'100%' }}>
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      )}
    </aside>
  );
}
