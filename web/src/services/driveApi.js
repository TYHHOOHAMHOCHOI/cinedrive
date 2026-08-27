/**
 * Google Drive API v3 Service
 */

const API_BASE = 'https://www.googleapis.com/drive/v3';

export class DriveApiService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.cachedCineFolderId = null;
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  /**
   * Lấy ID của thư mục tên "Cine" (hoặc "cine") trên Google Drive
   */
  async findCineFolderId() {
    if (this.cachedCineFolderId) return this.cachedCineFolderId;
    if (!this.accessToken) return null;

    const q = "trashed = false and mimeType = 'application/vnd.google-apps.folder' and (name = 'Cine' or name = 'cine' or name = 'CINE')";
    const url = `${API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id, name)&pageSize=1`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          this.cachedCineFolderId = data.files[0].id;
          return this.cachedCineFolderId;
        }
      }
    } catch (e) {
      console.warn('Lỗi khi tìm thư mục Cine:', e);
    }
    return null;
  }

  /**
   * Lấy danh sách video từ Google Drive (Giới hạn trong thư mục Cine)
   */
  async listVideos(folderId = null, pageToken = null, searchQuery = '') {
    if (!this.accessToken) throw new Error('Chưa đăng nhập Google Drive.');

    let targetFolderId = folderId;
    if (!targetFolderId) {
      targetFolderId = await this.findCineFolderId();
    }

    let queryParts = [
      "trashed = false",
      "(mimeType contains 'video/' or name contains '.mp4' or name contains '.mkv' or name contains '.webm' or name contains '.avi')"
    ];

    if (targetFolderId) {
      queryParts.push(`'${targetFolderId}' in parents`);
    }

    if (searchQuery.trim()) {
      queryParts.push(`name contains '${searchQuery.trim()}'`);
    }

    const q = queryParts.join(' and ');
    const fields = 'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, videoMediaMetadata, parents)';
    
    let url = `${API_BASE}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=100&orderBy=modifiedTime desc`;
    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Lỗi khi tải danh sách video.');
    }

    return await res.json();
  }

  /**
   * Lấy danh sách thư mục con bên trong thư mục Cine (hoặc parentFolderId)
   */
  async listFolders(parentFolderId = null) {
    if (!this.accessToken) throw new Error('Chưa đăng nhập Google Drive.');

    let targetFolderId = parentFolderId;
    if (!targetFolderId) {
      targetFolderId = await this.findCineFolderId();
    }

    if (!targetFolderId) return { files: [] };

    const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and '${targetFolderId}' in parents`;
    const fields = 'files(id, name, modifiedTime)';
    const url = `${API_BASE}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=50&orderBy=name`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Lỗi khi tải danh sách thư mục.');
    }

    return await res.json();
  }

  /**
   * Tìm kiếm các file phụ đề (.srt, .vtt) trong cùng thư mục
   */
  async findSubtitles(folderId) {
    if (!this.accessToken || !folderId) return [];

    const q = `trashed = false and '${folderId}' in parents and (name contains '.srt' or name contains '.vtt')`;
    const fields = 'files(id, name, mimeType)';
    const url = `${API_BASE}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=20`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        return data.files || [];
      }
    } catch (e) {
      console.warn('Không thể tìm phụ đề:', e);
    }
    return [];
  }

  /**
   * Lấy luồng nội dung file phụ đề và chuyển sang định dạng WebVTT
   */
  async fetchSubtitleContent(fileId) {
    const url = this.getStreamUrl(fileId);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  }

  /**
   * Tạo Direct Stream URL qua local proxy /drive-proxy
   */
  getStreamUrl(fileId) {
    if (!this.accessToken || !fileId) return '';
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isLocal) {
      return `/drive-proxy/drive/v3/files/${fileId}?alt=media&access_token=${this.accessToken}`;
    }
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${this.accessToken}`;
  }

  /**
   * Tạo Transcode Stream URL gọi qua Server FFmpeg (Koyeb/Render/Local)
   * Giúp tự động Encode live phim 10-bit Bluray sang H.264/AAC chuẩn Web
   */
  getTranscodeUrl(fileId) {
    if (!this.accessToken || !fileId) return '';
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const defaultServer = isLocal
      ? 'http://localhost:3001'
      : 'https://cinedrive-server-fad2fbfnf7gdefgm.japaneast-01.azurewebsites.net';
    const serverBase = import.meta.env.VITE_TRANSCODER_SERVER_URL || defaultServer;
    return `${serverBase}/stream?fileId=${fileId}&access_token=${this.accessToken}`;
  }
}
