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
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

/**
 * Hàm giải quyết URL tải trực tiếp từ Google Drive (Google CDN Signed URL)
 * Tránh lỗi header Authorization bị chặn hoặc lỗi redirect 302 trong FFmpeg
 */
async function resolveGoogleDriveStreamUrl(fileId, accessToken) {
  const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  try {
    const response = await fetch(driveUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      redirect: 'manual', // Bắt redirect 302/303/307 để lấy Location trực tiếp
    });

    // Nếu trả về redirect (302/303/307), lấy direct URL của Google CDN
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        return {
          directUrl: location,
          useAuthHeader: false,
        };
      }
    }

    // Nếu Google Drive trả về stream trực tiếp không redirect
    if (response.ok) {
      return {
        directUrl: driveUrl,
        useAuthHeader: true,
      };
    }

    const errText = await response.text();
    console.error(`[GoogleDrive API Error ${response.status}]`, errText);
    return { error: `Google Drive API error: ${response.status}`, statusCode: response.status };
  } catch (err) {
    console.error('[GoogleDrive Fetch Error]', err);
    return { error: err.message, statusCode: 500 };
  }
}

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
  console.log(`\n[Transcode] ▶ Bắt đầu: fileId=${fileId.substring(0, 20)}... startTime=${startTime}s | Binary: ${activeFfmpeg}`);

  // Giải quyết URL tải trực tiếp từ Google Drive
  const resolved = await resolveGoogleDriveStreamUrl(fileId, access_token);
  if (!resolved || resolved.error) {
    return res.status(resolved?.statusCode || 500).json({
      error: resolved?.error || 'Không thể lấy luồng video từ Google Drive.',
    });
  }

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

  // Hỗ trợ tua nhanh / resume từ giây cụ thể qua HTTP Range seeking của FFmpeg
  if (startTime > 0) {
    args.push('-ss', String(startTime));
  }

  // Nếu không có redirect, thêm Authorization header
  if (resolved.useAuthHeader) {
    args.push('-headers', `Authorization: Bearer ${access_token}\r\n`);
  }

  // Đầu vào URL
  args.push('-i', resolved.directUrl);

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

  console.log('[FFmpeg] Spawning FFmpeg with args:', args.filter(a => !a.startsWith('http') && !a.includes('Bearer')).join(' '));

  const ffmpeg = spawn(activeFfmpeg, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Pipe đầu ra trực tiếp vào HTTP Response
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

  // Khi trình duyệt ngắt kết nối hoặc tua/đổi video, huỷ tiến trình FFmpeg để giải phóng CPU
  req.on('close', () => {
    console.log('[Transcode] Client ngắt kết nối, giải phóng tiến trình FFmpeg');
    try {
      ffmpeg.kill('SIGKILL');
    } catch (_) {}
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 CineDrive Transcoder chạy tại http://localhost:${PORT}\n`);
});
