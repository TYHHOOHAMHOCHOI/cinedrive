const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let ffmpegPath = require('ffmpeg-static');

if (ffmpegPath) {
  ffmpegPath = path.resolve(ffmpegPath);
  console.log('[FFmpeg] Absolute Binary Path:', ffmpegPath);
  // Đảm bảo file có quyền chạy (executable) trên Linux (Azure Web App)
  try {
    if (process.platform !== 'win32' && fs.existsSync(ffmpegPath)) {
      fs.chmodSync(ffmpegPath, '755');
      console.log('[FFmpeg] chmod 755 thành công');
    }
  } catch (err) {
    console.warn('[FFmpeg] Không thể chmod 755:', err.message);
  }
}

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'HEAD', 'OPTIONS'] }));

const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: '🎬 CineDrive Transcoder is Running!',
    ffmpegPath,
    exists: ffmpegPath ? fs.existsSync(ffmpegPath) : false
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

  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    return res.status(500).json({ error: 'FFmpeg binary không tồn tại trên server' });
  }

  const inputUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  console.log(`\n[Transcode] ▶ fileId=${fileId.substring(0, 20)}...`);

  // FFmpeg download trực tiếp từ Google Drive với Authorization header
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
    '-map', '0:v:0',
    '-map', '0:a:0',
    '-f', 'mp4',
    '-loglevel', 'warning',
    'pipe:1',   // output ra stdout
  ];

  console.log('[FFmpeg] spawn:', ffmpegPath);

  const ffmpeg = spawn(ffmpegPath, args, {
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
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.write(chunk);
  });

  ffmpeg.on('error', (err) => {
    console.error('[FFmpeg spawn error]', err);
    if (!hasStartedSending && !res.headersSent) {
      res.status(500).json({ error: `Lỗi khởi chạy FFmpeg: ${err.message}` });
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
