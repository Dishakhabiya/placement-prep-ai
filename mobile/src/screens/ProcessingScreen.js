import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import Caricatures from '../assets/caricatures';

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
          <View style={styles.card}>
            <Image
              source={Caricatures.codeInspection || Caricatures.analyticsChart}
              style={styles.processCaricature}
              resizeMode="contain"
            />

            <View style={styles.pulseContainer}>
              <ActivityIndicator size="small" color="#FFC82C" />
            </View>

            <Text style={styles.title}>Processing Intelligence Pipeline</Text>
            <Text style={styles.stageText}>
              {loadingStage || 'Extracting and analyzing profile...'}
            </Text>

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
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  processCaricature: {
    width: 140,
    height: 110,
    marginBottom: 16,
  },
  pulseContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF9C3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FDE047',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  stageText: {
    fontSize: 13,
    color: '#854D0E',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  stepsList: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    fontSize: 14,
    marginRight: 10,
  },
  stepText: {
    fontSize: 12,
    color: '#4B5563',
    flex: 1,
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#B91C1C',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFC82C',
    fontWeight: '800',
    fontSize: 14,
  },
});
