import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import UploadScreen from './src/screens/UploadScreen';
import ProcessingScreen from './src/screens/ProcessingScreen';
import ReviewProfileScreen from './src/screens/ReviewProfileScreen';
import MatchSummaryScreen from './src/screens/MatchSummaryScreen';
import TopicsScreen from './src/screens/TopicsScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#0F172A" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#0F172A',
          },
          headerTintColor: '#F8FAFC',
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 16,
          },
          contentStyle: {
            backgroundColor: '#0F172A',
          },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Upload"
          component={UploadScreen}
          options={{ title: 'Resume & JD Upload' }}
        />
        <Stack.Screen
          name="Processing"
          component={ProcessingScreen}
          options={{ title: 'NLP Pipeline', headerBackVisible: false }}
        />
        <Stack.Screen
          name="ReviewProfile"
          component={ReviewProfileScreen}
          options={{ title: 'Candidate Profile Review' }}
        />
        <Stack.Screen
          name="MatchSummary"
          component={MatchSummaryScreen}
          options={{ title: 'Resume–JD Match Analysis' }}
        />
        <Stack.Screen
          name="Topics"
          component={TopicsScreen}
          options={{ title: 'Ranked Interview Topics' }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: 'Saved Profiles' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
