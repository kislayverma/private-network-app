import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  StatusBar,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../navigation/AppNavigator';
import {AppHeader} from '../components';

type NetworkSetupScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'NetworkSetup'
>;

interface Props {
  navigation: NetworkSetupScreenNavigationProp;
}

const NetworkSetupScreen: React.FC<Props> = ({navigation}) => {
  const [networkName, setNetworkName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [networkId, setNetworkId] = useState<string>('');
  const [maxMembers] = useState<number>(10); // Free tier limit

  React.useEffect(() => {
    // Auto-generate network ID when name changes
    if (networkName.trim()) {
      const sanitized = networkName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 20);
      const year = new Date().getFullYear();
      setNetworkId(`${sanitized}-${year}`);
    } else {
      setNetworkId('');
    }
  }, [networkName]);

  const handleRegenerateId = (): void => {
    if (networkName.trim()) {
      const sanitized = networkName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 20);
      const timestamp = Date.now().toString().slice(-6);
      setNetworkId(`${sanitized}-${timestamp}`);
    }
  };

  const handleContinue = (): void => {
    if (!networkName.trim()) {
      Alert.alert('Error', 'Please enter a network name');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a network description');
      return;
    }

    if (!networkId.trim()) {
      Alert.alert('Error', 'Network ID is required');
      return;
    }

    // Navigate to network settings screen
    navigation.navigate('NetworkSettings', {
      networkName: networkName.trim(),
      description: description.trim(),
      networkId: networkId.trim(),
      maxMembers,
    });
  };

  const handleBack = (): void => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      
      <AppHeader 
        title="Create Network"
        showHomeButton={true}
        showLogoutButton={true}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Network Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Smith Family"
              placeholderTextColor="#6b7280"
              value={networkName}
              onChangeText={setNetworkName}
              maxLength={50}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Family updates, photos and planning"
              placeholderTextColor="#6b7280"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/200</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Network ID (auto-generated)</Text>
            <View style={styles.networkIdContainer}>
              <Text style={styles.networkIdText}>
                {networkId || 'Enter network name first...'}
              </Text>
              <TouchableOpacity
                onPress={handleRegenerateId}
                disabled={!networkName.trim()}
                style={[
                  styles.regenerateButton,
                  !networkName.trim() && styles.regenerateButtonDisabled,
                ]}>
                <Text style={[
                  styles.regenerateButtonText,
                  !networkName.trim() && styles.regenerateButtonTextDisabled,
                ]}>
                  Regenerate
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.membersContainer}>
            <Text style={styles.membersTitle}>Initial Members</Text>
            <Text style={styles.membersText}>
              You + {maxMembers - 1} others ({maxMembers} free)
            </Text>
            <Text style={styles.membersNote}>
              Upgrade to add more members after creation
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            (!networkName.trim() || !description.trim()) && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!networkName.trim() || !description.trim()}>
          <Text style={styles.continueButtonText}>Continue</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  formContainer: {
    paddingTop: 20,
  },
  inputContainer: {
    marginBottom: 24,
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
  networkIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  networkIdText: {
    flex: 1,
    fontSize: 14,
    color: '#d1d5db',
    fontFamily: 'monospace',
  },
  regenerateButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  regenerateButtonDisabled: {
    backgroundColor: '#4b5563',
  },
  regenerateButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  regenerateButtonTextDisabled: {
    color: '#9ca3af',
  },
  membersContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  membersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  membersText: {
    fontSize: 14,
    color: '#10b981',
    marginBottom: 4,
  },
  membersNote: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 16,
  },
  footer: {
    padding: 24,
    paddingBottom: 34,
  },
  continueButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#4b5563',
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default NetworkSetupScreen;