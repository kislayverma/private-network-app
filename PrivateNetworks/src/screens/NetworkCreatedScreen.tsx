import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Alert,
  Clipboard,
  Share,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../navigation/AppNavigator';
import {useAuth} from '../context/AuthContext';

type NetworkCreatedScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'NetworkCreated'
>;

type NetworkCreatedScreenRouteProp = RouteProp<
  RootStackParamList,
  'NetworkCreated'
>;

interface Props {
  navigation: NetworkCreatedScreenNavigationProp;
  route: NetworkCreatedScreenRouteProp;
}

const NetworkCreatedScreen: React.FC<Props> = ({navigation, route}) => {
  const {networkName, networkId, maxMembers, inviteCode} = route.params;
  const [copied, setCopied] = useState<boolean>(false);
  const {refreshAuthState} = useAuth();

  const handleCopyCode = async (): Promise<void> => {
    try {
      await Clipboard.setString(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
      Alert.alert('Error', 'Failed to copy invite code');
    }
  };

  const handleShareInvite = async (): Promise<void> => {
    try {
      const shareMessage = `Join my private network "${networkName}"!\n\nUse invite code: ${inviteCode}\n\nDownload the Private Networks app to get started.`;
      
      await Share.share({
        message: shareMessage,
        title: `Join ${networkName}`,
      });
    } catch (error) {
      console.error('Failed to share invite:', error);
    }
  };

  const handleGoToNetwork = async (): Promise<void> => {
    try {
      // Refresh auth state to load the new network
      await refreshAuthState();
      
      // Navigate to Home screen where networks will be displayed
      navigation.reset({
        index: 0,
        routes: [{name: 'Home'}],
      });
    } catch (error) {
      console.error('Failed to navigate to network:', error);
      // Fallback navigation
      navigation.navigate('Home');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
      
      <View style={styles.content}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>🎉</Text>
          <Text style={styles.title}>Network Ready!</Text>
        </View>

        <View style={styles.networkInfo}>
          <Text style={styles.networkName}>{networkName}</Text>
          <Text style={styles.networkStats}>
            Members: 1/{maxMembers} (Free)
          </Text>
        </View>

        <View style={styles.inviteContainer}>
          <Text style={styles.inviteTitle}>Invite Code:</Text>
          <View style={styles.inviteCodeContainer}>
            <Text style={styles.inviteCode}>{inviteCode}</Text>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyCode}>
              <Text style={styles.copyButtonText}>
                {copied ? 'Copied!' : 'Copy Code'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            Share this code with family members. You'll approve each join request.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareInvite}>
            <Text style={styles.shareButtonText}>Invite Members</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.networkButton}
            onPress={handleGoToNetwork}>
            <Text style={styles.networkButtonText}>Go to Network</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>What's Next?</Text>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>
              Invite family members using the code above
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>
              Approve join requests from network settings
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>
              Start sharing messages, photos, and updates
            </Text>
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
    paddingTop: 40,
    paddingBottom: 40,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  networkInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  networkName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 8,
    textAlign: 'center',
  },
  networkStats: {
    fontSize: 16,
    color: '#9ca3af',
  },
  inviteContainer: {
    marginBottom: 24,
  },
  inviteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  inviteCodeContainer: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  inviteCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6366f1',
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: 12,
  },
  copyButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  copyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  instructionsText: {
    fontSize: 14,
    color: '#d1d5db',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 12,
  },
  shareButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flex: 1,
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  networkButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flex: 1,
  },
  networkButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  featuresContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  featureBullet: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    marginTop: 2,
  },
  featureText: {
    fontSize: 14,
    color: '#d1d5db',
    flex: 1,
    lineHeight: 18,
  },
});

export default NetworkCreatedScreen;