import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import {storageService} from '../services/storage';
import {authAPI, UserProfile} from '../services/api';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userProfile: UserProfile | null;
  token: string | null;
}

interface AuthContextType {
  authState: AuthState;
  signOut: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({children}) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    userProfile: null,
    token: null,
  });

  const checkAuthState = async (): Promise<void> => {
    try {
      const token = await storageService.getAuthToken();
      const userId = await storageService.getUserId();
      
      if (!token || !userId) {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          userProfile: null,
          token: null,
        });
        return;
      }

      // Try to get stored user profile first
      let userProfile = await storageService.getUserProfile() as UserProfile | null;
      
      // If no stored profile or token is available, try to fetch from API
      if (!userProfile) {
        try {
          userProfile = await authAPI.getUserProfile(token);
          await storageService.storeUserProfile(userProfile);
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
          // Token might be expired, clear auth state
          await signOut();
          return;
        }
      }

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        userProfile,
        token,
      });
    } catch (error) {
      console.error('Auth state check failed:', error);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        userProfile: null,
        token: null,
      });
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      // Set loading state during sign out
      setAuthState(prev => ({...prev, isLoading: true}));
      
      await storageService.clearAllData();
      
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        userProfile: null,
        token: null,
      });
    } catch (error) {
      console.error('Sign out failed:', error);
      // Even if clearing data fails, we should still sign out
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        userProfile: null,
        token: null,
      });
    }
  };

  const refreshAuthState = async (): Promise<void> => {
    setAuthState(prev => ({...prev, isLoading: true}));
    await checkAuthState();
  };

  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  const contextValue: AuthContextType = {
    authState,
    signOut,
    refreshAuthState,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};