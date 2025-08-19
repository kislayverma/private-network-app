import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
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
import {storageService} from '../services/storage';
import {AppHeader} from '../components';

type NetworkDetailsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'NetworkDetails'
>;

type NetworkDetailsScreenRouteProp = RouteProp<
  RootStackParamList,
  'NetworkDetails'
>;

interface Props {
  navigation: NetworkDetailsScreenNavigationProp;
  route: NetworkDetailsScreenRouteProp;
}

interface NetworkInfo {
  networkId: string;
  name: string;
  description: string;
  creator: string;
  memberCount: number;
  maxMembers: number;
  tier: string;
  requiresApproval: boolean;
}

const NetworkDetailsScreen: React.FC<Props> = ({navigation, route}) => {
  const {network, inviteCode} = route.params;
  const [displayName, setDisplayName] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const {authState} = useAuth();

  const handleBack = (): void => {
    navigation.goBack();
  };

  const handleRequestToJoin = async (): Promise<void> => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter your display name');
      return;
    }

    if (!authState.token) {
      Alert.alert('Error', 'You must be signed in to join a network');
      return;
    }

    setLoading(true);

    try {
      const joinRequest = await authAPI.requestToJoinNetwork({
        networkId: network.networkId,
        inviteCode,
        displayName: displayName.trim(),
        message: message.trim(),
      }, authState.token);

      if (joinRequest.success) {
        // Store pending request locally so user can see it in their networks
        const currentUserId = authState.userProfile?.username;
        if (currentUserId) {
          try {
            await storageService.storePendingNetwork(
              network.networkId,
              network.name,
              network.description,
              network.creator,
              joinRequest.requestId,
              currentUserId
            );
            console.log('Pending network request stored locally');
          } catch (error) {
            console.error('Failed to store pending request locally:', error);
            // Don't fail the whole flow if local storage fails
          }
        }

        Alert.alert(
          'Request Sent!',
          `Your request to join "${network.name}" has been sent to the network admins. You can see its status in your networks list.`,
          [
            {
              text: 'View My Networks',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{name: 'Home'}],
                });
              },
            },
            {
              text: 'OK',
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        Alert.alert('Request Failed', 'Failed to send join request. Please try again.');
      }
    } catch (error) {
      console.error('Join request error:', error);
      let errorMessage = 'Failed to send join request. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('already requested')) {
          errorMessage = 'You have already requested to join this network.';
        } else if (error.message.includes('already a member')) {
          errorMessage = 'You are already a member of this network.';
        } else if (error.message.includes('network full')) {
          errorMessage = 'This network is full and cannot accept new members.';
        } else if (error.message.includes('invite expired')) {
          errorMessage = 'This invite code has expired.';
        }
      }
      
      Alert.alert('Request Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (tier: string): string => {
    if (!tier) {
      return '#10b981';
    }
    switch (tier.toLowerCase()) {
      case 'pro':
        return '#f59e0b';
      case 'enterprise':
        return '#8b5cf6';
      default:
        return '#10b981';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      
      <AppHeader 
        title="Network Details"
        showBackButton={true}
        showLogoutButton={true}
        onBackPress={handleBack}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        
        <View style={styles.networkInfoContainer}>
          <Text style={styles.networkName}>{network.name}</Text>
          <Text style={styles.creatorText}>Created by: @{network.creator}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{network.memberCount}/{network.maxMembers}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={[styles.tierBadge, {backgroundColor: getRoleBadgeColor(network.tier)}]}>
              <Text style={styles.tierText}>{network.tier}</Text>
            </View>
          </View>
          
          <Text style={styles.networkDescription}>
            {network.description}
          </Text>
        </View>

        <View style={styles.joinInfoContainer}>
          <Text style={styles.joinInfoTitle}>Join Requirements</Text>
          <View style={styles.requirementItem}>
            <Text style={styles.requirementBullet}>•</Text>
            <Text style={styles.requirementText}>
              {network.requiresApproval 
                ? 'Admin approval required'
                : 'Automatic approval with valid code'
              }
            </Text>
          </View>
          <View style={styles.requirementItem}>
            <Text style={styles.requirementBullet}>•</Text>
            <Text style={styles.requirementText}>
              Valid invite code: {inviteCode}
            </Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Your Display Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="How you'll appear to other members"
              placeholderTextColor="#6b7280"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={50}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Message to Admin (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Introduce yourself or explain why you want to join"
              placeholderTextColor="#6b7280"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
              maxLength={200}
              textAlignVertical="top"
              editable={!loading}
            />
            <Text style={styles.charCount}>{message.length}/200</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.requestButton,
              (!displayName.trim() || loading) && styles.requestButtonDisabled
            ]}
            onPress={handleRequestToJoin}
            disabled={!displayName.trim() || loading}>
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.requestButtonText}>Request to Join</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.nextStepsContainer}>
          <Text style={styles.nextStepsTitle}>What happens next?</Text>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>Your request is sent to network admins</Text>
          </View>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>Admins review your request and decide</Text>
          </View>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>You'll get notified of their decision</Text>
          </View>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>4</Text>
            <Text style={styles.stepText}>If approved, you can access the network!</Text>
          </View>
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
  networkInfoContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  networkName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  creatorText: {
    fontSize: 14,
    color: '#6366f1',
    textAlign: 'center',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  networkDescription: {
    fontSize: 16,
    color: '#d1d5db',
    lineHeight: 24,
    textAlign: 'center',
  },
  joinInfoContainer: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  joinInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  requirementBullet: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
    marginTop: 2,
  },
  requirementText: {
    fontSize: 14,
    color: '#d1d5db',
    flex: 1,
    lineHeight: 18,
  },
  formContainer: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  textArea: {
    height: 80,
    paddingTop: 16,
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  buttonContainer: {
    marginBottom: 32,
  },
  requestButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  requestButtonDisabled: {
    backgroundColor: '#4b5563',
    opacity: 0.6,
  },
  requestButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  nextStepsContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    marginRight: 12,
  },
  stepText: {
    fontSize: 14,
    color: '#d1d5db',
    flex: 1,
    lineHeight: 18,
  },
});

export default NetworkDetailsScreen;