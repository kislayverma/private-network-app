import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const STORAGE_KEYS = {
  USER_ID: 'user_id',
  PUBLIC_KEY: 'public_key',
  AUTH_TOKEN: 'auth_token',
  USER_PROFILE: 'user_profile',
};

const KEYCHAIN_KEYS = {
  PRIVATE_KEY: 'private_key',
};

class StorageService {
  async storePrivateKey(userId: string, privateKey: string): Promise<void> {
    try {
      await Keychain.setInternetCredentials(
        `${KEYCHAIN_KEYS.PRIVATE_KEY}_${userId}`,
        userId,
        privateKey,
      );
    } catch (error) {
      console.error('Failed to store private key:', error);
      throw new Error('Failed to securely store private key');
    }
  }

  async getPrivateKey(userId: string): Promise<string | null> {
    try {
      const credentials = await Keychain.getInternetCredentials(
        `${KEYCHAIN_KEYS.PRIVATE_KEY}_${userId}`,
      );
      
      if (credentials && credentials.password) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      console.error('Failed to retrieve private key:', error);
      return null;
    }
  }

  async removePrivateKey(userId: string): Promise<void> {
    try {
      await Keychain.resetInternetCredentials(
        `${KEYCHAIN_KEYS.PRIVATE_KEY}_${userId}`,
      );
    } catch (error) {
      console.error('Failed to remove private key:', error);
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

  async clearAllData(): Promise<void> {
    try {
      const userId = await this.getUserId();
      if (userId) {
        await this.removePrivateKey(userId);
      }
      
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_ID,
        STORAGE_KEYS.PUBLIC_KEY,
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.USER_PROFILE,
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
}

export const storageService = new StorageService();