import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {authAPI} from '../services/api';
import {cryptoService} from '../services/crypto';
import {storageService} from '../services/storage';

type RootStackParamList = {
  Welcome: undefined;
  CreateIdentity: undefined;
  IdentityConfirmation: {
    username: string;
    email: string;
    phone?: string;
    publicKey: string;
    privateKey: string;
  };
};

type CreateIdentityScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CreateIdentity'
>;

interface Props {
  navigation: CreateIdentityScreenNavigationProp;
}

const CreateIdentityScreen: React.FC<Props> = ({navigation}) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkUsernameAvailability = async (usernameInput: string) => {
    if (usernameInput.length < 3) {
      setIsUsernameAvailable(null);
      return;
    }

    try {
      const result = await authAPI.checkUsername(usernameInput);
      setIsUsernameAvailable(result.available);
    } catch (error) {
      console.error('Username check failed:', error);
      setIsUsernameAvailable(false);
    }
  };

  const handleUsernameChange = (text: string) => {
    const cleanText = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleanText);
    setIsUsernameAvailable(true);

    // checkUsernameAvailability(cleanText);
  };

  const validateEmail = (emailInput: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailInput);
  };

  const validatePhone = (phoneInput: string) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneInput === '' || phoneRegex.test(phoneInput);
  };

  const handleCreateIdentity = async () => {
    if (!username || username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters long');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
Alert.alert('Error', 'going');
    // if (phone && !validatePhone(phone)) {
    //   Alert.alert('Error', 'Please enter a valid phone number');
    //   return;
    // }

    // if (isUsernameAvailable === false) {
    //   Alert.alert('Error', 'Username is not available');
    //   return;
    // }

    setIsLoading(true);

    try {
      const keyPair = await cryptoService.generateKeyPair();
      console.log(keyPair);
      
      const registerData = {
        userId: username,
        publicKey: cryptoService.formatPublicKey(keyPair.publicKey),
        email: email,
        phone: phone || undefined,
      };
      console.log(registerData);

      const response = await authAPI.register(registerData);
      
      if (response.success) {
        await storageService.storeUserId(username);
        await storageService.storePublicKey(keyPair.publicKey);
        await storageService.storePrivateKey(username, keyPair.privateKey);
        
        navigation.navigate('IdentityConfirmation', {
          username,
          email,
          phone: phone || undefined,
          publicKey: keyPair.publicKey,
          privateKey: keyPair.privateKey,
        });
      } else {
        Alert.alert('Error', 'Failed to create identity. Please try again.');
      }
    } catch (error) {
      console.error('Identity creation failed:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create identity. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = username.length >= 3 && 
                     validateEmail(email) && 
                     validatePhone(phone) && 
                     isUsernameAvailable === true;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Create Your Identity</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Choose a username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={handleUsernameChange}
                placeholder="alice_smith"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {isUsernameAvailable === true && (
                <Text style={styles.successText}>✓ Available</Text>
              )}
              {isUsernameAvailable === false && (
                <Text style={styles.errorText}>✗ Not available</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email (for account recovery)</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="alice@example.com"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone (optional)</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 555-0100"
                placeholderTextColor="#6b7280"
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.createButton,
                !isFormValid && styles.createButtonDisabled,
              ]}
              onPress={handleCreateIdentity}
              disabled={!isFormValid || isLoading}>
              <Text style={[
                styles.createButtonText,
                !isFormValid && styles.createButtonTextDisabled,
              ]}>
                {isLoading ? 'Generating Identity...' : 'Generate Secure Identity'}
              </Text>
            </TouchableOpacity>

            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>
                This creates a cryptographic identity that only you control
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 24,
    color: '#6366f1',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  successText: {
    color: '#10b981',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  createButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  createButtonDisabled: {
    backgroundColor: '#4b5563',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  createButtonTextDisabled: {
    color: '#9ca3af',
  },
  infoContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#374151',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  infoText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});

export default CreateIdentityScreen;