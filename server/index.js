const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

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

/**
 * Endpoint kiểm tra trạng thái hoạt động của server
 */
app.get('/', (req, res) => {
  const bin = findFfmpegBinary();
  res.json({
    status: 'ok',
    message: '🎬 CineDrive Transcoder & Proxy Server is Running!',
    ffmpegExecutable: bin,
    platform: process.platform,
    exists: fs.existsSync(bin),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

/**
 * GET /proxy?fileId=...&access_token=...
 * Streaming Proxy trực tiếp từ Google Drive có hỗ trợ HTTP Range Requests
 * Giải quyết triệt để lỗi CORS & 403 Forbidden của Google Drive khi chạy trên Web (Vercel)
 */
app.get('/proxy', async (req, res) => {
  const { fileId, access_token } = req.query;

  if (!fileId || !access_token) {
    return res.status(400).json({ error: 'Thiếu fileId hoặc access_token' });
  }

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token });
    const drive = google.drive({ version: 'v3', auth });

    const rangeHeader = req.headers.range;
    console.log(`[Proxy] Direct stream: fileId=${fileId.substring(0, 15)}... Range=${rangeHeader || 'All'}`);

    const driveRes = await drive.files.get(
      { fileId, alt: 'media' },
      {
        responseType: 'stream',
        headers: rangeHeader ? { Range: rangeHeader } : {},
      }
    );

    const status = driveRes.status || 200;
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Authorization, Content-Type',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    };

    if (driveRes.headers['content-type']) {
      headers['Content-Type'] = driveRes.headers['content-type'];
    }
    if (driveRes.headers['content-length']) {
      headers['Content-Length'] = driveRes.headers['content-length'];
    }
    if (driveRes.headers['content-range']) {
      headers['Content-Range'] = driveRes.headers['content-range'];
    }

    res.writeHead(status, headers);
    driveRes.data.pipe(res);

    req.on('close', () => {
      try { driveRes.data.destroy(); } catch (_) {}
    });

    driveRes.data.on('error', (err) => {
      console.error('[Proxy Stream Error]', err);
      if (!res.writableEnded) res.end();
    });
  } catch (err) {
    console.error('[Proxy Error]', err.message);
    if (!res.headersSent) {
      res.status(err.status || 500).json({ error: err.message || 'Lỗi khi tải stream từ Google Drive' });
    }
  }
});

/**
 * GET /stream?fileId=...&access_token=...&startTime=...
 * Live Transcode video (Hi10P / 10-bit Bluray / AC3 / DTS / MKV) sang H.264/AAC fMP4 cho Web
 */
app.get('/stream', async (req, res) => {
  const { fileId, access_token } = req.query;
  const startTime = parseFloat(req.query.startTime || req.query.t || req.query.ss || '0');

  if (!fileId || !access_token) {
    return res.status(400).json({ error: 'Thiếu fileId hoặc access_token' });
  }

  const activeFfmpeg = findFfmpegBinary();
  console.log(`\n[Transcode] ▶ Bắt đầu: fileId=${fileId.substring(0, 15)}... startTime=${startTime}s | Binary: ${activeFfmpeg}`);

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token });
    const drive = google.drive({ version: 'v3', auth });

    // Request stream trực tiếp từ Google Drive qua Google SDK
    const driveRes = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    // Thiết lập HTTP headers phát luồng MP4 trực tiếp
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Authorization, Content-Type',
      'Connection': 'keep-alive',
    });

    const args = [];

    // Hỗ trợ tua nhanh / resume từ giây cụ thể
    if (startTime > 0) {
      args.push('-ss', String(startTime));
    }

    // Nhận luồng video từ standard input (pipe:0)
    args.push('-i', 'pipe:0');

    // Cấu hình mã hóa Video: Chuẩn H.264 8-bit YUV420P tương thích 100% trình duyệt
    args.push(
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p',
      '-crf', '23',
      '-g', '60'
    );

    // Cấu hình mã hóa Audio: AAC Stereo 192k tương thích mọi thiết bị
    args.push(
      '-c:a', 'aac',
      '-ac', '2',
      '-b:a', '192k',
      '-ar', '48000'
    );

    // Stream mapping: Chọn track video đầu tiên và track audio đầu tiên nếu có
    args.push(
      '-map', '0:v:0',
      '-map', '0:a:0?'
    );

    // Định dạng Fragmented MP4 cho live streaming
    args.push(
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      '-loglevel', 'warning',
      'pipe:1'
    );

    console.log('[FFmpeg] Spawning FFmpeg with args:', args.join(' '));

    const ffmpeg = spawn(activeFfmpeg, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Pipe Google Drive stream vào FFmpeg stdin
    driveRes.data.pipe(ffmpeg.stdin);

    // Pipe đầu ra FFmpeg stdout trực tiếp vào HTTP Response của client
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
      console.log(`\n[FFmpeg] Kết thúc process (code: ${code})`);
      if (!res.writableEnded) res.end();
    });

    driveRes.data.on('error', (err) => {
      console.error('[Drive Stream error]', err);
      try { ffmpeg.kill('SIGKILL'); } catch (_) {}
      if (!res.writableEnded) res.end();
    });

    // Khi trình duyệt ngắt kết nối hoặc tua/đổi video, huỷ tiến trình FFmpeg để giải phóng CPU
    req.on('close', () => {
      console.log('[Transcode] Client ngắt kết nối, giải phóng tiến trình FFmpeg & Drive Stream');
      try { driveRes.data.destroy(); } catch (_) {}
      try { ffmpeg.kill('SIGKILL'); } catch (_) {}
    });

  } catch (err) {
    console.error('[Transcode Error]', err.message);
    if (!res.headersSent) {
      res.status(err.status || 500).json({ error: err.message || 'Lỗi khi khởi chạy Transcoder' });
    }
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 CineDrive Transcoder chạy tại http://localhost:${PORT}\n`);
});
