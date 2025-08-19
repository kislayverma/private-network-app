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
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../navigation/AppNavigator';
import {useAuth} from '../context/AuthContext';
import {authAPI} from '../services/api';
import {AppHeader} from '../components';

type PendingApprovalsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PendingApprovals'
>;

type PendingApprovalsScreenRouteProp = RouteProp<
  RootStackParamList,
  'PendingApprovals'
>;

interface Props {
  navigation: PendingApprovalsScreenNavigationProp;
  route: PendingApprovalsScreenRouteProp;
}

interface JoinRequest {
  requestId: string;
  networkId: string;
  networkName: string;
  username: string;
  displayName: string;
  message: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'denied';
}

const PendingApprovalsScreen: React.FC<Props> = ({navigation, route}) => {
  const {networkId, networkName} = route.params;
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const {authState} = useAuth();

  const loadJoinRequests = async (): Promise<void> => {
    if (!authState.token) return;
    
    try {
      const requests = await authAPI.getNetworkJoinRequests(networkId, authState.token);
      setJoinRequests(requests.filter(req => req.status === 'pending'));
    } catch (error) {
      console.error('Failed to load join requests:', error);
      Alert.alert('Error', 'Failed to load pending requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadJoinRequests();
  }, [networkId, authState.token]);

  const handleRefresh = (): void => {
    setRefreshing(true);
    loadJoinRequests();
  };

  const handleBack = (): void => {
    navigation.goBack();
  };

  const handleViewRequest = (request: JoinRequest): void => {
    navigation.navigate('ApproveMember', {
      request,
      networkName,
    });
  };

  const handleQuickApprove = async (requestId: string): Promise<void> => {
    if (!authState.token) return;

    try {
      await authAPI.approveJoinRequest(
        networkId,
        requestId,
        'member',
        authState.token
      );
      
      // Remove the approved request from the list
      setJoinRequests(prev => prev.filter(req => req.requestId !== requestId));
      
      Alert.alert('Success', 'Member approved successfully');
    } catch (error) {
      console.error('Failed to approve request:', error);
      Alert.alert('Error', 'Failed to approve member. Please try again.');
    }
  };

  const handleQuickDeny = async (requestId: string): Promise<void> => {
    if (!authState.token) return;

    Alert.alert(
      'Deny Request',
      'Are you sure you want to deny this join request?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Deny',
          style: 'destructive',
          onPress: async () => {
            try {
              await authAPI.denyJoinRequest(networkId, requestId, authState.token);
              
              // Remove the denied request from the list
              setJoinRequests(prev => prev.filter(req => req.requestId !== requestId));
              
              Alert.alert('Request Denied', 'The join request has been denied');
            } catch (error) {
              console.error('Failed to deny request:', error);
              Alert.alert('Error', 'Failed to deny request. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffTime = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));

      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const renderJoinRequest = ({item}: {item: JoinRequest}) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.userInfo}>
          <Text style={styles.username}>@{item.username}</Text>
          <Text style={styles.displayName}>{item.displayName}</Text>
        </View>
        <Text style={styles.timestamp}>{formatDate(item.requestedAt)}</Text>
      </View>

      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          {item.message || 'No message provided'}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => handleViewRequest(item)}>
          <Text style={styles.viewButtonText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.approveButton}
          onPress={() => handleQuickApprove(item.requestId)}>
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.denyButton}
          onPress={() => handleQuickDeny(item.requestId)}>
          <Text style={styles.denyButtonText}>Deny</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>✅</Text>
      <Text style={styles.emptyTitle}>No pending requests</Text>
      <Text style={styles.emptySubtitle}>
        All join requests have been reviewed for this network
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      
      <AppHeader 
        title={`${networkName} - Approvals`}
        showBackButton={true}
        showLogoutButton={true}
        onBackPress={handleBack}
      />

      <View style={styles.content}>
        <View style={styles.headerInfo}>
          <Text style={styles.sectionTitle}>Pending Approvals</Text>
          {joinRequests.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{joinRequests.length}</Text>
            </View>
          )}
        </View>

        {joinRequests.length > 0 ? (
          <FlatList
            data={joinRequests}
            renderItem={renderJoinRequest}
            keyExtractor={item => item.requestId}
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
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          renderEmptyState()
        )}
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  countBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 16,
  },
  requestCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 2,
  },
  displayName: {
    fontSize: 14,
    color: '#d1d5db',
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  messageContainer: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#374151',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  denyButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  denyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
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
});

export default PendingApprovalsScreen;