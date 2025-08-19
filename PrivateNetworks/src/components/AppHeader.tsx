import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../navigation/AppNavigator';
import {useAuth} from '../context/AuthContext';
import {storageService} from '../services/storage';

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface Props {
  title: string;
  showHomeButton?: boolean;
  showBackButton?: boolean;
  showLogoutButton?: boolean;
  onBackPress?: () => void;
}

const AppHeader: React.FC<Props> = ({
  title,
  showHomeButton = false,
  showBackButton = false,
  showLogoutButton = true,
  onBackPress,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const {authState, signOut, refreshAuthState} = useAuth();

  const handleHomePress = (): void => {
    navigation.navigate('Home');
  };

  const handleBackPress = (): void => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  const handleSignOut = (): void => {
    Alert.alert(
      'Sign Out Options',
      'Choose how you want to sign out:',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Sign Out (Keep Identity)',
          onPress: signOutKeepIdentity,
        },
        {
          text: 'Complete Sign Out',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  };

  const signOutKeepIdentity = async (): Promise<void> => {
    try {
      // Clear auth token and profile but keep private key
      await storageService.removeAuthToken();
      await storageService.removeUserProfile();
      
      // Refresh auth state to show welcome screen
      await refreshAuthState();
    } catch (error) {
      console.error('Sign out (keep identity) failed:', error);
      // Fallback to complete sign out
      await signOut();
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.leftSection}>
        {showHomeButton && (
          <TouchableOpacity onPress={handleHomePress} style={styles.iconButton}>
            <Text style={styles.homeIcon}>🏠</Text>
          </TouchableOpacity>
        )}
        {showBackButton && (
          <TouchableOpacity onPress={handleBackPress} style={styles.iconButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.centerSection}>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <View style={styles.rightSection}>
        {showLogoutButton && (
          <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
            <Text style={styles.logoutIcon}>👤</Text>
            <Text style={styles.username}>
              @{authState.userProfile?.username || 'user'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    minHeight: 60,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  homeIcon: {
    fontSize: 20,
  },
  backIcon: {
    fontSize: 24,
    color: '#6366f1',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  logoutIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  username: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
    maxWidth: 80,
  },
});

export default AppHeader;