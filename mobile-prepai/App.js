import React, { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Fraunces_700Bold, Fraunces_900Black } from '@expo-google-fonts/fraunces';
import {
  useFonts as useDmSansFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

import { ThemeProvider, useTheme } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import HistoryPlaceholderScreen from './src/screens/HistoryPlaceholderScreen';
import SavedPlaceholderScreen from './src/screens/SavedPlaceholderScreen';

const Stack = createNativeStackNavigator();

function AppNavigation() {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="History" component={HistoryPlaceholderScreen} />
          <Stack.Screen name="Saved" component={SavedPlaceholderScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  const [frauncesLoaded] = useFonts({
    Fraunces_700Bold,
    Fraunces_900Black,
  });

  const [dmSansLoaded] = useDmSansFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const linkId = 'prepai-google-fonts';
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,900;1,9..144,700&display=swap';
        document.head.appendChild(link);
      }
    }
  }, []);

  const fontsReady = frauncesLoaded && dmSansLoaded;

  if (!fontsReady && Platform.OS !== 'web') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FBF3E4',
        }}
      >
        <ActivityIndicator size="large" color="#FF6F2C" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigation />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
