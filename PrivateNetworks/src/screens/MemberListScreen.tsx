import React, {useState, useEffect, useCallback} from 'react';
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
  ActivityIndicator,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../navigation/AppNavigator';
import {useAuth} from '../context/AuthContext';
import {peerManager, PeerStatus} from '../services/peerManager';
import {storageService} from '../services/storage';
import {AppHeader} from '../components';

type MemberListScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'MemberList'
>;

type MemberListScreenRouteProp = RouteProp<
  RootStackParamList,
  'MemberList'
>;

interface Props {
  navigation: MemberListScreenNavigationProp;
  route: MemberListScreenRouteProp;
}

interface MemberInfo {
  userId: string;
  username: string;
  role: 'admin' | 'member' | 'read-only';
  status: 'direct' | 'relay' | 'offline';
  connectionPath?: string;
  lastSeen: number;
  isOnline: boolean;
}

const MemberListScreen: React.FC<Props> = ({navigation, route}) => {
  const {networkId, networkName} = route.params;
  const {authState} = useAuth();
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeConnections, setActiveConnections] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const handleBack = (): void => {
    navigation.goBack();
  };

  const loadMembers = useCallback(async (): Promise<void> => {
    try {
      // Get network members from storage and combine with P2P status
      if (!authState.userProfile?.username) {
        console.log('No user profile available');
        return;
      }

      // Load network members from stored network data
      const storedNetworks = await storageService.getUserNetworks(authState.userProfile.username);
      const currentNetwork = storedNetworks.find(n => n.networkId === networkId);
      
      // Create member list from network data or use mock data
      let baseMembers: MemberInfo[] = [];
      
      if (currentNetwork) {
        // TODO: Get actual member list from network API or storage
        // For now, create a basic member entry for the current user
        baseMembers = [
          {
            userId: authState.userProfile.username,
            username: authState.userProfile.username,
            role: currentNetwork.myRole,
            status: 'offline',
            lastSeen: Date.now(),
            isOnline: true, // Current user is always "online"
          },
        ];
      } else {
        // Fallback mock data if network not found
        baseMembers = [
          {
            userId: 'alice123',
            username: 'alice',
            role: 'admin',
            status: 'offline',
            lastSeen: Date.now() - 300000, // 5 minutes ago
            isOnline: false,
          },
          {
            userId: 'bob456',
            username: 'bob',
            role: 'member',
            status: 'offline',
            lastSeen: Date.now() - 600000, // 10 minutes ago
            isOnline: false,
          },
          {
            userId: 'charlie789',
            username: 'charlie',
            role: 'member',
            status: 'offline',
            lastSeen: Date.now() - 120000, // 2 minutes ago
            isOnline: false,
          },
        ];
      }

      // Get P2P status for each member if PeerManager is available
      try {
        const networkMembersStatus = peerManager.getNetworkMembers();
        const updatedMembers = baseMembers.map(member => {
          const peerStatus = networkMembersStatus.get(member.userId);
          if (peerStatus) {
            return {
              ...member,
              status: peerStatus.status,
              connectionPath: peerStatus.connectionPath,
              lastSeen: peerStatus.lastSeen,
              isOnline: peerStatus.status !== 'offline',
            };
          }
          return member;
        });
        
        setMembers(updatedMembers);
        setActiveConnections(peerManager.getActiveConnectionsCount());
      } catch (peerError) {
        console.warn('PeerManager not available, using base member data:', peerError);
        setMembers(baseMembers);
        setActiveConnections(0);
      }
    } catch (error) {
      console.error('Failed to load members:', error);
      Alert.alert('Error', 'Failed to load network members');
      
      // Fallback to empty state
      setMembers([]);
      setActiveConnections(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authState.userProfile?.username, networkId]);

  const initializePeerManager = useCallback(async (): Promise<void> => {
    if (!authState.userProfile?.username || !authState.token) {
      return;
    }

    try {
      setIsInitializing(true);
      await peerManager.initialize(networkId, authState.userProfile.username, authState.token);
      console.log('PeerManager initialized for network:', networkId);
    } catch (error) {
      console.error('Failed to initialize PeerManager:', error);
      console.warn('P2P connections may be limited. Continuing with basic functionality.');
      // Don't show alert for this - just log and continue
    } finally {
      setIsInitializing(false);
    }
  }, [networkId, authState.userProfile?.username, authState.token]);

  const setupPeerManagerListeners = useCallback((): (() => void) => {
    try {
      const handlePeerStatusUpdate = (userId: string, status: PeerStatus) => {
        setMembers(prevMembers => 
          prevMembers.map(member => 
            member.userId === userId 
              ? {
                  ...member,
                  status: status.status,
                  connectionPath: status.connectionPath,
                  lastSeen: status.lastSeen,
                  isOnline: status.status !== 'offline',
                }
              : member
          )
        );
      };

      const handlePeerConnected = (userId: string) => {
        console.log('Peer connected:', userId);
        try {
          setActiveConnections(peerManager.getActiveConnectionsCount());
        } catch (error) {
          console.warn('Failed to get active connections count:', error);
        }
      };

      const handlePeerDisconnected = (userId: string) => {
        console.log('Peer disconnected:', userId);
        try {
          setActiveConnections(peerManager.getActiveConnectionsCount());
        } catch (error) {
          console.warn('Failed to get active connections count:', error);
        }
      };

      const handleNetworkStateUpdate = (networkState: any) => {
        console.log('Network state updated:', networkState);
        // Update member statuses based on network state
        setMembers(prevMembers => 
          prevMembers.map(member => ({
            ...member,
            isOnline: networkState.onlineMembers.includes(member.userId),
            status: networkState.onlineMembers.includes(member.userId) 
              ? (member.status === 'offline' ? 'relay' : member.status)
              : 'offline'
          }))
        );
      };

      // Add event listeners
      peerManager.on('peerStatusUpdate', handlePeerStatusUpdate);
      peerManager.on('peerConnected', handlePeerConnected);
      peerManager.on('peerDisconnected', handlePeerDisconnected);
      peerManager.on('networkStateUpdate', handleNetworkStateUpdate);

      // Return cleanup function
      return () => {
        try {
          peerManager.off('peerStatusUpdate', handlePeerStatusUpdate);
          peerManager.off('peerConnected', handlePeerConnected);
          peerManager.off('peerDisconnected', handlePeerDisconnected);
          peerManager.off('networkStateUpdate', handleNetworkStateUpdate);
        } catch (error) {
          console.warn('Failed to remove peer manager listeners:', error);
        }
      };
    } catch (error) {
      console.warn('Failed to setup peer manager listeners:', error);
      // Return empty cleanup function
      return () => {};
    }
  }, []);

  useEffect(() => {
    const cleanup = setupPeerManagerListeners();
    initializePeerManager().then(() => {
      loadMembers();
    });

    return cleanup;
  }, [setupPeerManagerListeners, initializePeerManager, loadMembers]);

  const handleRefresh = (): void => {
    setRefreshing(true);
    loadMembers();
  };

  const handleTestSQLite = async (): void => {
    try {
      Alert.alert('Testing SQLite...', 'Running storage tests...');
      const success = await peerManager.testStorage();
      if (success) {
        Alert.alert('✅ SQLite Test Passed', 'All storage operations working correctly!');
      } else {
        Alert.alert('❌ SQLite Test Failed', 'Storage operations encountered issues. Check logs for details.');
      }
    } catch (error) {
      console.error('SQLite test error:', error);
      Alert.alert('❌ SQLite Test Error', 'Failed to run storage tests.');
    }
  };

  const handleMemberPress = async (member: MemberInfo): Promise<void> => {
    if (member.userId === authState.userProfile?.username) {
      Alert.alert('Info', 'This is you!');
      return;
    }

    const buttons = [
      {
        text: 'Send Message',
        onPress: () => {
          // TODO: Navigate to chat screen
          console.log('Navigate to chat with:', member.username);
          Alert.alert('Coming Soon', 'Chat functionality will be available in a future update.');
        },
      },
      {
        text: 'Connect',
        onPress: async () => {
          try {
            Alert.alert('Connecting...', `Attempting to connect to ${member.username}`);
            
            try {
              const connection = await peerManager.connectToPeer(member.userId);
              if (connection) {
                Alert.alert('Success', `Connected to ${member.username}`);
              } else {
                Alert.alert('Failed', `Could not connect to ${member.username}`);
              }
            } catch (peerError) {
              console.warn('PeerManager connection failed:', peerError);
              Alert.alert('Info', 'P2P connections are not fully configured yet. This feature will be available when WebRTC is set up.');
            }
          } catch (error) {
            console.error('Connection failed:', error);
            Alert.alert('Error', 'Connection failed');
          }
        },
      },
      {text: 'Cancel', style: 'cancel'},
    ];

    Alert.alert(
      member.username,
      `Role: ${member.role}\nStatus: ${getStatusText(member.status)}\nLast seen: ${formatLastSeen(member.lastSeen)}${
        member.connectionPath ? `\nPath: ${member.connectionPath}` : ''
      }`,
      buttons
    );
  };

  const getStatusIcon = (status: 'direct' | 'relay' | 'offline'): string => {
    switch (status) {
      case 'direct':
        return '🟢';
      case 'relay':
        return '🟡';
      case 'offline':
      default:
        return '⚫';
    }
  };

  const getStatusText = (status: 'direct' | 'relay' | 'offline'): string => {
    switch (status) {
      case 'direct':
        return 'Direct P2P';
      case 'relay':
        return 'Via Relay';
      case 'offline':
      default:
        return 'Offline';
    }
  };

  const getStatusColor = (status: 'direct' | 'relay' | 'offline'): string => {
    switch (status) {
      case 'direct':
        return '#10b981';
      case 'relay':
        return '#f59e0b';
      case 'offline':
      default:
        return '#6b7280';
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

  const formatLastSeen = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const renderMemberItem = ({item}: {item: MemberInfo}) => (
    <TouchableOpacity
      style={styles.memberCard}
      onPress={() => handleMemberPress(item)}
      activeOpacity={0.7}>
      <View style={styles.memberHeader}>
        <View style={styles.memberTitleContainer}>
          <Text style={styles.memberName}>{item.username}</Text>
          <Text style={styles.statusIcon}>{getStatusIcon(item.status)}</Text>
        </View>
        <View style={styles.badgesContainer}>
          <View style={[styles.roleBadge, {backgroundColor: getRoleColor(item.role)}]}>
            <Text style={styles.roleBadgeText}>{item.role.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.memberStatus}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, {backgroundColor: getStatusColor(item.status)}]} />
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
        <Text style={styles.lastSeenText}>{formatLastSeen(item.lastSeen)}</Text>
      </View>

      {item.connectionPath && (
        <Text style={styles.connectionPath}>Connected {item.connectionPath}</Text>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>👥</Text>
      <Text style={styles.emptyTitle}>No members found</Text>
      <Text style={styles.emptySubtitle}>
        Network members will appear here when they come online
      </Text>
    </View>
  );

  const renderConnectionStatus = () => (
    <View style={styles.connectionStatusContainer}>
      <View style={styles.connectionStatusItem}>
        <Text style={styles.connectionStatusLabel}>Active Connections:</Text>
        <Text style={styles.connectionStatusValue}>{activeConnections}</Text>
      </View>
      <View style={styles.connectionStatusItem}>
        <Text style={styles.connectionStatusLabel}>Online Members:</Text>
        <Text style={styles.connectionStatusValue}>
          {members.filter(m => m.isOnline).length}
        </Text>
      </View>
    </View>
  );

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
        <AppHeader 
          title={`${networkName} Members`}
          showBackButton={true}
          showLogoutButton={true}
          onBackPress={handleBack}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Initializing P2P connections...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      
      <AppHeader 
        title={`${networkName} Members`}
        showBackButton={true}
        showLogoutButton={true}
        onBackPress={handleBack}
      />

      {renderConnectionStatus()}

      {/* SQLite Test Button */}
      <View style={styles.testButtonContainer}>
        <TouchableOpacity
          style={styles.testButton}
          onPress={handleTestSQLite}
          activeOpacity={0.7}>
          <Text style={styles.testButtonText}>Test SQLite</Text>
        </TouchableOpacity>
      </View>

      {members.length > 0 ? (
        <FlatList
          data={members}
          renderItem={renderMemberItem}
          keyExtractor={item => item.userId}
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
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading members...</Text>
        </View>
      ) : (
        renderEmptyState()
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 16,
  },
  connectionStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  connectionStatusItem: {
    alignItems: 'center',
  },
  connectionStatusLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  connectionStatusValue: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  memberCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  memberTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 8,
  },
  statusIcon: {
    fontSize: 12,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  memberStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#d1d5db',
    fontWeight: '500',
  },
  lastSeenText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  connectionPath: {
    fontSize: 12,
    color: '#6366f1',
    fontStyle: 'italic',
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
  },
  testButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  testButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MemberListScreen;