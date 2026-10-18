import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
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
import MockInterviewScreen from './src/screens/MockInterviewScreen';
import PerformanceReportScreen from './src/screens/PerformanceReportScreen';
import ChatbotScreen from './src/screens/ChatbotScreen';

// Persistent Global Floating Chatbot
import FloatingChatbot from './src/components/FloatingChatbot';

export const navigationRef = createNavigationContainerRef();

const Stack = createNativeStackNavigator();

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('Home');

  return (
    <View style={styles.appRoot}>
      <NavigationContainer
        ref={navigationRef}
        onStateChange={() => {
          if (navigationRef.isReady()) {
            const route = navigationRef.getCurrentRoute();
            if (route) setCurrentRoute(route.name);
          }
        }}
      >
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerTintColor: '#111827',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 16,
              color: '#111827',
            },
            contentStyle: {
              backgroundColor: '#F8F9FA',
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
            name="MockInterview"
            component={MockInterviewScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PerformanceReport"
            component={PerformanceReportScreen}
            options={{ title: 'Session Performance Report' }}
          />
          <Stack.Screen
            name="Chatbot"
            component={ChatbotScreen}
            options={{ title: 'AI Placement Coach' }}
          />
          <Stack.Screen
            name="History"
            component={HistoryScreen}
            options={{ title: 'Saved Profiles' }}
          />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Global persistent chatbot docked in the bottom-left corner across every screen */}
      <FloatingChatbot navigationRef={navigationRef} currentRoute={currentRoute} />
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    position: 'relative',
    height: '100%',
    width: '100%',
  },
});

