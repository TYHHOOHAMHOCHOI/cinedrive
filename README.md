# 🎬 CineDrive — 5TB Personal Cloud Movie Streamer

> Hệ thống Web & Android App xem phim cá nhân trực tiếp từ Google Drive 5TB, thay thế hoàn toàn trình phát mặc định của Drive bằng trình phát điện ảnh chất lượng cao, hỗ trợ Range Request (HTTP 206) để tua tức thì, nạp phụ đề rời và ghi nhớ tiến độ xem.

---

## 📁 Cấu trúc thư mục dự án

```
d:/F_APP/
├── web/                          # Ứng dụng Web (React + Vite + Artplayer + Google GIS)
│   ├── src/
│   │   ├── components/           # Navbar, MovieCard, VideoPlayer, FolderBrowser
│   │   ├── services/             # googleAuth.js, driveApi.js, historyService.js
│   │   ├── styles/               # index.css (Dark Mode điện ảnh)
│   │   ├── App.jsx               # Giao diện chính
│   │   └── main.jsx
│   ├── index.html                # Tích hợp Google Identity Services SDK
│   ├── package.json
│   └── .env.example
│
├── android/                      # Ứng dụng Android (Kotlin + Media3 ExoPlayer)
│   ├── app/src/main/
│   │   ├── java/com/cinedrive/app/
│   │   │   ├── player/           # DriveExoPlayer.kt (Range Request stream)
│   │   │   ├── auth/             # GoogleAuthManager.kt (Google Sign-In)
│   │   │   └── api/              # DriveApiService.kt (REST API v3)
│   │   └── AndroidManifest.xml
│
└── shared/                       # Cấu hình chung, Scopes, Constants
    └── constants.js
```

---

## 🚀 Hướng dẫn chạy Web Client

```bash
# Di chuyển vào thư mục web
cd web

# Cài đặt gói thư viện (nếu chưa)
npm install

# Khởi động dev server
npm run dev
```

Truy cập: `http://localhost:5173`
