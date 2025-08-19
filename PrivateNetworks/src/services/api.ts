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
    username: string;
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

export interface NetworkLookupResponse {
  success: boolean;
  network: {
    networkId: string;
    name: string;
    description: string;
    creator: string;
    memberCount: number;
    maxMembers: number;
    tier: 'free' | 'pro' | 'enterprise';
    requiresApproval: boolean;
  };
}

export interface JoinNetworkRequest {
  networkId: string;
  inviteCode: string;
  displayName: string;
  message?: string;
}

export interface JoinNetworkResponse {
  success: boolean;
  requestId: string;
  status: 'pending' | 'approved' | 'auto_approved';
}

export interface JoinRequest {
  requestId: string;
  networkId: string;
  networkName: string;
  username: string;
  displayName: string;
  message: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'denied';
}

export interface JoinRequestsResponse {
  success: boolean;
  requests: JoinRequest[];
}

export interface ApproveJoinRequest {
  requestId: string;
  role: 'admin' | 'member' | 'read-only';
}

export interface ApproveJoinResponse {
  success: boolean;
  message: string;
}

export interface PendingJoinRequest {
  requestId: string;
  networkId: string;
  networkName: string;
  networkDescription: string;
  creator: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'denied';
  displayName: string;
  message: string;
}

export interface UserPendingRequestsResponse {
  success: boolean;
  requests: PendingJoinRequest[];
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

  async lookupNetworkByInviteCode(inviteCode: string, token: string): Promise<NetworkLookupResponse> {
    try {
      const response: AxiosResponse<NetworkLookupResponse> = await api.get(
        `/network/invite/${encodeURIComponent(inviteCode)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message;
        
        if (status === 404) {
          throw new Error('Network not found - please check the invite code');
        } else if (status === 410) {
          throw new Error('Invite code has expired');
        } else if (status === 409) {
          throw new Error('You are already a member of this network');
        } else if (message) {
          throw new Error(message);
        }
        
        throw new Error('Failed to lookup network');
      }
      throw error;
    }
  }

  async requestToJoinNetwork(data: JoinNetworkRequest, token: string): Promise<JoinNetworkResponse> {
    try {
      const response: AxiosResponse<JoinNetworkResponse> = await api.post(
        '/network/request-join',
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
        const status = error.response?.status;
        const message = error.response?.data?.message;
        
        if (status === 409) {
          if (message?.includes('already requested')) {
            throw new Error('You have already requested to join this network');
          } else if (message?.includes('already a member')) {
            throw new Error('You are already a member of this network');
          }
          throw new Error('Conflict with existing request or membership');
        } else if (status === 410) {
          throw new Error('This invite code has expired');
        } else if (status === 422) {
          throw new Error('Network is full and cannot accept new members');
        } else if (message) {
          throw new Error(message);
        }
        
        throw new Error('Failed to send join request');
      }
      throw error;
    }
  }

  async getNetworkJoinRequests(networkId: string, token: string): Promise<JoinRequest[]> {
    try {
      const response: AxiosResponse<JoinRequestsResponse> = await api.get(
        `/network/${encodeURIComponent(networkId)}/requests`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response.data.requests;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message;
        
        if (status === 403) {
          throw new Error('You do not have permission to view join requests for this network');
        } else if (status === 404) {
          throw new Error('Network not found');
        } else if (message) {
          throw new Error(message);
        }
        
        throw new Error('Failed to fetch join requests');
      }
      throw error;
    }
  }

  async approveJoinRequest(
    networkId: string,
    requestId: string,
    role: 'admin' | 'member' | 'read-only',
    token: string
  ): Promise<ApproveJoinResponse> {
    try {
      const response: AxiosResponse<ApproveJoinResponse> = await api.post(
        `/network/${encodeURIComponent(networkId)}/approve`,
        {
          requestId,
          role,
          action: 'approve'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message;
        
        if (status === 403) {
          throw new Error('You do not have permission to approve members for this network');
        } else if (status === 404) {
          throw new Error('Join request not found');
        } else if (status === 409) {
          throw new Error('Request has already been processed');
        } else if (status === 422) {
          throw new Error('Network is full and cannot accept new members');
        } else if (message) {
          throw new Error(message);
        }
        
        throw new Error('Failed to approve join request');
      }
      throw error;
    }
  }

  async denyJoinRequest(
    networkId: string,
    requestId: string,
    token: string
  ): Promise<ApproveJoinResponse> {
    try {
      const response: AxiosResponse<ApproveJoinResponse> = await api.post(
        `/network/${encodeURIComponent(networkId)}/approve`,
        {
          requestId,
          action: 'deny'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message;
        
        if (status === 403) {
          throw new Error('You do not have permission to deny members for this network');
        } else if (status === 404) {
          throw new Error('Join request not found');
        } else if (status === 409) {
          throw new Error('Request has already been processed');
        } else if (message) {
          throw new Error(message);
        }
        
        throw new Error('Failed to deny join request');
      }
      throw error;
    }
  }

  async getUserPendingRequests(token: string): Promise<PendingJoinRequest[]> {
    try {
      const response: AxiosResponse<UserPendingRequestsResponse> = await api.get(
        '/user/pending-requests',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response.data.requests;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message;
        
        if (status === 404) {
          // No pending requests is not an error
          return [];
        } else if (message) {
          throw new Error(message);
        }
        
        throw new Error('Failed to fetch pending requests');
      }
      throw error;
    }
  }
}

export const authAPI = new AuthAPI();
export default api;