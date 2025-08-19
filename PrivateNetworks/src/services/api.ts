import axios, {AxiosResponse} from 'axios';
import {Platform} from 'react-native';

const API_BASE_URL = __DEV__ 
  ? Platform.OS === 'ios' 
    ? 'http://127.0.0.1:3001/api'
    : 'http://10.0.2.2:3001/api'
  : 'https://your-production-api.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});
api.interceptors.request.use(request => {
  console.log('Starting Request', JSON.stringify(request))
  return request
});
    
api.interceptors.response.use(response => {
  console.log('Response:', JSON.stringify(response))
  return response
});

export interface RegisterRequest {
  username: string;
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
  username: string;
  signature: string;
  timestamp: number;
  message: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  userId: string;
}

export interface UserProfile {
  username: string;
  publicKey: string;
  email: string;
  created: string;
  networks: string[];
  subscription: string;
}

export interface CreateNetworkRequest {
  networkName: string;
  description: string;
  networkId: string;
  settings: {
    joinApproval: 'require_admin' | 'auto_approve';
    memberPermissions: 'admin_only' | 'members_can_invite';
    dataRetention: 'forever' | '30_days' | '7_days';
    maxMembers: number;
  };
}

export interface CreateNetworkResponse {
  success: boolean;
  networkId: string;
  inviteCode: string;
  created: string;
}

export interface NetworkDetails {
  networkId: string;
  name: string;
  description: string;
  creator: string;
  admins: string[];
  members: Array<{
    userId: string;
    role: 'admin' | 'member' | 'read-only';
    joinedAt: string;
  }>;
  settings: {
    joinApproval: 'require_admin' | 'auto_approve';
    memberPermissions: 'admin_only' | 'members_can_invite';
    dataRetention: 'forever' | '30_days' | '7_days';
    maxMembers: number;
  };
  billing: {
    tier: 'free' | 'pro' | 'enterprise';
    memberCount: number;
  };
  inviteCode: string;
  created: string;
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
        // throw new Error(error.response?.data?.message || 'Registration failed');
      }
      console.log(error);
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

  async createNetwork(data: CreateNetworkRequest, token: string): Promise<CreateNetworkResponse> {
    try {
      const response: AxiosResponse<CreateNetworkResponse> = await api.post(
        '/network/create',
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Failed to create network');
      }
      throw error;
    }
  }

  async getNetwork(networkId: string, token: string): Promise<NetworkDetails> {
    try {
      const response: AxiosResponse<NetworkDetails> = await api.get(
        `/network/${networkId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Failed to get network details');
      }
      throw error;
    }
  }

  async getUserNetworks(token: string): Promise<NetworkDetails[]> {
    try {
      const response: AxiosResponse<{networks: NetworkDetails[]}> = await api.get(
        '/user/networks',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response.data.networks;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Failed to get user networks');
      }
      throw error;
    }
  }
}

export const authAPI = new AuthAPI();
export default api;