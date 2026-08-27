const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Tìm đòn bẩy binary FFmpeg chuẩn theo HĐH (Linux vs Windows)
 */
function findFfmpegBinary() {
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
  const staticPath = require('ffmpeg-static');

  const candidates = [
    path.join(__dirname, 'node_modules', 'ffmpeg-static', binName),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', binName),
    staticPath ? path.resolve(staticPath) : null,
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      // Lọc bỏ file .exe nếu đang chạy trên Linux
      if (!isWin && candidate.endsWith('.exe')) continue;
      // Lọc bỏ file ELF nếu đang chạy trên Windows
      if (isWin && !candidate.endsWith('.exe')) continue;

      try {
        if (!isWin) {
          fs.chmodSync(candidate, '755');
        }
      } catch (_) {}
      return candidate;
    }
  }
  return 'ffmpeg'; // Fallback về system ffmpeg
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
    '-map', '0:v:0?',
    '-map', '0:a:0?',
    '-f', 'mp4',
    '-loglevel', 'warning',
    'pipe:1',
  ];

  console.log('[FFmpeg] spawn:', activeFfmpeg);

  const ffmpeg = spawn(activeFfmpeg, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let hasStartedSending = false;
  let stderrLog = '';

  ffmpeg.stderr.on('data', (data) => {
    const msg = data.toString();
    stderrLog += msg;
    if (msg.includes('frame=') || msg.includes('fps=')) {
      process.stdout.write('\r[FFmpeg] ' + msg.trim());
    } else {
      console.error('[FFmpeg stderr]', msg.trim());
    }
  });

  ffmpeg.stdout.on('data', (chunk) => {
    if (!hasStartedSending) {
      hasStartedSending = true;
      console.log('[Transcode] ⚡ Đã nhận dữ liệu đầu tiên từ FFmpeg! Gửi MP4 stream cho client.');
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.write(chunk);
  });

  ffmpeg.on('error', (err) => {
    console.error('[FFmpeg spawn error]', err);
    if (!hasStartedSending && !res.headersSent) {
      res.status(500).json({ error: `Lỗi khởi chạy FFmpeg (${activeFfmpeg}): ${err.message}` });
    } else {
      res.end();
    }
  });

  ffmpeg.on('close', (code) => {
    console.log(`\n[FFmpeg] Kết thúc code: ${code}`);
    if (!hasStartedSending && !res.headersSent) {
      res.status(500).json({ error: `FFmpeg mã thoát ${code}: ${stderrLog.substring(0, 300)}` });
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  req.on('close', () => {
    console.log('[Transcode] Client ngắt, kill FFmpeg');
    try {
      ffmpeg.kill('SIGKILL');
    } catch (_) {}
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 CineDrive Transcoder chạy tại http://localhost:${PORT}\n`);
});
