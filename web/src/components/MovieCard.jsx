import React from 'react';
import { Play, Film, Clock, HardDrive, CheckCircle2, Circle } from 'lucide-react';

function formatSize(bytes) {
  if (!bytes) return 'N/A';
  const n = parseInt(bytes, 10);
  if (isNaN(n)) return 'N/A';
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`;
  return `${(n / 1048576).toFixed(0)} MB`;
}

function formatDuration(ms) {
  if (!ms) return null;
  const s = Math.floor(parseInt(ms, 10) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function MovieCard({ movie, onPlay, watchProgress }) {
  const ext    = movie.name.split('.').pop()?.toUpperCase() || 'VIDEO';
  const dur    = formatDuration(movie.videoMediaMetadata?.durationMillis);
  const pct    = watchProgress?.progressPercent || 0;

  return (
    <article className="movie-card" onClick={() => onPlay(movie)} title={movie.name}>
      {/* Thumbnail */}
      <div className="card-thumb">
        {movie.thumbnailLink ? (
          <img
            src={movie.thumbnailLink.replace('=s220', '=s600')}
            alt={movie.name}
            loading="lazy"
          />
        ) : (
          <div className="card-thumb-fallback">
            <Film />
          </div>
        )}

        {/* Badges */}
        <span className="badge badge-ext">{ext}</span>
        {dur && (
          <span className="badge badge-dur">
            <Clock size={10} />
            {dur}
          </span>
        )}

        {/* Play Glow Overlay */}
        <div className="card-overlay">
          <div className="play-glow">
            <Play fill="currentColor" />
          </div>
        </div>

        {/* Progress Bar */}
        {pct > 0 && (
          <div className="card-progress">
            <div className="card-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card-info">
        <h3 className="card-name">{movie.name}</h3>
        <div className="card-meta">
          <span className="card-size">
            <HardDrive />
            {formatSize(movie.size)}
          </span>
          {pct >= 90 && (
            <span className="tag tag-watched">
              <CheckCircle2 size={11} style={{ display:'inline', marginRight:3, verticalAlign:'middle' }} />
              Xong
            </span>
          )}
          {pct > 0 && pct < 90 && (
            <span className="tag tag-watching">{pct}%</span>
          )}
        </div>
      </div>
    </article>
  );
}

/* ===== Continue Watching Card (smaller, horizontal) ===== */
export function ContinueCard({ movie, watchProgress, onPlay }) {
  const pct  = watchProgress?.progressPercent || 0;
  const rem  = watchProgress?.duration && watchProgress?.currentTime
    ? Math.round((watchProgress.duration - watchProgress.currentTime) / 60)
    : null;

  return (
    <article className="cw-card" onClick={() => onPlay(movie)}>
      <div className="cw-thumb">
        {movie.thumbnailLink ? (
          <img src={movie.thumbnailLink.replace('=s220', '=s600')} alt={movie.name} loading="lazy" />
        ) : (
          <div className="cw-thumb-fallback"><Film /></div>
        )}
        <div className="cw-play-btn">
          <div className="cw-play-circle"><Play fill="white" /></div>
        </div>
        <div className="cw-progress-bg">
          <div className="cw-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="cw-info">
        <div className="cw-name">{movie.name}</div>
        <div className="cw-meta">
          {rem !== null && <span>{rem} phút còn lại</span>}
          <span className="cw-resume-tag">Tiếp tục ▶</span>
        </div>
      </div>
    </article>
  );
}
