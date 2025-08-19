import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

export interface StoredNetwork {
  networkId: string;
  name: string;
  description: string;
  inviteCode: string;
  myRole: 'admin' | 'member' | 'read-only';
  memberCount: number;
  maxMembers: number;
  tier: 'free' | 'pro' | 'enterprise';
  settings: {
    joinApproval: 'require_admin' | 'auto_approve';
    memberPermissions: 'admin_only' | 'members_can_invite';
    dataRetention: 'forever' | '30_days' | '7_days';
  };
  joinedAt: string;
  createdAt: string;
  isCreator: boolean;
}

const STORAGE_KEYS = {
  USER_ID: 'user_id',
  PUBLIC_KEY: 'public_key',
  AUTH_TOKEN: 'auth_token',
  USER_PROFILE: 'user_profile',
  USER_NETWORKS: 'user_networks', // Will be deprecated in favor of user-specific keys
};

const KEYCHAIN_KEYS = {
  PRIVATE_KEY: 'private_key',
};

class StorageService {
  // Helper method to get user-specific storage key
  private getUserNetworksKey(userId: string): string {
    return `user_networks_${userId}`;
  }

  async storePrivateKey(userId: string, privateKey: string): Promise<void> {
    try {
      const keyName = `${KEYCHAIN_KEYS.PRIVATE_KEY}_${userId}`;
      console.log('Storing private key with keyName:', keyName, 'for userId:', userId);
      await Keychain.setInternetCredentials(
        keyName,
        userId,
        privateKey,
      );
      console.log('Private key stored successfully');
    } catch (error) {
      console.error('Failed to store private key:', error);
      throw new Error('Failed to securely store private key');
    }
  }

  async getPrivateKey(userId: string): Promise<string | null> {
    try {
      const keyName = `${KEYCHAIN_KEYS.PRIVATE_KEY}_${userId}`;
      console.log('Looking for private key with keyName:', keyName, 'for userId:', userId);
      const credentials = await Keychain.getInternetCredentials(keyName);
      
      console.log('Credentials found:', credentials ? 'YES' : 'NO');
      if (credentials && credentials.password) {
        console.log('Private key retrieved successfully');
        return credentials.password;
      }
      console.log('No private key found');
      return null;
    } catch (error) {
      console.error('Failed to retrieve private key:', error);
      return null;
    }
  }

  async removePrivateKey(userId: string): Promise<void> {
    try {
      const server = `${KEYCHAIN_KEYS.PRIVATE_KEY}_${userId}`;
      // Try the newer API format first
      try {
        const result = await Keychain.resetInternetCredentials({server});
        console.log('Private key removal result:', result);
      } catch (newApiError) {
        // Fallback to older API format
        const result = await Keychain.resetInternetCredentials(server);
        console.log('Private key removal result (fallback):', result);
      }
    } catch (error) {
      console.error('Failed to remove private key:', error);
      // The key might not exist, which is okay for our use case
    }
  }

