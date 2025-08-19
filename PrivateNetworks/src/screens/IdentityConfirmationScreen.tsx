import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {useAuth} from '../context/AuthContext';
import {generateQRData} from '../services/qr';
import {cryptoService} from '../services/crypto';
import {storageService} from '../services/storage';
import {authAPI} from '../services/api';
import { QRCodePlaceholder } from './QRCodePlaceholder';

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
  Home: undefined;
};

type IdentityConfirmationScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'IdentityConfirmation'
>;

type IdentityConfirmationScreenRouteProp = RouteProp<
  RootStackParamList,
  'IdentityConfirmation'
>;

interface Props {
  navigation: IdentityConfirmationScreenNavigationProp;
  route: IdentityConfirmationScreenRouteProp;
}

const IdentityConfirmationScreen: React.FC<Props> = ({navigation, route}) => {
  const {username, email, phone, publicKey, privateKey} = route.params;
  const [hasBackedUp, setHasBackedUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {refreshAuthState} = useAuth();

  const formattedPublicKey = cryptoService.formatPublicKey(publicKey);
  const displayKey = cryptoService.getDisplayKey(publicKey);
  const qrData = generateQRData(publicKey, privateKey, username);

  const handleSaveBackup = () => {
    Alert.alert(
      'Backup Saved',
      'Your identity key has been saved to your device securely. Make sure to also write it down or save it in a password manager.',
      [
        {
          text: 'OK',
          onPress: () => setHasBackedUp(true),
        },
      ]
    );
  };

  const handleContinue = async () => {
    if (!hasBackedUp) {
      Alert.alert(
        'Important!',
        'Please save your backup key first. This is the only way to recover your account if you lose access to this device.',
        [
          {text: 'OK'},
        ]
      );
      return;
    }

    setIsLoading(true);

    try {
      // Note: Identity is already stored from CreateIdentityScreen
      // Create auth challenge and login automatically
      const timestamp = Date.now();
      const challenge = cryptoService.generateAuthChallenge(timestamp);
      const authMessage = challenge;
      const signature = await cryptoService.signMessage(authMessage, privateKey);

      // Login to get auth token
      const loginResponse = await authAPI.login({
        username,
        signature,
        timestamp,
        message: authMessage,
      });

      if (loginResponse.success) {
        // Store auth token and user profile
        await storageService.storeAuthToken(loginResponse.token);
        const userProfile = await authAPI.getUserProfile(loginResponse.token);
        await storageService.storeUserProfile(userProfile);

        // Refresh auth state - this will navigate to Home automatically
        await refreshAuthState();
      } else {
        throw new Error('Login failed after identity creation');
      }
    } catch (error) {
      console.error('Error completing identity setup:', error);
      Alert.alert(
        'Setup Error',
        'There was a problem completing your identity setup. You can try signing in manually from the welcome screen.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Welcome'),
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Identity Created! 🔐</Text>
        </View>

        <View style={styles.identityInfo}>
          <Text style={styles.usernameLabel}>Username:</Text>
          <Text style={styles.username}>@{username}</Text>
        </View>

        <View style={styles.keySection}>
          <Text style={styles.sectionTitle}>Your Identity Key:</Text>
          
          <QRCodePlaceholder data={qrData} />

          <View style={styles.keyContainer}>
            <Text style={styles.keyText} numberOfLines={2} ellipsizeMode="middle">
              {displayKey}
            </Text>
          </View>

          <Text style={styles.backupLabel}>Backup this key!</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveBackup}>
            <Text style={styles.saveButtonText}>Save Backup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.continueButton,
              hasBackedUp && styles.continueButtonEnabled,
              isLoading && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!hasBackedUp || isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={[
                styles.continueButtonText,
                hasBackedUp && styles.continueButtonTextEnabled,
              ]}>
                I've Saved It
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            ⚠️ This key is your identity. Lost key = lost account
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const {width} = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  identityInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  usernameLabel: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 4,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6366f1',
  },
  keySection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 20,
  },
  keyContainer: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 8,
    width: '100%',
    marginBottom: 12,
  },
  keyText: {
    fontSize: 12,
    color: '#d1d5db',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  backupLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  saveButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: '#4b5563',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  continueButtonEnabled: {
    backgroundColor: '#6366f1',
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  continueButtonTextEnabled: {
    color: '#ffffff',
  },
  warningContainer: {
    backgroundColor: '#7c2d12',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  warningText: {
    color: '#fed7aa',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default IdentityConfirmationScreen;