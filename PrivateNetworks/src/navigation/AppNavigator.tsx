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
          <Stack.Screen 
            name="Home" 
            component={HomeScreen}
            options={{
              animationTypeForReplace: authState.isAuthenticated ? 'push' : 'pop',
            }}
          />
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