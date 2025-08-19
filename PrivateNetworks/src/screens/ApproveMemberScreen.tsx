import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../navigation/AppNavigator';
import {useAuth} from '../context/AuthContext';
import {authAPI} from '../services/api';
import {AppHeader} from '../components';

type ApproveMemberScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ApproveMember'
>;

type ApproveMemberScreenRouteProp = RouteProp<
  RootStackParamList,
  'ApproveMember'
>;

interface Props {
  navigation: ApproveMemberScreenNavigationProp;
  route: ApproveMemberScreenRouteProp;
}

type MemberRole = 'admin' | 'member' | 'read-only';

const ApproveMemberScreen: React.FC<Props> = ({navigation, route}) => {
  const {request, networkName} = route.params;
  const [selectedRole, setSelectedRole] = useState<MemberRole>('member');
  const [loading, setLoading] = useState<boolean>(false);
  const {authState} = useAuth();

  const handleBack = (): void => {
    navigation.goBack();
  };

  const handleApprove = async (): Promise<void> => {
    if (!authState.token) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    setLoading(true);

    try {
      await authAPI.approveJoinRequest(
        request.networkId,
        request.requestId,
        selectedRole,
        authState.token
      );

      Alert.alert(
        'Member Approved',
        `${request.displayName} has been approved as a ${selectedRole}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to pending approvals
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to approve member:', error);
      let errorMessage = 'Failed to approve member. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('network full')) {
          errorMessage = 'Network is full. Cannot add more members.';
        } else if (error.message.includes('already approved')) {
          errorMessage = 'This request has already been processed.';
        }
      }
      
      Alert.alert('Approval Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async (): Promise<void> => {
    Alert.alert(
      'Deny Request',
      'Are you sure you want to deny this join request? This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Deny',
          style: 'destructive',
          onPress: async () => {
            if (!authState.token) return;

            setLoading(true);

            try {
              await authAPI.denyJoinRequest(
                request.networkId,
                request.requestId,
                authState.token
              );

              Alert.alert(
                'Request Denied',
                `The join request from ${request.displayName} has been denied`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      navigation.goBack();
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('Failed to deny request:', error);
              Alert.alert('Error', 'Failed to deny request. Please try again.');
            } finally {
              setLoading(false);
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

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const getRoleDescription = (role: MemberRole): string => {
    switch (role) {
      case 'admin':
        return 'Can manage network settings, approve members, and moderate content';
      case 'member':
        return 'Can participate in discussions and invite others (if enabled)';
      case 'read-only':
        return 'Can view content but cannot post or invite others';
      default:
        return '';
    }
  };

  const RoleOption: React.FC<{
    role: MemberRole;
    title: string;
    selected: boolean;
    onPress: () => void;
  }> = ({role, title, selected, onPress}) => (
    <TouchableOpacity
      style={[styles.roleOption, selected && styles.roleOptionSelected]}
      onPress={onPress}
      disabled={loading}>
      <View style={styles.roleHeader}>
        <View style={[styles.radioButton, selected && styles.radioButtonSelected]}>
          {selected && <View style={styles.radioButtonInner} />}
        </View>
        <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>
          {title}
        </Text>
      </View>
      <Text style={[styles.roleDescription, selected && styles.roleDescriptionSelected]}>
        {getRoleDescription(role)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      
      <AppHeader 
        title="Approve Member"
        showBackButton={true}
        showLogoutButton={true}
        onBackPress={handleBack}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        
        <View style={styles.requestInfo}>
          <Text style={styles.username}>@{request.username}</Text>
          <Text style={styles.displayName}>{request.displayName}</Text>
          <Text style={styles.requestDate}>Requested: {formatDate(request.requestedAt)}</Text>
          
          <View style={styles.verificationBadge}>
            <Text style={styles.verificationText}>Identity verified ✓</Text>
          </View>
        </View>

        <View style={styles.messageSection}>
          <Text style={styles.sectionTitle}>Message:</Text>
          <View style={styles.messageContainer}>
            <Text style={styles.messageText}>
              {request.message || 'No message provided'}
            </Text>
          </View>
        </View>

        <View style={styles.roleSection}>
          <Text style={styles.sectionTitle}>Set Role:</Text>
          
          <RoleOption
            role="read-only"
            title="Read-only"
            selected={selectedRole === 'read-only'}
            onPress={() => setSelectedRole('read-only')}
          />
          
          <RoleOption
            role="member"
            title="Member"
            selected={selectedRole === 'member'}
            onPress={() => setSelectedRole('member')}
          />
          
          <RoleOption
            role="admin"
            title="Admin"
            selected={selectedRole === 'admin'}
            onPress={() => setSelectedRole('admin')}
          />
        </View>

        <View style={styles.actionSection}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.approveButton, loading && styles.buttonDisabled]}
              onPress={handleApprove}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.approveButtonText}>Approve</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.denyButton, loading && styles.buttonDisabled]}
              onPress={handleDeny}
              disabled={loading}>
              <Text style={styles.denyButtonText}>Deny</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.cancelButton, loading && styles.buttonDisabled]}
            onPress={handleBack}
            disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  requestInfo: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 4,
  },
  displayName: {
    fontSize: 16,
    color: '#d1d5db',
    marginBottom: 8,
  },
  requestDate: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 16,
  },
  verificationBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  verificationText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  messageSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  messageContainer: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
  },
  messageText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  roleSection: {
    marginBottom: 32,
  },
  roleOption: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleOptionSelected: {
    backgroundColor: '#1e40af',
    borderColor: '#6366f1',
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6b7280',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#ffffff',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d1d5db',
  },
  roleTitleSelected: {
    color: '#ffffff',
  },
  roleDescription: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 18,
    marginLeft: 32,
  },
  roleDescriptionSelected: {
    color: '#e5e7eb',
  },
  actionSection: {
    marginTop: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  denyButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  denyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6b7280',
  },
  cancelButtonText: {
    color: '#d1d5db',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ApproveMemberScreen;