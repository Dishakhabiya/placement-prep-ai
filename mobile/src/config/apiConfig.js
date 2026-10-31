import { Platform } from 'react-native';

/**
 * Configure your backend API address.
 * - iOS Simulator / Web: http://localhost:8000
 * - Android Emulator: http://10.0.2.2:8000
 * - Physical Device: replace with your machine's Wi-Fi IP (e.g., http://192.168.1.50:8000)
 */
const getDynamicHost = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return Platform.select({
    android: 'http://10.0.2.2:8000',
    ios: 'http://localhost:8000',
    default: 'http://localhost:8000',
  });
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || getDynamicHost();
