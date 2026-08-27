/**
 * Google Authentication Service (Google Identity Services Token Client)
 */

export class GoogleAuthService {
  constructor(clientId, onTokenReceived, onError) {
    this.clientId = clientId;
    this.onTokenReceived = onTokenReceived;
    this.onError = onError;
    this.tokenClient = null;
    this.accessToken = localStorage.getItem('cinedrive_access_token') || null;
    this.userProfile = JSON.parse(localStorage.getItem('cinedrive_user_profile') || 'null');
  }

  /**
   * Khởi tạo Google Token Client
   */
  init() {
    if (typeof window === 'undefined' || !window.google) {
      console.warn('Google Identity Services SDK chưa sẵn sàng.');
      return;
    }

    if (!this.clientId) {
      console.warn('Chưa cấu hình Google Client ID.');
      return;
    }

    try {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (response) => {
          if (response.error) {
            console.error('Google Auth Error:', response);
            if (this.onError) this.onError(response);
            return;
          }

          this.accessToken = response.access_token;
          localStorage.setItem('cinedrive_access_token', this.accessToken);
          
          // Lấy thông tin user profile
          const profile = await this.fetchUserProfile(this.accessToken);
          this.userProfile = profile;
          localStorage.setItem('cinedrive_user_profile', JSON.stringify(profile));

          if (this.onTokenReceived) {
            this.onTokenReceived(this.accessToken, profile);
          }
        },
      });
    } catch (err) {
      console.error('Lỗi khởi tạo Google Token Client:', err);
    }
  }

  /**
   * Kích hoạt popup đăng nhập Google
   */
  signIn() {
    if (!this.tokenClient) {
      this.init();
    }
    if (this.tokenClient) {
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      alert('Vui lòng kiểm tra lại Google Client ID hoặc kết nối mạng.');
    }
  }

  /**
   * Đăng xuất
   */
  signOut() {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('Token revoked.');
      });
    }
    this.accessToken = null;
    this.userProfile = null;
    localStorage.removeItem('cinedrive_access_token');
    localStorage.removeItem('cinedrive_user_profile');
  }

  /**
   * Lấy thông tin cơ bản của User
   */
  async fetchUserProfile(token) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Không thể lấy thông tin User Profile:', e);
    }
    return null;
  }
}
