/**
 * Google Authentication Service (Google Identity Services Token Client)
 */

export class GoogleAuthService {
  constructor(clientId, onTokenReceived, onError) {
    this.clientId = clientId || '855696341659-mbcn5sggdk9cvh4bm5jm1gkj2ekkdo9p.apps.googleusercontent.com';
    this.onTokenReceived = onTokenReceived;
    this.onError = onError;
    this.tokenClient = null;
    this.accessToken = localStorage.getItem('cinedrive_access_token') || null;
    this.userProfile = JSON.parse(localStorage.getItem('cinedrive_user_profile') || 'null');
    
    // Tự động khởi tạo
    this.init();
  }

  /**
   * Khởi tạo Google Token Client
   */
  init() {
    if (typeof window === 'undefined') return;

    if (!window.google || !window.google.accounts) {
      // Đợi SDK tải xong
      setTimeout(() => this.init(), 500);
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
            alert(`Lỗi xác thực Google: ${response.error_description || response.error}`);
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
   * Kích hoạt đăng nhập Google
   */
  signIn() {
    if (!this.tokenClient) {
      this.init();
    }
    if (this.tokenClient) {
      try {
        // Dùng prompt: 'select_account' thay vì 'consent' để không bị khóa trên trình duyệt di động
        this.tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch (err) {
        console.error('Không thể mở popup Google Sign-In:', err);
        this.fallbackTokenPrompt();
      }
    } else {
      this.fallbackTokenPrompt();
    }
  }

  /**
   * Nhập Access Token thủ công nếu popup bị trình duyệt chặn
   */
  fallbackTokenPrompt() {
    const manualToken = prompt('Nhập Access Token Google Drive của bạn (hoặc đăng nhập lại trên web):');
    if (manualToken && manualToken.trim()) {
      const cleanToken = manualToken.trim();
      this.accessToken = cleanToken;
      localStorage.setItem('cinedrive_access_token', cleanToken);
      this.fetchUserProfile(cleanToken).then(profile => {
        this.userProfile = profile;
        localStorage.setItem('cinedrive_user_profile', JSON.stringify(profile));
        if (this.onTokenReceived) {
          this.onTokenReceived(cleanToken, profile);
        }
      });
    }
  }

  /**
   * Đăng xuất
   */
  signOut() {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(this.accessToken, () => {
          console.log('Token revoked.');
        });
      } catch (e) {
        console.warn(e);
      }
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
