import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../navigation/AppNavigator';
import {useAuth} from '../context/AuthContext';
import {authAPI, CreateNetworkRequest} from '../services/api';

type NetworkSettingsScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'NetworkSettings'
>;

type NetworkSettingsScreenRouteProp = RouteProp<
  RootStackParamList,
  'NetworkSettings'
>;

interface Props {
  navigation: NetworkSettingsScreenNavigationProp;
  route: NetworkSettingsScreenRouteProp;
}

type JoinApproval = 'require_admin' | 'auto_approve';
type MemberPermissions = 'admin_only' | 'members_can_invite';
type DataRetention = 'forever' | '30_days' | '7_days';

const NetworkSettingsScreen: React.FC<Props> = ({navigation, route}) => {
  const {networkName, description, networkId, maxMembers} = route.params;
  const {authState} = useAuth();
  
  const [joinApproval, setJoinApproval] = useState<JoinApproval>('require_admin');
  const [memberPermissions, setMemberPermissions] = useState<MemberPermissions>('admin_only');
  const [dataRetention, setDataRetention] = useState<DataRetention>('30_days');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const handleBack = (): void => {
    navigation.goBack();
  };

  const handleCreateNetwork = async (): void => {
    if (!authState.token) {
      Alert.alert('Error', 'You must be signed in to create a network');
      return;
    }

    setIsCreating(true);

    try {
      const createNetworkData: CreateNetworkRequest = {
        networkName,
        description,
        networkId,
        settings: {
          joinApproval,
          memberPermissions,
          dataRetention,
          maxMembers,
        },
      };

      const response = await authAPI.createNetwork(createNetworkData, authState.token);

      if (response.success) {
        // Navigate to network created screen
        navigation.navigate('NetworkCreated', {
          networkName,
          description,
          networkId,
          maxMembers,
          inviteCode: response.inviteCode,
          settings: {
            joinApproval,
            memberPermissions,
            dataRetention,
          },
        });
      } else {
        throw new Error('Network creation failed');
      }
    } catch (error) {
      console.error('Network creation error:', error);
      let errorMessage = 'Failed to create network. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      Alert.alert('Creation Failed', errorMessage, [{text: 'OK'}]);
    } finally {
      setIsCreating(false);
    }
  };

  const generateInviteCode = (): string => {
    // Generate a simple invite code format: NAME-XXXX-YEAR
    const namePrefix = networkName
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4)
      .padEnd(4, 'X');
    
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const year = new Date().getFullYear();
    
    return `${namePrefix}-${randomPart}-${year}`;
  };

  const OptionButton: React.FC<{
    selected: boolean;
    onPress: () => void;
    children: React.ReactNode;
  }> = ({selected, onPress, children}) => (
    <TouchableOpacity
      style={[styles.optionButton, selected && styles.optionButtonSelected]}
      onPress={onPress}>
      <View style={[styles.radioButton, selected && styles.radioButtonSelected]}>
        {selected && <View style={styles.radioButtonInner} />}
      </View>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {children}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Network Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.settingsContainer}>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Join Approval</Text>
            <OptionButton
              selected={joinApproval === 'require_admin'}
              onPress={() => setJoinApproval('require_admin')}>
              Require admin approval
            </OptionButton>
            <OptionButton
              selected={joinApproval === 'auto_approve'}
              onPress={() => setJoinApproval('auto_approve')}>
              Auto-approve with code
            </OptionButton>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Member Permissions</Text>
            <OptionButton
              selected={memberPermissions === 'admin_only'}
              onPress={() => setMemberPermissions('admin_only')}>
              Only admins can invite
            </OptionButton>
            <OptionButton
              selected={memberPermissions === 'members_can_invite'}
              onPress={() => setMemberPermissions('members_can_invite')}>
              Members can invite others
            </OptionButton>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Data Retention</Text>
            <OptionButton
              selected={dataRetention === 'forever'}
              onPress={() => setDataRetention('forever')}>
              Keep messages forever
            </OptionButton>
            <OptionButton
              selected={dataRetention === '30_days'}
              onPress={() => setDataRetention('30_days')}>
              Delete after 30 days
            </OptionButton>
            <OptionButton
              selected={dataRetention === '7_days'}
              onPress={() => setDataRetention('7_days')}>
              Delete after 7 days
            </OptionButton>
          </View>

          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Network Summary</Text>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Name:</Text>
              <Text style={styles.summaryValue}>{networkName}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>ID:</Text>
              <Text style={styles.summaryValue}>{networkId}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Max Members:</Text>
              <Text style={styles.summaryValue}>{maxMembers} (Free)</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.createButton, isCreating && styles.createButtonDisabled]}
          onPress={handleCreateNetwork}
          disabled={isCreating}>
          {isCreating ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.createButtonText}>Create Network</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#6366f1',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  settingsContainer: {
    paddingTop: 20,
  },
  sectionContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    backgroundColor: '#1e40af',
    borderColor: '#6366f1',
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
  optionText: {
    fontSize: 16,
    color: '#d1d5db',
    flex: 1,
  },
  optionTextSelected: {
    color: '#ffffff',
    fontWeight: '500',
  },
  summaryContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  summaryValue: {
    fontSize: 14,
    color: '#d1d5db',
    fontWeight: '500',
  },
  footer: {
    padding: 24,
    paddingBottom: 34,
  },
  createButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default NetworkSettingsScreen;