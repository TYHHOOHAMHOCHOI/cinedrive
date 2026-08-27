const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3001;

// Health check endpoint
app.get('/', (req, res) => {
  res.send('🎬 CineDrive Transcoder Server is Running!');
});

/**
 * Endpoint Stream & Encode trực tiếp từ Google Drive
 * GET /stream?fileId=...&access_token=...
 */
app.get('/stream', async (req, res) => {
  const { fileId, access_token } = req.query;

  if (!fileId || !access_token) {
    return res.status(400).send('Thiếu fileId hoặc access_token');
  }

  try {
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${access_token}`;

    // Cấu hình Header phản hồi dạng mp4 stream
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');

    // Chạy FFmpeg live transcode sang H.264 + AAC chuẩn Web
    ffmpeg(driveUrl)
      .inputOptions([
        '-re', // Đọc luồng theo thời gian thực
      ])
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset ultrafast',  // Encode siêu nhanh giảm độ trễ
        '-tune zerolatency',  // Độ trễ gần như bằng 0
        '-movflags frag_keyframe+empty_moov', // Hỗ trợ phát ngay lập tức trên HTML5
        '-pix_fmt yuv420p',   // Chuẩn màu 8-bit mọi trình duyệt xem được
      ])
      .format('mp4')
      .on('start', (cmd) => {
        console.log('Bắt đầu Transcode FFmpeg:', cmd);
      })
      .on('error', (err) => {
        console.error('Lỗi FFmpeg Transcode:', err.message);
        if (!res.headersSent) {
          res.status(500).send('Lỗi Encode Video');
        }
      })
      .pipe(res, { end: true });

  } catch (err) {
    console.error('Lỗi Server:', err);
    res.status(500).send('Lỗi Server Transcode');
  }
});

app.listen(PORT, () => {
  console.log(`Server CineDrive Transcoder đang chạy tại port ${PORT}`);
});
