import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './index.css';

import { Sidebar }      from './components/Sidebar';
import { TopNav }       from './components/TopNav';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MovieCard, ContinueCard } from './components/MovieCard';
import { VideoPlayer }  from './components/VideoPlayer';

import { GoogleAuthService } from './services/googleAuth';
import { DriveApiService }   from './services/driveApi';
import { HistoryService }    from './services/historyService';

import { Film, Zap, FileText, Clock3, KeyRound, FolderSync, ChevronRight, Home, Folder } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function App() {
  /* ---- Auth State ---- */
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('cinedrive_access_token'));
  const [userProfile, setUserProfile]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('cinedrive_user_profile') || 'null'); } catch { return null; }
  });

  /* ---- Library State ---- */
  const [videos,        setVideos]        = useState([]);
  const [folders,       setFolders]       = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [activeTab,     setActiveTab]     = useState('home');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [watchHistory,  setWatchHistory]  = useState(() => HistoryService.getHistory());

  /* ---- Services ---- */
  const authService = useMemo(() => new GoogleAuthService(
    GOOGLE_CLIENT_ID,
    (token, profile) => { setAccessToken(token); setUserProfile(profile); },
    console.error
  ), []);

  const driveApi = useMemo(() => new DriveApiService(accessToken), [accessToken]);

  /* ---- Load Videos ---- */
  const loadVideos = useCallback(async (folderId = null) => {
    if (!accessToken) return;
    setLoading(true);
    try {
      driveApi.setAccessToken(accessToken);
      const [vidData, folderData] = await Promise.all([
        driveApi.listVideos(folderId, null, searchQuery),
        driveApi.listFolders(folderId || 'root'),
      ]);
      setVideos(vidData.files  || []);
      setFolders(folderData.files || []);
    } catch (err) {
      console.error(err);
      if (err.message?.includes('401')) {
        authService.signOut();
        setAccessToken(null);
        setUserProfile(null);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, searchQuery]);

  useEffect(() => {
    if (accessToken) loadVideos(currentFolder?.id);
  }, [accessToken, currentFolder]);

  /* ---- Handlers ---- */
  const handleSignIn   = () => authService.signIn();
  const handleSignOut  = () => {
    authService.signOut();
    setAccessToken(null); setUserProfile(null);
    setVideos([]); setFolders([]); setCurrentFolder(null);
  };

  /* ---- Filtered videos ---- */
  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;
    const q = searchQuery.toLowerCase();
    return videos.filter(v => v.name.toLowerCase().includes(q));
  }, [videos, searchQuery]);

  /* ---- Continue Watching list ---- */
  const continueList = useMemo(() =>
    HistoryService.getAllSorted()
      .filter(h => h.progressPercent > 2 && h.progressPercent < 95)
      .slice(0, 8)
      .map(h => {
        const movie = videos.find(v => v.id === h.fileId);
        return movie ? { movie, progress: h } : null;
      })
      .filter(Boolean),
  [watchHistory, videos]);

  /* ---- Close player & refresh history ---- */
  const handleClosePlayer = () => {
    setSelectedMovie(null);
    setWatchHistory(HistoryService.getHistory());
  };

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userProfile={userProfile}
        onSignOut={handleSignOut}
        storageUsed={0}
        storageTotal={5}
      />

      {/* MAIN AREA */}
      <div className="main-area">
        <TopNav
          userProfile={userProfile}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onRefresh={() => loadVideos(currentFolder?.id)}
          onScanAll={() => loadVideos('all')}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="page-content">
          {/* Setup Alert: Client ID missing */}
          {!GOOGLE_CLIENT_ID && (
            <div className="setup-alert">
              <KeyRound size={18} />
              <p>
                <strong>Chưa cấu hình Client ID:</strong> Thêm{' '}
                <code>VITE_GOOGLE_CLIENT_ID=...</code> vào file{' '}
                <code>web/.env</code> sau khi hoàn thành Phase 3.
              </p>
            </div>
          )}

          {/* ==================== NOT SIGNED IN ==================== */}
          {!accessToken ? (
            <div className="welcome-hero fade-up">
              {/* Glows */}
              <div className="hero-glow hero-glow-1" />
              <div className="hero-glow hero-glow-2" />

              <span className="hero-badge">
                <Zap size={11} /> CINEDRIVE v1.0
              </span>
              <h1 className="hero-title">
                Xem phim 5TB Drive với<br />
                <span>Zero Lag & Pro Player</span>
              </h1>
              <p className="hero-desc">
                Phát trực tiếp mọi file MP4, MKV từ Google Drive với trình phát điện ảnh cao cấp —
                tua tức thì (HTTP 206 Range), tự nạp phụ đề rời, nhớ giây đang xem,
                không tốn dung lượng điện thoại.
              </p>

              <div className="features-row">
                {[
                  { icon: Zap,      label: 'Tua tức thì – HTTP 206 Range' },
                  { icon: FileText, label: 'Tự tìm phụ đề .srt / .vtt'   },
                  { icon: Clock3,   label: 'Nhớ giây đang xem dở'         },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="feature-chip">
                    <Icon size={15} /> {label}
                  </div>
                ))}
              </div>

              <button id="btn-hero-signin" className="btn-signin" onClick={handleSignIn}
                style={{ padding:'14px 28px', fontSize:16, borderRadius: 40 }}>
                Kết nối tài khoản Google Drive
              </button>
            </div>

          ) : (
            /* ==================== SIGNED IN ==================== */
            <>
              {/* Continue Watching */}
              {continueList.length > 0 && (
                <section style={{ marginBottom: 36 }}>
                  <div className="section-hd">
                    <h2 className="section-title"><Clock3 />Tiếp tục xem</h2>
                    <span className="section-link">Xem tất cả →</span>
                  </div>
                  <div className="continue-row">
                    {continueList.map(({ movie, progress }) => (
                      <ContinueCard
                        key={movie.id}
                        movie={movie}
                        watchProgress={progress}
                        onPlay={setSelectedMovie}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Folder Breadcrumbs & Pills */}
              <div className="breadcrumbs-bar">
                <button className={`crumb-btn ${!currentFolder ? 'active' : ''}`} onClick={() => setCurrentFolder(null)}>
                  <Home size={14} /> Tất cả phim
                </button>
                {currentFolder && (
                  <>
                    <span className="crumb-sep"><ChevronRight size={14} /></span>
                    <span className="crumb-btn active">
                      <Folder size={14} /> {currentFolder.name}
                    </span>
                  </>
                )}
              </div>

              {folders.length > 0 && (
                <div className="folder-pills">
                  {folders.map(f => (
                    <button
                      key={f.id}
                      className={`folder-pill ${currentFolder?.id === f.id ? 'active' : ''}`}
                      onClick={() => setCurrentFolder(f)}
                    >
                      <Folder size={13} /> {f.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Movie Grid */}
              <section>
                <div className="section-hd">
                  <h2 className="section-title">
                    <Film />
                    {currentFolder ? currentFolder.name : 'Tất cả phim'}
                    <span style={{ fontSize:13, color:'var(--text-p)', fontWeight:500 }}>
                      ({filteredVideos.length} file)
                    </span>
                  </h2>
                </div>

                {loading ? (
                  <div className="loading-state">
                    <div className="loading-spinner" />
                    <p>Đang quét kho phim từ Google Drive...</p>
                  </div>
                ) : filteredVideos.length === 0 ? (
                  <div className="empty-state">
                    <Film size={48} />
                    <h3>Chưa tìm thấy phim trong thư mục "Cine"</h3>
                    <p>{searchQuery ? `Không có kết quả cho "${searchQuery}"` : 'Hãy tải hoặc tạo thư mục "Cine" trên Google Drive, hoặc bấm nút dưới đây để tìm tất cả phim trên toàn bộ tài khoản.'}</p>
                    
                    <button
                      onClick={() => loadVideos('all')}
                      style={{
                        marginTop: 14,
                        padding: '10px 20px',
                        borderRadius: '30px',
                        background: 'linear-gradient(135deg, var(--primary), var(--primary-dim))',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 14,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: '0 4px 14px var(--primary-glow)',
                        cursor: 'pointer'
                      }}
                    >
                      <FolderSync size={16} />
                      <span>Quét toàn bộ Google Drive (Không giới hạn thư mục Cine)</span>
                    </button>
                  </div>
                ) : (
                  <div className="movie-grid">
                    {filteredVideos.map(v => (
                      <MovieCard
                        key={v.id}
                        movie={v}
                        onPlay={setSelectedMovie}
                        watchProgress={watchHistory[v.id]}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      {accessToken && (
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSignOut={handleSignOut}
          onRefresh={() => loadVideos(currentFolder?.id)}
          loading={loading}
        />
      )}

      {/* VIDEO PLAYER MODAL */}
      {selectedMovie && accessToken && (
        <VideoPlayer
          movie={selectedMovie}
          accessToken={accessToken}
          driveApi={driveApi}
          onClose={handleClosePlayer}
        />
      )}
    </div>
  );
}
