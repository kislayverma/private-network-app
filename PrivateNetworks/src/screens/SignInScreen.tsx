import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  StatusBar,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../navigation/AppNavigator';
import {useAuth} from '../context/AuthContext';
import {storageService} from '../services/storage';
import {cryptoService} from '../services/crypto';
import {authAPI, LoginRequest, LoginResponse} from '../services/api';
import {AppHeader} from '../components';

type SignInScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'SignIn'
>;

interface Props {
  navigation: SignInScreenNavigationProp;
}

const SignInScreen: React.FC<Props> = ({navigation}) => {
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const {refreshAuthState} = useAuth();

  const handleSignIn = async (): Promise<void> => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter your username');
      return;
    }

    setLoading(true);

    try {
      // Check if we have a stored private key for this user
      console.log('Looking for private key for username:', username.trim());
      const privateKey = await storageService.getPrivateKey(username.trim());
      console.log('Private key found:', privateKey ? 'YES' : 'NO');
      
      if (!privateKey) {
        Alert.alert(
          'Account Not Found',
          'No identity found for this username on this device. Please create a new identity or restore from backup.',
          [
            {
              text: 'Create Identity',
              onPress: () => navigation.navigate('CreateIdentity'),
            },
            {text: 'Cancel', style: 'cancel'},
          ]
        );
        setLoading(false);
        return;
      }

      // Generate authentication message
      const timestamp = Date.now();
      const challenge = cryptoService.generateAuthChallenge(timestamp);
      const authMessage = challenge;//`${challenge}_${timestamp}`;
      
      // Sign the authentication message with our private key
      const signature = await cryptoService.signMessage(authMessage, privateKey);

      // Attempt login with the API
      const loginResponse: LoginResponse = await authAPI.login({
        username: username.trim(),
        signature,
        timestamp,
        message: authMessage,
      });

      if (loginResponse.success) {
        // Store the auth token
        await storageService.storeAuthToken(loginResponse.token);
        await storageService.storeUserId(username.trim());
        
        // Get and store user profile
        const userProfile = await authAPI.getUserProfile(loginResponse.token);
        await storageService.storeUserProfile(userProfile);

        // Refresh auth state which will automatically navigate to Home
        await refreshAuthState();
      } else {
        Alert.alert('Sign In Failed', 'Unable to sign in. Please try again.');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      let errorMessage = 'An unexpected error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      Alert.alert('Sign In Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToWelcome = (): void => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      
      <AppHeader 
        title="Sign In"
        showBackButton={true}
        showLogoutButton={false}
        onBackPress={handleBackToWelcome}
      />

      <View style={styles.content}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in with your username to access your private networks
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter your username"
              placeholderTextColor="#6b7280"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.signInButton, loading && styles.signInButtonDisabled]}
            onPress={handleSignIn}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.helpContainer}>
            <Text style={styles.helpText}>
              Don't have an account or lost access?
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateIdentity')}
              disabled={loading}>
              <Text style={styles.helpLink}>Create New Identity</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.securityNote}>
          <Text style={styles.securityNoteText}>
            🔐 Your identity is secured with cryptographic keys stored only on this device
          </Text>
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
    justifyContent: 'space-between',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
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
  textInput: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  signInButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
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
  securityNote: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  securityNoteText: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default SignInScreen;