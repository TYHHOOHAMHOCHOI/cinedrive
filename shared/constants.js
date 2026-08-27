/**
 * Shared Constants for CineDrive (Web & Mobile)
 */

export const GOOGLE_CONFIG = {
  // Scopes cần thiết để đọc file trên Google Drive một cách an toàn
  SCOPES: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' '),

  // Endpoint API của Google Drive v3
  API_BASE_URL: 'https://www.googleapis.com/drive/v3',
  UPLOAD_BASE_URL: 'https://www.googleapis.com/upload/drive/v3',
  USERINFO_URL: 'https://www.googleapis.com/oauth2/v3/userinfo',

  // Query filter mặc định để lấy các định dạng video
  VIDEO_MIME_TYPES: [
    "mimeType contains 'video/'",
    "name contains '.mp4'",
    "name contains '.mkv'",
    "name contains '.webm'",
    "name contains '.avi'",
    "name contains '.mov'",
  ],

  // Query filter cho file phụ đề
  SUBTITLE_MIME_TYPES: [
    "name contains '.srt'",
    "name contains '.vtt'",
    "name contains '.ass'",
  ],
};

export const APP_CONFIG = {
  APP_NAME: 'CineDrive',
  VERSION: '1.0.0',
  DEFAULT_PAGE_SIZE: 50,
  HISTORY_STORAGE_KEY: 'cinedrive_watch_history_v1',
  SETTINGS_STORAGE_KEY: 'cinedrive_settings_v1',
  AUTH_STORAGE_KEY: 'cinedrive_auth_token_v1',
};

export const PLAYER_CONFIG = {
  SEEK_STEP_SECONDS: 10,
  VOLUME_STEP: 0.1,
  PLAYBACK_RATES: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
  AUTO_PLAY: true,
  REMEMBER_POSITION: true,
};
