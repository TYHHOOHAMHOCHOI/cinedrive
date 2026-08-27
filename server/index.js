const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Tìm binary FFmpeg chuẩn theo HĐH
 */
function findFfmpegBinary() {
  const isWin = process.platform === 'win32';

  if (isWin) {
    const staticPath = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
    const candidates = [
      path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
      path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return 'ffmpeg.exe';
  }

  // Môi trường Linux (Azure Web App)
  const linuxCandidates = [
    path.join(__dirname, 'ffmpeg'),
    path.join(process.cwd(), 'ffmpeg'),
    path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
  ];

  for (const c of linuxCandidates) {
    if (fs.existsSync(c)) {
      try { fs.chmodSync(c, '755'); } catch (_) {}
      return c;
    }
  }
  return 'ffmpeg';
}

const ffmpegExecutable = findFfmpegBinary();
console.log('[FFmpeg] Found Binary Path:', ffmpegExecutable, 'Platform:', process.platform);

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'HEAD', 'OPTIONS'] }));

const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  const bin = findFfmpegBinary();
  res.json({
    status: 'ok',
    message: '🎬 CineDrive Transcoder is Running!',
    ffmpegExecutable: bin,
    platform: process.platform,
    exists: fs.existsSync(bin),
  });
});

/**
 * GET /stream?fileId=...&access_token=...
 * FFmpeg tự download từ Google Drive qua -headers với Bearer token
 */
app.get('/stream', (req, res) => {
  const { fileId, access_token } = req.query;

  if (!fileId || !access_token) {
    return res.status(400).json({ error: 'Thiếu fileId hoặc access_token' });
  }

  const activeFfmpeg = findFfmpegBinary();
  const inputUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  console.log(`\n[Transcode] ▶ Bắt đầu: fileId=${fileId.substring(0, 20)}... dùng binary: ${activeFfmpeg}`);

  // Thiết lập HTTP headers phát luồng MP4 ngay lập tức
  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Cache-Control': 'no-cache, no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Authorization',
    'Connection': 'keep-alive',
  });

  const args = [
    '-headers', `Authorization: Bearer ${access_token}\r\n`,
    '-i', inputUrl,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4',
    '-loglevel', 'warning',
    'pipe:1',
  ];

  console.log('[FFmpeg] spawn:', activeFfmpeg);

  const ffmpeg = spawn(activeFfmpeg, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('frame=') || msg.includes('fps=')) {
      process.stdout.write('\r[FFmpeg] ' + msg.trim());
    } else {
      console.error('[FFmpeg stderr]', msg.trim());
    }
  });

  ffmpeg.on('error', (err) => {
    console.error('[FFmpeg spawn error]', err);
    if (!res.writableEnded) res.end();
  });

  ffmpeg.on('close', (code) => {
    console.log(`\n[FFmpeg] Kết thúc code: ${code}`);
    if (!res.writableEnded) res.end();
  });

  req.on('close', () => {
    console.log('[Transcode] Client ngắt kết nối, dừng FFmpeg');
    try {
      ffmpeg.kill('SIGKILL');
    } catch (_) {}
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 CineDrive Transcoder chạy tại http://localhost:${PORT}\n`);
});
