const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const app = express();

// CORS rộng: cho phép tất cả origin (local dev + Azure + Vercel)
app.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
}));

const PORT = process.env.PORT || 3001;

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: '🎬 CineDrive Transcoder Server is Running!' });
});

/**
 * Endpoint Stream & Encode trực tiếp từ Google Drive
 * GET /stream?fileId=...&access_token=...
 */
app.get('/stream', async (req, res) => {
  const { fileId, access_token } = req.query;

  if (!fileId || !access_token) {
    return res.status(400).json({ error: 'Thiếu fileId hoặc access_token' });
  }

  try {
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${access_token}`;

    console.log(`[Transcode] Bắt đầu encode: ${fileId}`);

    // Thiết lập headers cho phép trình duyệt nhận stream MP4 ngay lập tức
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // FFmpeg live transcode: BD-Bluray/10-bit → H.264/AAC 8-bit chuẩn Web
    ffmpeg(driveUrl)
      .inputOptions(['-re'])
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset ultrafast',
        '-tune zerolatency',
        '-movflags frag_keyframe+empty_moov+default_base_moof',
        '-pix_fmt yuv420p',
        '-crf 23',
        '-maxrate 4M',
        '-bufsize 8M',
      ])
      .format('mp4')
      .on('start', (cmd) => {
        console.log('[FFmpeg] Lệnh:', cmd.substring(0, 120) + '...');
      })
      .on('progress', (p) => {
        process.stdout.write(`\r[FFmpeg] Frame: ${p.frames} | FPS: ${p.currentFps} | Speed: ${p.currentKbps}kbps`);
      })
      .on('error', (err) => {
        console.error('\n[FFmpeg] Lỗi:', err.message);
        if (!res.headersSent) res.status(500).json({ error: err.message });
      })
      .on('end', () => {
        console.log('\n[FFmpeg] Encode hoàn thành.');
      })
      .pipe(res, { end: true });

  } catch (err) {
    console.error('[Server] Lỗi:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 Server CineDrive Transcoder đang chạy tại port ${PORT}`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Lắng nghe mọi kết nối (0.0.0.0)\n`);
});
