import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';

export default function ProcessingScreen({ navigation }) {
  const { loadingStage, error, clearError } = useProfileStore();

  const handleRetry = () => {
    clearError();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorHeading}>Analysis Failed</Text>
            <Text style={styles.errorMessage}>{error}</Text>

            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>← Back to Upload & Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <View style={styles.pulseContainer}>
              <ActivityIndicator size="large" color="#38BDF8" />
            </View>

            <Text style={styles.title}>Processing Intelligence Pipeline</Text>
            <Text style={styles.stageText}>{loadingStage || 'Extracting and analyzing profile...'}</Text>

            <View style={styles.stepsList}>
              <View style={styles.stepRow}>
                <Text style={styles.checkIcon}>⚡</Text>
                <Text style={styles.stepText}>PyMuPDF & python-docx file text extraction</Text>
              </View>
              <View style={styles.stepRow}>
                <Text style={styles.checkIcon}>🧠</Text>
                <Text style={styles.stepText}>spaCy & Taxonomy skill entity normalization</Text>
              </View>
              <View style={styles.stepRow}>
                <Text style={styles.checkIcon}>🎯</Text>
                <Text style={styles.stepText}>JD cue parsing & 80/20 weighted coverage score</Text>
              </View>
              <View style={styles.stepRow}>
                <Text style={styles.checkIcon}>📋</Text>
                <Text style={styles.stepText}>Ranked interview topics generator (8-12)</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    width: '100%',
  },
  pulseContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
  },
  stageText: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 32,
  },
  stepsList: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkIcon: {
    fontSize: 14,
    marginRight: 10,
  },
  stepText: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
  },
  errorContainer: {
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F87171',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
