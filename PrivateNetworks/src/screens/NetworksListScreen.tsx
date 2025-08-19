import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../navigation/AppNavigator';
import {useAuth} from '../context/AuthContext';
import {storageService, StoredNetwork} from '../services/storage';
import {AppHeader} from '../components';

type NetworksListScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'NetworksList'
>;

interface Props {
  navigation: NetworksListScreenNavigationProp;
}

const NetworksListScreen: React.FC<Props> = ({navigation}) => {
  const {authState, signOut, refreshAuthState} = useAuth();
  const [networks, setNetworks] = useState<StoredNetwork[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadNetworks = async (): Promise<void> => {
    try {
      if (!authState.userProfile?.username) {
        console.log('No user ID available, skipping network load');
        setNetworks([]);
        return;
      }
      
      const userNetworks = await storageService.getUserNetworks(authState.userProfile.username);
      setNetworks(userNetworks.sort((a, b) => {
        // Sort by: created networks first, then by creation date
        if (a.isCreator && !b.isCreator) return -1;
        if (!a.isCreator && b.isCreator) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }));
    } catch (error) {
      console.error('Failed to load networks:', error);
      Alert.alert('Error', 'Failed to load networks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNetworks();
  }, []);

  const handleRefresh = (): void => {
    setRefreshing(true);
    loadNetworks();
  };

  const handleCreateNetwork = (): void => {
    navigation.navigate('NetworkSetup');
  };

  const handleJoinNetwork = (): void => {
    // TODO: Implement join network flow
    Alert.alert('Coming Soon', 'Join network feature will be implemented soon');
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

  const handleNetworkPress = (network: StoredNetwork): void => {
    // TODO: Navigate to network details/chat
    Alert.alert(
      network.name,
      `Role: ${network.myRole}\nMembers: ${network.memberCount}/${network.maxMembers}\nInvite Code: ${network.inviteCode}`,
      [
        {text: 'Copy Invite Code', onPress: () => copyInviteCode(network.inviteCode)},
        {text: 'OK'},
      ]
    );
  };

  const copyInviteCode = async (inviteCode: string): Promise<void> => {
    try {
      const {Clipboard} = require('react-native');
      await Clipboard.setString(inviteCode);
      Alert.alert('Copied', 'Invite code copied to clipboard');
    } catch (error) {
      console.error('Failed to copy invite code:', error);
    }
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'admin':
        return '#f59e0b';
      case 'member':
        return '#10b981';
      case 'read-only':
        return '#6b7280';
      default:
        return '#9ca3af';
    }
  };

  const getRoleBadgeStyle = (role: string) => ({
    ...styles.roleBadge,
    backgroundColor: getRoleColor(role),
  });

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffTime = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const renderNetworkItem = ({item}: {item: StoredNetwork}) => (
    <TouchableOpacity
      style={styles.networkCard}
      onPress={() => handleNetworkPress(item)}
      activeOpacity={0.7}>
      <View style={styles.networkHeader}>
        <View style={styles.networkTitleContainer}>
          <Text style={styles.networkName}>{item.name}</Text>
          {item.isCreator && <Text style={styles.creatorBadge}>Creator</Text>}
        </View>
        <View style={getRoleBadgeStyle(item.myRole)}>
          <Text style={styles.roleBadgeText}>{item.myRole.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.networkDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.networkStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Members</Text>
          <Text style={styles.statValue}>
            {item.memberCount}/{item.maxMembers}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Tier</Text>
          <Text style={styles.statValue}>{item.tier}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Joined</Text>
          <Text style={styles.statValue}>{formatDate(item.joinedAt)}</Text>
        </View>
      </View>

      <View style={styles.networkFooter}>
        <Text style={styles.networkId}>ID: {item.networkId}</Text>
        <Text style={styles.inviteCode}>{item.inviteCode}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📱</Text>
      <Text style={styles.emptyTitle}>No networks yet</Text>
      <Text style={styles.emptySubtitle}>
        Join your first network or create one for your group
      </Text>
      <View style={styles.emptyButtonContainer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleCreateNetwork}>
          <Text style={styles.primaryButtonText}>Create Network</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleJoinNetwork}>
          <Text style={styles.secondaryButtonText}>Join with Invite Code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      
      <AppHeader 
        title="My Networks" 
        showHomeButton={true}
        showLogoutButton={true}
      />

      {networks.length > 0 ? (
        <FlatList
          data={networks}
          renderItem={renderNetworkItem}
          keyExtractor={item => item.networkId}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#6366f1"
              colors={['#6366f1']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading networks...</Text>
        </View>
      ) : (
        renderEmptyState()
      )}

      {networks.length > 0 && (
        <View style={styles.floatingButtonContainer}>
          <TouchableOpacity style={styles.floatingButton} onPress={handleCreateNetwork}>
            <Text style={styles.floatingButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  listContainer: {
    padding: 16,
  },
  networkCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  networkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  networkTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 8,
  },
  creatorBadge: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  networkDescription: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
    marginBottom: 12,
  },
  networkStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  networkFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  networkId: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  inviteCode: {
    fontSize: 12,
    color: '#6366f1',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
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
    marginBottom: 32,
  },
  emptyButtonContainer: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  floatingButton: {
    width: 56,
    height: 56,
    backgroundColor: '#6366f1',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  floatingButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default NetworksListScreen;