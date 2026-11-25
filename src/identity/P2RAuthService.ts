export interface P2RUser {
  id: number | string;
  name: string;
  email: string;
}

export interface P2RLoginResult {
  success: boolean;
  token?: string;
  user?: P2RUser;
  message: string;
}

export class P2RAuthService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'https://pameran.devsaka.id/api/v1') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public async login(email: string, password: string): Promise<P2RLoginResult> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || !data.success) {
        const errorMsg =
          data?.message ||
          (data?.errors ? Object.values(data.errors).flat().join(', ') : `Login failed (HTTP ${response.status})`);
        return {
          success: false,
          message: errorMsg,
        };
      }

      const token = data.data?.token;
      const user = data.data?.user;

      if (!token || !user) {
        return {
          success: false,
          message: 'Malformed response: missing token or user data.',
        };
      }

      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
        },
        message: 'Login successful.',
      };
    } catch (err) {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      return {
        success: false,
        message: isOffline
          ? 'Network is offline. Please check your internet connection.'
          : (err instanceof Error ? err.message : 'Unable to connect to login server.'),
      };
    }
  }
}