  async storeUserId(userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    } catch (error) {
      console.error('Failed to store user ID:', error);
      throw new Error('Failed to store user ID');
    }
  }

  async getUserId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
    } catch (error) {
      console.error('Failed to get user ID:', error);
      return null;
    }
  }

  async storePublicKey(publicKey: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, publicKey);
    } catch (error) {
      console.error('Failed to store public key:', error);
      throw new Error('Failed to store public key');
    }
  }

  async getPublicKey(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
    } catch (error) {
      console.error('Failed to get public key:', error);
      return null;
    }
  }

  async storeAuthToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    } catch (error) {
      console.error('Failed to store auth token:', error);
      throw new Error('Failed to store auth token');
    }
  }

  async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  async removeAuthToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Failed to remove auth token:', error);
      throw new Error('Failed to remove auth token');
    }
  }

  async storeUserProfile(profile: object): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to store user profile:', error);
      throw new Error('Failed to store user profile');
    }
  }

  async getUserProfile(): Promise<object | null> {
    try {
      const profileStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return profileStr ? JSON.parse(profileStr) : null;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  async removeUserProfile(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    } catch (error) {
      console.error('Failed to remove user profile:', error);
      throw new Error('Failed to remove user profile');
    }
  }

  async clearAllData(): Promise<void> {
    try {
      const userId = await this.getUserId();
      if (userId) {
        await this.removePrivateKey(userId);
        await this.clearUserNetworks(userId);
      }
      
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_ID,
        STORAGE_KEYS.PUBLIC_KEY,
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.USER_PROFILE,
        STORAGE_KEYS.USER_NETWORKS, // Keep for legacy cleanup
      ]);
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw new Error('Failed to clear stored data');
    }
  }

  async hasStoredIdentity(): Promise<boolean> {
    try {
      const userId = await this.getUserId();
      const publicKey = await this.getPublicKey();
      
      if (!userId || !publicKey) {
        return false;
      }
      
      const privateKey = await this.getPrivateKey(userId);
      return !!privateKey;
    } catch (error) {
      console.error('Failed to check stored identity:', error);
      return false;
    }
  }

  // Network storage methods - now user-specific
  async storeNetwork(network: StoredNetwork, userId: string): Promise<void> {
    try {
      const networks = await this.getUserNetworks(userId);
      const existingIndex = networks.findIndex(n => n.networkId === network.networkId);
      
      if (existingIndex >= 0) {
        // Update existing network
        networks[existingIndex] = network;
      } else {
        // Add new network
        networks.push(network);
      }
      
      const userNetworksKey = this.getUserNetworksKey(userId);
      await AsyncStorage.setItem(userNetworksKey, JSON.stringify(networks));
      console.log('Network stored successfully for user:', userId, 'networkId:', network.networkId);
    } catch (error) {
      console.error('Failed to store network:', error);
      throw new Error('Failed to store network');
    }
  }

  async getUserNetworks(userId: string): Promise<StoredNetwork[]> {
    try {
      const userNetworksKey = this.getUserNetworksKey(userId);
      const networksStr = await AsyncStorage.getItem(userNetworksKey);
      return networksStr ? JSON.parse(networksStr) : [];
    } catch (error) {
      console.error('Failed to get user networks for user:', userId, error);
      return [];
    }
  }

  async getNetwork(networkId: string, userId: string): Promise<StoredNetwork | null> {
    try {
      const networks = await this.getUserNetworks(userId);
      return networks.find(n => n.networkId === networkId) || null;
    } catch (error) {
      console.error('Failed to get network:', error);
      return null;
    }
  }

  async removeNetwork(networkId: string, userId: string): Promise<void> {
    try {
      const networks = await this.getUserNetworks(userId);
      const filteredNetworks = networks.filter(n => n.networkId !== networkId);
      const userNetworksKey = this.getUserNetworksKey(userId);
      await AsyncStorage.setItem(userNetworksKey, JSON.stringify(filteredNetworks));
      console.log('Network removed successfully for user:', userId, 'networkId:', networkId);
    } catch (error) {
      console.error('Failed to remove network:', error);
      throw new Error('Failed to remove network');
    }
  }

  async updateNetworkMemberCount(networkId: string, memberCount: number, userId: string): Promise<void> {
    try {
      const networks = await this.getUserNetworks(userId);
      const networkIndex = networks.findIndex(n => n.networkId === networkId);
      
      if (networkIndex >= 0) {
        networks[networkIndex].memberCount = memberCount;
        const userNetworksKey = this.getUserNetworksKey(userId);
        await AsyncStorage.setItem(userNetworksKey, JSON.stringify(networks));
        console.log('Network member count updated for user:', userId, 'networkId:', networkId, memberCount);
      }
    } catch (error) {
      console.error('Failed to update network member count:', error);
    }
  }

  async clearUserNetworks(userId: string): Promise<void> {
    try {
      const userNetworksKey = this.getUserNetworksKey(userId);
      await AsyncStorage.removeItem(userNetworksKey);
      console.log('Networks cleared for user:', userId);
    } catch (error) {
      console.error('Failed to clear networks for user:', userId, error);
    }
  }

  // Legacy method for backward compatibility (will be removed later)
  async clearNetworks(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_NETWORKS);
      console.log('All networks cleared (legacy)');
    } catch (error) {
      console.error('Failed to clear networks:', error);
    }
  }
}

export const storageService = new StorageService();