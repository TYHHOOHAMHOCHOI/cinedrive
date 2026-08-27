import React, { useState, useRef, useEffect } from 'react';
import { Search, RefreshCw, LogIn, LogOut, User, FolderSearch } from 'lucide-react';

export function TopNav({ userProfile, onSignIn, onSignOut, onRefresh, onScanAll, loading, searchQuery, onSearchChange }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="top-nav">
      {/* Search */}
      <div className="search-box">
        <Search />
        <input
          id="search-input"
          type="text"
          placeholder="Tìm kiếm phim (.mp4, .mkv)..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          aria-label="Tìm kiếm phim"
        />
        <span className="search-kbd">/</span>
      </div>

      {/* Actions */}
      <div className="nav-actions" ref={menuRef} style={{ position: 'relative' }}>
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

            <div style={{ position: 'relative' }}>
              <div 
                onClick={() => setShowMenu(!showMenu)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                title="Tài khoản Google Drive"
              >
                {userProfile.picture ? (
                  <img
                    src={userProfile.picture}
                    alt={userProfile.name}
                    className="nav-avatar"
                  />
                ) : (
                  <div className="nav-avatar" style={{ background:'#374151', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:15 }}>
                    {userProfile.name?.[0]}
                  </div>
                )}
              </div>

              {/* User Profile Dropdown Menu */}
              {showMenu && (
                <div 
                  className="user-dropdown-menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    width: 260,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    padding: 14,
                    boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                    zIndex: 100,
                    animation: 'fadeUp 0.2s ease-out'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
                    {userProfile.picture ? (
                      <img src={userProfile.picture} alt={userProfile.name} style={{ width: 36, height: 36, borderRadius: '50%' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={18} color="var(--primary)" />
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userProfile.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-p)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userProfile.email}</div>
                    </div>
                  </div>

                  {onScanAll && (
                    <button
                      onClick={() => { setShowMenu(false); onScanAll(); }}
                      className="dropdown-item-btn"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '9px 12px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-h)',
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 6,
                        cursor: 'pointer',
                        textAlign: 'left',
                        marginBottom: 4
                      }}
                    >
                      <FolderSearch size={16} color="var(--cyan)" />
                      <span>Quét toàn bộ Google Drive</span>
                    </button>
                  )}

                  <button
                    onClick={() => { setShowMenu(false); onSignOut(); }}
                    className="dropdown-item-btn logout-btn"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      fontSize: 13,
                      fontWeight: 700,
                      borderRadius: 6,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <LogOut size={16} />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
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
