const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

console.log('[FFmpeg] Binary:', ffmpegPath);

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'HEAD', 'OPTIONS'] }));

const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: '🎬 CineDrive Transcoder is Running!', ffmpegPath });
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

  const inputUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  console.log(`\n[Transcode] ▶ fileId=${fileId.substring(0, 20)}...`);

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Transfer-Encoding', 'chunked');

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

  console.log('[FFmpeg] spawn:', ffmpegPath, args.slice(0, 4).join(' '), '...');

  const ffmpeg = spawn(ffmpegPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('frame=') || msg.includes('fps=')) {
      process.stdout.write('\r[FFmpeg] ' + msg.trim());
    } else if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('invalid')) {
      console.error('[FFmpeg stderr]', msg.trim());
    }
  });

  ffmpeg.on('close', (code) => {
    console.log(`\n[FFmpeg] Kết thúc code: ${code}`);
    if (!res.writableEnded) res.end();
  });

  ffmpeg.on('error', (err) => {
    console.error('[FFmpeg spawn error]', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  });

  req.on('close', () => {
    console.log('[Transcode] Client ngắt, kill FFmpeg');
    ffmpeg.kill('SIGKILL');
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 CineDrive Transcoder chạy tại http://localhost:${PORT}\n`);
});
