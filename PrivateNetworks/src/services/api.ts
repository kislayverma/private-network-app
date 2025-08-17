import axios, {AxiosResponse} from 'axios';

const API_BASE_URL = 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface RegisterRequest {
  userId: string;
  publicKey: string;
  email: string;
  phone?: string;
}

export interface RegisterResponse {
  success: boolean;
  userId: string;
  created: string;
}

export interface LoginRequest {
  userId: string;
  signature: string;
  timestamp: number;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  userId: string;
}

export interface UserProfile {
  userId: string;
  publicKey: string;
  email: string;
  created: string;
  networks: string[];
  subscription: string;
}

export interface CheckUsernameResponse {
  available: boolean;
  userId: string;
}

class AuthAPI {
  async checkUsername(username: string): Promise<CheckUsernameResponse> {
    try {
      const response: AxiosResponse<CheckUsernameResponse> = await api.get(
        `/auth/check-username/${username}`,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return {available: true, userId: username};
      }
      throw error;
    }
  }

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    try {
      const response: AxiosResponse<RegisterResponse> = await api.post(
        '/auth/register',
        data,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Registration failed');
      }
      throw error;
    }
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    try {
      const response: AxiosResponse<LoginResponse> = await api.post(
        '/auth/login',
        data,
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Login failed');
      }
      throw error;
    }
  }

  async getUserProfile(token: string): Promise<UserProfile> {
    try {
      const response: AxiosResponse<UserProfile> = await api.get(
        '/user/profile',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Failed to get profile');
      }
      throw error;
    }
  }
}

export const authAPI = new AuthAPI();
export default api;