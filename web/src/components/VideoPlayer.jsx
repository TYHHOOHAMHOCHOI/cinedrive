import React, { useEffect, useRef, useState, useCallback } from 'react';
import Artplayer from 'artplayer';
import {
  ArrowLeft, X, Maximize2, Minimize2, PictureInPicture2,
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Sun, Subtitles, Gauge, AlertCircle,
  Settings2
} from 'lucide-react';
import { HistoryService } from '../services/historyService';

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function VideoPlayer({ movie, accessToken, driveApi, onClose }) {
  const artRef        = useRef(null);
  const artInstance   = useRef(null);
  const progressSave  = useRef(null);

  const [playing,    setPlaying]    = useState(false);
  const [currentT,   setCurrentT]   = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [buffered,   setBuffered]    = useState(0);
  const [volume,     setVolume]      = useState(0.8);
  const [muted,      setMuted]       = useState(false);
  const [brightness, setBrightness]  = useState(80);
  const [speed,      setSpeed]       = useState(1);
  const [isTranscode, setIsTranscode] = useState(false);
  const [subtitles,  setSubtitles]   = useState([]);
  const [error,      setError]       = useState(null);
  const [hovering,   setHovering]    = useState(true);
  const [showStallHint, setShowStallHint] = useState(false);
  const hideTimer    = useRef(null);
  const stallTimer   = useRef(null);

  // Auto-hide controls
  const showControls = useCallback(() => {
    setHovering(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHovering(false), 3500);
  }, []);

  const initPlayer = useCallback((url) => {
    if (!artRef.current) return;

    // Destroy old instance first
    clearInterval(progressSave.current);
    if (artInstance.current?.destroy) {
      try { artInstance.current.destroy(false); } catch (_) {}
    }
    artInstance.current = null;

    const saved = HistoryService.getProgress(movie.id);

    try {
      const art = new Artplayer({
        container:   artRef.current,
        url,
        type:        'auto',
        title:       movie.name,
        volume:      0.8,
        autoplay:    true,
        pip:         false,
        setting:     false,
        fullscreen:  false,
        controls:    [],
        layers:      [],
        contextmenu: [],
        backdrop:    false,
        miniProgressBar: false,
        theme:       '#e50914',
      });

      artInstance.current = art;

      art.on('ready', () => {
        setDuration(art.duration);
        if (saved?.currentTime > 5 && (saved.progressPercent || 0) < 95) {
          art.currentTime = saved.currentTime;
        }
        art.play();
        setPlaying(true);
        setError(null);
      });

      art.on('play',  () => setPlaying(true));
      art.on('pause', () => setPlaying(false));

      art.on('video:timeupdate', () => {
        setCurrentT(art.currentTime);
        const buf = art.video?.buffered;
        if (buf?.length) setBuffered(buf.end(buf.length - 1));
      });

      art.on('video:durationchange', () => setDuration(art.duration));

      art.on('error', (e) => {
        console.error('Player error:', e);
        setError('Không thể phát video. Có thể do token hết hạn hoặc định dạng codec trình duyệt không hỗ trợ.');
      });

      // Auto-save progress every 5s
      progressSave.current = setInterval(() => {
        if (art.currentTime > 2 && art.duration > 0) {
          HistoryService.saveProgress(movie.id, {
            fileName: movie.name,
            currentTime: art.currentTime,
            duration: art.duration,
          });
        }
      }, 5000);

      // Load subtitles
      if (movie.parents?.[0]) {
        driveApi.findSubtitles(movie.parents[0]).then(setSubtitles);
      }

    } catch (err) {
      setError(err.message);
    }
  }, [movie, driveApi]);

  useEffect(() => {
    if (!artRef.current || !movie) return;
    const streamUrl = driveApi.getStreamUrl(movie.id);
    initPlayer(streamUrl);
    return () => {
      clearInterval(progressSave.current);
      clearTimeout(hideTimer.current);
      if (artInstance.current?.destroy) {
        try { artInstance.current.destroy(false); } catch (_) {}
      }
    };
  }, [movie, accessToken]);


  /* ---- Controls ---- */
  const togglePlay = () => {
    const art = artInstance.current;
    if (!art) return;
    if (art.video) {
      if (art.video.paused) {
        art.video.play().catch(e => console.warn('Play error:', e));
      } else {
        art.video.pause();
      }
    } else {
      art.toggle();
    }
    showControls();
  };

  const seek = (delta) => {
    const art = artInstance.current;
    if (!art) return;
    art.currentTime = Math.max(0, Math.min(art.duration, art.currentTime + delta));
    showControls();
  };

  const handleScrubberClick = (e) => {
    const art = artInstance.current;
    if (!art) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    art.currentTime = pct * art.duration;
    showControls();
  };

  const handleVolume = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (artInstance.current) artInstance.current.volume = val;
  };

  const toggleMute = () => {
    const art = artInstance.current;
    if (!art) return;
    art.muted = !art.muted;
    setMuted(!muted);
    showControls();
  };

  const setPlaySpeed = (s) => {
    setSpeed(s);
    if (artInstance.current) artInstance.current.playbackRate = s;
    showControls();
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.querySelector('.player-shell')?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handlePiP = () => {
    const vid = artInstance.current?.video;
    if (!vid) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    } else {
      vid.requestPictureInPicture?.();
    }
  };

  const loadSubtitle = async (sub) => {
    const art = artInstance.current;
    if (!art) return;
    const content = await driveApi.fetchSubtitleContent(sub.id);
    if (content) {
      const blob = new Blob([content], { type: 'text/vtt;charset=utf-8' });
      art.subtitle.switch(URL.createObjectURL(blob), { name: sub.name });
    }
  };

  const progress  = duration > 0 ? (currentT / duration) * 100 : 0;
  const bufferPct = duration > 0 ? (buffered  / duration) * 100 : 0;

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space')       { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowRight')  seek(10);
      if (e.code === 'ArrowLeft')   seek(-10);
      if (e.code === 'ArrowUp')     { const v = Math.min(1, volume + 0.1); setVolume(v); if (artInstance.current) artInstance.current.volume = v; }
      if (e.code === 'ArrowDown')   { const v = Math.max(0, volume - 0.1); setVolume(v); if (artInstance.current) artInstance.current.volume = v; }
      if (e.code === 'KeyF')        handleFullscreen();
      if (e.code === 'Escape')      onClose();
      showControls();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [playing, volume]);

  return (
    <div className="player-backdrop" onMouseMove={showControls}>
      <div className="player-shell">
        {/* Video Canvas + all overlays */}
        <div className="art-container-wrap" onMouseMove={showControls}>

          {/* Artplayer mounts here */}
          <div ref={artRef} className="artplayer-app" />

          {/* Error Overlay */}
          {error && (
            <div className="player-error">
              <AlertCircle size={44} style={{ color: '#ef4444' }} />
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Không thể phát trực tiếp trên trình duyệt Web</h3>
              <p style={{ fontSize: 13, color: 'var(--text-p)', maxWidth: 520, lineHeight: 1.6 }}>
                File phim này là bản <strong>BD-Bluray 10-bit / Hi10P</strong> (thường dùng cho Anime/Phim chất lượng cao). Trình duyệt Chrome/Edge không giải mã được H.264 10-bit hoặc âm thanh AC3/FLAC nguyên bản.
              </p>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    const transcodeUrl = driveApi.getTranscodeUrl(movie.id);
                    setIsTranscode(true);
                    setError(null);
                    initPlayer(transcodeUrl);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                    color: '#fff',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(6,182,212,0.4)'
                  }}
                >
                  ⚡ Phát qua Server Transcode (FFmpeg Live)
                </button>

                <button
                  onClick={() => {
                    const streamUrl = driveApi.getStreamUrl(movie.id);
                    window.location.href = `vlc://${streamUrl}`;
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #e50914, #b8000a)',
                    color: '#fff',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(229,9,20,0.4)'
                  }}
                >
                  ▶ Mở bằng VLC Player
                </button>

                <button
                  onClick={() => {
                    const streamUrl = driveApi.getStreamUrl(movie.id);
                    navigator.clipboard.writeText(streamUrl);
                    alert('Đã sao chép Stream Link! Bạn có thể dán (Ctrl+V) vào VLC / PotPlayer / MPV / Kodi để xem mượt mà 4K 10-bit.');
                  }}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-h)',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  📋 Sao chép Stream Link cho PotPlayer / VLC
                </button>
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 16 }}>
                💡 <strong>Giải pháp lâu dài:</strong> Bạn có thể dùng <strong>App Android CineDrive (ExoPlayer)</strong> hoặc dùng app <strong>Nova Video Player / VLC</strong> kết nối Drive để xem full 4K HDR 10-bit không bị lỗi.
              </p>
            </div>
          )}

          {/* ---- TOP BAR ---- */}
          <div className="player-topbar" style={{ opacity: hovering ? 1 : 0 }}>
            <button className="player-back-btn" onClick={onClose} title="Đóng (Esc)">
              <ArrowLeft />
            </button>
            <div className="player-title-row">
              <span className="player-movie-title">{movie.name}</span>
              <button
                onClick={() => {
                  if (!isTranscode) {
                    const transcodeUrl = driveApi.getTranscodeUrl(movie.id);
                    setIsTranscode(true);
                    setShowStallHint(false);
                    initPlayer(transcodeUrl);
                  } else {
                    const streamUrl = driveApi.getStreamUrl(movie.id);
                    setIsTranscode(false);
                    initPlayer(streamUrl);
                  }
                }}
                style={{
                  background: isTranscode ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'rgba(255,255,255,0.12)',
                  border: isTranscode ? 'none' : '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: isTranscode ? '0 0 12px rgba(6,182,212,0.5)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {isTranscode ? '⚡ Luồng: FFmpeg Transcode (Bật)' : '⚡ Đổi sang Server Transcode FFmpeg'}
              </button>
            </div>
            <div className="player-topbar-actions">
              <button className="player-icon-btn" onClick={handlePiP} title="Picture in Picture">
                <PictureInPicture2 />
              </button>
              <button className="player-icon-btn close-btn" onClick={onClose} title="Đóng">
                <X />
              </button>
            </div>
          </div>

          {/* ---- GESTURE HUDs ---- */}
          <div className="gesture-hud left-hud" style={{ opacity: hovering ? 1 : 0 }}>
            <Sun />
            <div className="hud-bar">
              <div className="hud-bar-fill" style={{ height:`${brightness}%` }} />
            </div>
            <span className="hud-val">{brightness}%</span>
          </div>
          <div className="gesture-hud right-hud" style={{ opacity: hovering ? 1 : 0 }}>
            {muted ? <VolumeX /> : <Volume2 />}
            <div className="hud-bar">
              <div className="hud-bar-fill" style={{ height:`${Math.round(volume * 100)}%` }} />
            </div>
            <span className="hud-val">{Math.round(volume * 100)}%</span>
          </div>

          {/* ---- CENTER CONTROLS ---- */}
          <div className="player-center-controls" style={{ opacity: hovering ? 1 : 0 }}>
            <button className="center-skip-btn" onClick={() => seek(-10)} title="Tua lùi 10s">
              <SkipBack />
              <span>10s</span>
            </button>
            <button className="center-play-btn" onClick={togglePlay} title={playing ? 'Dừng (Space)' : 'Phát (Space)'}>
              {playing ? <Pause fill="white" /> : <Play fill="white" />}
            </button>
            <button className="center-skip-btn" onClick={() => seek(10)} title="Tua tiếp 10s">
              <SkipForward />
              <span>10s</span>
            </button>
          </div>

          {/* ---- BOTTOM CONTROLS ---- */}
          <div className="player-controls" style={{ opacity: hovering ? 1 : 0 }}>
            {/* Scrubber */}
            <div className="scrubber-row">
              <div
                className="scrubber-bg"
                onClick={handleScrubberClick}
                role="progressbar"
                aria-valuenow={progress}
                aria-label="Thanh tiến trình video"
              >
                <div className="scrubber-buffer" style={{ width: `${bufferPct}%` }} />
                <div className="scrubber-fill"   style={{ width: `${progress}%`  }} />
                <div className="scrubber-thumb"  style={{ left:  `${progress}%`  }} />
              </div>
            </div>

            {/* Controls Row */}
            <div className="controls-row">
              {/* Left */}
              <div className="controls-left">
                <button className="ctrl-btn" onClick={togglePlay} title={playing ? 'Dừng' : 'Phát'}>
                  {playing ? <Pause /> : <Play />}
                </button>
                <button className="ctrl-btn" onClick={() => seek(-10)} title="Tua lùi 10s">
                  <SkipBack />
                </button>
                <button className="ctrl-btn" onClick={() => seek(10)} title="Tua tới 10s">
                  <SkipForward />
                </button>
                <button className="ctrl-btn" onClick={toggleMute} title={muted ? 'Bật âm thanh' : 'Tắt tiếng'}>
                  {muted ? <VolumeX /> : <Volume2 />}
                </button>
                <span className="time-display">
                  {formatTime(currentT)} <span className="sep">/</span> <span className="total">{formatTime(duration)}</span>
                </span>
              </div>

              {/* Right */}
              <div className="controls-right">
                {/* Subtitles */}
                {subtitles.length > 0 && (
                  <div className="ctrl-popup-wrapper">
                    <button className="ctrl-btn" title="Phụ đề">
                      <Subtitles />
                    </button>
                    <div className="ctrl-popup">
                      <span className="ctrl-popup-label">Chọn Phụ đề</span>
                      {subtitles.map(sub => (
                        <button key={sub.id} className="ctrl-popup-item" onClick={() => loadSubtitle(sub)}>
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Speed */}
                <div className="ctrl-popup-wrapper">
                  <button className="ctrl-btn" title="Tốc độ phát">
                    <Gauge />
                  </button>
                  <div className="ctrl-popup">
                    <span className="ctrl-popup-label">Tốc độ phát</span>
                    {SPEEDS.map(s => (
                      <button
                        key={s}
                        className={`ctrl-popup-item ${speed === s ? 'selected' : ''}`}
                        onClick={() => setPlaySpeed(s)}
                      >
                        {s === 1 ? '1x (Bình thường)' : `${s}x`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fullscreen */}
                <button className="ctrl-btn" onClick={handleFullscreen} title="Toàn màn hình (F)">
                  <Maximize2 />
                </button>
              </div>
            </div>
          </div>

          {/* Click center to play/pause — z-index 8: above video (1), below controls (11+) */}
          <div
            style={{ position:'absolute', inset:0, zIndex: 8 }}
            onDoubleClick={handleFullscreen}
            onClick={togglePlay}
          />
        </div>
      </div>
    </div>
  );
}
