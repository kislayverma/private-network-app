import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../navigation/AppNavigator';
import {useAuth} from '../context/AuthContext';
import {storageService, StoredNetwork} from '../services/storage';
import {AppHeader} from '../components';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<Props> = ({navigation}) => {
  const {authState, signOut, refreshAuthState} = useAuth();
  const [networks, setNetworks] = useState<StoredNetwork[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadNetworks = async (): Promise<void> => {
    try {
      if (!authState.userProfile?.username) {
        console.log('No user ID available, skipping network load');
        setNetworks([]);
        return;
      }
      
      const userNetworks = await storageService.getUserNetworks(authState.userProfile.username);
      setNetworks(userNetworks);
    } catch (error) {
      console.error('Failed to load networks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Reload networks when screen comes into focus
      loadNetworks();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    loadNetworks();
  }, []);

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

  const signOutKeepIdentity = async (): void => {
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
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      <AppHeader 
        title="Networks" 
        showLogoutButton={true}
      />

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingState}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : networks.length > 0 ? (
          <View style={styles.networksState}>
            <TouchableOpacity 
              style={styles.networksCard}
              onPress={() => navigation.navigate('NetworksList')}>
              <Text style={styles.networksTitle}>My Networks</Text>
              <Text style={styles.networksCount}>{networks.length}</Text>
              <Text style={styles.networksSubtitle}>
                {networks.filter(n => n.isCreator).length} created • {networks.filter(n => !n.isCreator).length} joined
              </Text>
              <Text style={styles.viewAllText}>Tap to view all →</Text>
            </TouchableOpacity>

            <View style={styles.recentNetworks}>
              <Text style={styles.recentTitle}>Recent Networks</Text>
              {networks.slice(0, 3).map((network) => (
                <TouchableOpacity 
                  key={network.networkId}
                  style={styles.networkItem}
                  onPress={() => navigation.navigate('NetworksList')}>
                  <View style={styles.networkItemContent}>
                    <Text style={styles.networkItemName}>{network.name}</Text>
                    <View style={styles.networkItemBadge}>
                      <Text style={styles.networkItemBadgeText}>{network.myRole}</Text>
                    </View>
                  </View>
                  <Text style={styles.networkItemStats}>
                    {network.memberCount}/{network.maxMembers} members
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📱</Text>
            <Text style={styles.emptyTitle}>No networks yet</Text>
            <Text style={styles.emptySubtitle}>
              Join your first network or create one for your group
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.navigate('NetworkSetup')}>
            <Text style={styles.primaryButtonText}>Create Network</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Join with Invite Code</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingState: {
    alignItems: 'center',
    marginBottom: 48,
  },
  loadingText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  networksState: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 20,
  },
  networksCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#374151',
  },
  networksTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  networksCount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 8,
  },
  networksSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  recentNetworks: {
    marginBottom: 32,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  networkItem: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  networkItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  networkItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1,
  },
  networkItemBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  networkItemBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  networkItemStats: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyState: {
    alignItems: 'center',
    marginBottom: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  secondaryButtonText: {
    color: '#6366f1',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default HomeScreen;