import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {AuthProvider, useAuth} from '../context/AuthContext';
import WelcomeScreen from '../screens/WelcomeScreen';
import CreateIdentityScreen from '../screens/CreateIdentityScreen';
import IdentityConfirmationScreen from '../screens/IdentityConfirmationScreen';
import SignInScreen from '../screens/SignInScreen';
import HomeScreen from '../screens/HomeScreen';
import NetworkSetupScreen from '../screens/NetworkSetupScreen';
import NetworkSettingsScreen from '../screens/NetworkSettingsScreen';
import NetworkCreatedScreen from '../screens/NetworkCreatedScreen';
import NetworksListScreen from '../screens/NetworksListScreen';

export type RootStackParamList = {
  Welcome: undefined;
  CreateIdentity: undefined;
  IdentityConfirmation: {
    username: string;
    email: string;
    phone?: string;
    publicKey: string;
    privateKey: string;
  };
  SignIn: undefined;
  Home: undefined;
  NetworksList: undefined;
  NetworkSetup: undefined;
  NetworkSettings: {
    networkName: string;
    description: string;
    networkId: string;
    maxMembers: number;
  };
  NetworkCreated: {
    networkName: string;
    description: string;
    networkId: string;
    maxMembers: number;
    inviteCode: string;
    settings: {
      joinApproval: 'require_admin' | 'auto_approve';
      memberPermissions: 'admin_only' | 'members_can_invite';
      dataRetention: 'forever' | '30_days' | '7_days';
    };
  };
};

const Stack = createStackNavigator<RootStackParamList>();

const LoadingScreen: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#6366f1" />
  </View>
);

const AppStackNavigator: React.FC = () => {
  const {authState} = useAuth();

  if (authState.isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: {backgroundColor: '#1a1a1a'},
        }}>
        {authState.isAuthenticated ? (
          // Authenticated stack
          <>
            <Stack.Screen 
              name="Home" 
              component={HomeScreen}
              options={{
                animationTypeForReplace: authState.isAuthenticated ? 'push' : 'pop',
              }}
            />
            <Stack.Screen name="NetworksList" component={NetworksListScreen} />
            <Stack.Screen name="NetworkSetup" component={NetworkSetupScreen} />
            <Stack.Screen name="NetworkSettings" component={NetworkSettingsScreen} />
            <Stack.Screen name="NetworkCreated" component={NetworkCreatedScreen} />
          </>
        ) : (
          // Unauthenticated stack
          <>
            <Stack.Screen 
              name="Welcome" 
              component={WelcomeScreen}
              options={{
                animationTypeForReplace: authState.isAuthenticated ? 'push' : 'pop',
              }}
            />
            <Stack.Screen name="CreateIdentity" component={CreateIdentityScreen} />
            <Stack.Screen 
              name="IdentityConfirmation" 
              component={IdentityConfirmationScreen} 
            />
            <Stack.Screen name="SignIn" component={SignInScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const AppNavigator: React.FC = () => {
  return (
    <AuthProvider>
      <AppStackNavigator />
    </AuthProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppNavigator;