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
  Clipboard,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../navigation/AppNavigator';
import {useAuth} from '../context/AuthContext';
import {authAPI} from '../services/api';
import {AppHeader} from '../components';

type JoinNetworkScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'JoinNetwork'
>;

interface Props {
  navigation: JoinNetworkScreenNavigationProp;
}

const JoinNetworkScreen: React.FC<Props> = ({navigation}) => {
  const [inviteCode, setInviteCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const {authState} = useAuth();

  const handleBack = (): void => {
    navigation.goBack();
  };

  const handleLookupNetwork = async (): Promise<void> => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    if (!authState.token) {
      Alert.alert('Error', 'You must be signed in to join a network');
      return;
    }

    setLoading(true);

    try {
      const networkDetails = await authAPI.lookupNetworkByInviteCode(
        inviteCode.trim().toUpperCase(),
        authState.token
      );

      if (networkDetails.success) {
        // Navigate to network details screen
        navigation.navigate('NetworkDetails', {
          network: networkDetails.network,
          inviteCode: inviteCode.trim().toUpperCase(),
        });
      } else {
        Alert.alert(
          'Network Not Found',
          'The invite code is invalid or the network no longer exists.'
        );
      }
    } catch (error) {
      console.error('Network lookup error:', error);
      let errorMessage = 'Failed to find network. Please check the code and try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('already a member')) {
          errorMessage = 'You are already a member of this network.';
        } else if (error.message.includes('not found')) {
          errorMessage = 'Network not found. Please check the invite code.';
        } else if (error.message.includes('expired')) {
          errorMessage = 'This invite code has expired.';
        }
      }
      
      Alert.alert('Lookup Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteCodeChange = (text: string): void => {
    setInviteCode(text);
  };

  const handlePasteFromClipboard = async (): Promise<void> => {
    try {
      const clipboardContent = await Clipboard.getString();
      if (clipboardContent) {
        setInviteCode(clipboardContent.trim());
      }
    } catch (error) {
      console.error('Failed to paste from clipboard:', error);
      Alert.alert('Paste Error', 'Could not paste from clipboard');
    }
  };

  const isValidCode = (): boolean => {
    // Allow any non-empty string as valid (let the server validate the format)
    return inviteCode.trim().length > 0;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      
      <AppHeader 
        title="Join Network"
        showBackButton={true}
        showLogoutButton={true}
        onBackPress={handleBack}
      />

      <View style={styles.content}>
        <View style={styles.formContainer}>
          <Text style={styles.subtitle}>
            Enter the invite code shared by the network admin
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Invite Code</Text>
            <View style={styles.inputWithButtonContainer}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textInputWithButton
                ]}
                placeholder="Enter invite code"
                placeholderTextColor="#6b7280"
                value={inviteCode}
                onChangeText={handleInviteCodeChange}
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.pasteButton}
                onPress={handlePasteFromClipboard}
                disabled={loading}>
                <Text style={styles.pasteButtonText}>Paste</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.lookupButton,
              (!isValidCode() || loading) && styles.lookupButtonDisabled
            ]}
            onPress={handleLookupNetwork}
            disabled={!isValidCode() || loading}>
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.lookupButtonText}>Look Up Network</Text>
            )}
          </TouchableOpacity>

          <View style={styles.helpContainer}>
            <Text style={styles.helpText}>
              Don't have an invite code?
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('NetworkSetup')}
              disabled={loading}>
              <Text style={styles.helpLink}>Create Your Own Network</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>How it works:</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>1.</Text>
            <Text style={styles.infoText}>Enter or paste the invite code you received</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>2.</Text>
            <Text style={styles.infoText}>Review network details and request to join</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>3.</Text>
            <Text style={styles.infoText}>Wait for admin approval to access the network</Text>
          </View>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    justifyContent: 'space-between',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
    paddingTop: 40,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
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
  inputWithButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  textInputWithButton: {
    flex: 1,
  },
  pasteButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  pasteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  textInputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  lookupButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  lookupButtonDisabled: {
    backgroundColor: '#4b5563',
    opacity: 0.6,
  },
  lookupButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  helpContainer: {
    alignItems: 'center',
  },
  helpText: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  helpLink: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoBullet: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
    marginTop: 1,
  },
  infoText: {
    fontSize: 14,
    color: '#d1d5db',
    flex: 1,
    lineHeight: 18,
  },
});

export default JoinNetworkScreen;