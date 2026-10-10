import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  FlatList,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import SectionCard from '../components/SectionCard';

export default function HomeScreen({ navigation }) {
  const {
    profilesList,
    backendHealthy,
    checkBackendHealth,
    loadInitialData,
    fetchProfile,
  } = useProfileStore();

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleOpenProfile = async (profileId) => {
    try {
      await fetchProfile(profileId);
      navigation.navigate('ReviewProfile');
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header & Status */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appTag}>MODULE 1 • NLP INTELLIGENCE</Text>
            <Text style={styles.appTitle}>PlacementPrep AI</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.healthBadge,
              backendHealthy === true
                ? styles.healthyBadge
                : backendHealthy === false
                ? styles.offlineBadge
                : styles.checkingBadge,
            ]}
            onPress={checkBackendHealth}
          >
            <View
              style={[
                styles.healthDot,
                backendHealthy === true ? styles.greenDot : styles.redDot,
              ]}
            />
            <Text style={styles.healthText}>
              {backendHealthy === true
                ? 'API Online'
                : backendHealthy === false
                ? 'Offline'
                : 'Checking...'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroHeading}>Resume & JD Intelligence</Text>
          <Text style={styles.heroSubtext}>
            Extract technical skills, analyze job description requirements, detect skill gaps, and generate ranked interview topics tailored for mock sessions.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Upload')}
          >
            <Text style={styles.primaryBtnText}>+ Start New Analysis</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats Grid */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profilesList.length}</Text>
            <Text style={styles.statLabel}>Saved Profiles</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>5</Text>
            <Text style={styles.statLabel}>Interview Modes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>100%</Text>
            <Text style={styles.statLabel}>Offline NLP</Text>
          </View>
        </View>

        {/* Recent Profiles Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Profiles</Text>
          {profilesList.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={styles.viewAllText}>View All ({profilesList.length})</Text>
            </TouchableOpacity>
          )}
        </View>

        {profilesList.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No profiles analyzed yet</Text>
            <Text style={styles.emptySubtitle}>
              Upload a PDF/DOCX resume and paste a target job description to get started.
            </Text>
          </View>
        ) : (
          profilesList.slice(0, 3).map((item) => (
            <TouchableOpacity
              key={item.profile_id}
              activeOpacity={0.8}
              onPress={() => handleOpenProfile(item.profile_id)}
            >
              <SectionCard
                title={item.job_title || 'Software Engineer'}
                subtitle={`Mode: ${item.mode.toUpperCase()} • ${new Date(item.created_at).toLocaleDateString()}`}
                badge={`${Math.round(item.match_score)}% Match`}
                badgeColor={item.match_score >= 70 ? '#10B981' : '#F59E0B'}
              >
                <View style={styles.profileMetaRow}>
                  <Text style={styles.profileMetaText}>
                    {item.candidate_skills_count} skills extracted
                  </Text>
                  <Text style={styles.arrowText}>Review Profile →</Text>
                </View>
              </SectionCard>
            </TouchableOpacity>
          ))
        )}

        {/* Pipeline Information */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Modular NLP Architecture</Text>
          <Text style={styles.infoText}>
            • <Text style={styles.boldText}>Parsing:</Text> PyMuPDF & python-docx with section segmentation.
          </Text>
          <Text style={styles.infoText}>
            • <Text style={styles.boldText}>Taxonomy Matcher:</Text> Normalized canonical tech skills & aliases.
          </Text>
          <Text style={styles.infoText}>
            • <Text style={styles.boldText}>Scoring Engine:</Text> 80% required + 20% preferred weighted coverage.
          </Text>
          <Text style={styles.infoText}>
            • <Text style={styles.boldText}>Topic Ranker:</Text> Feeds 8-12 ranked topics into Module 2 Question Generator.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  appTag: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  healthyBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10B981',
  },
  offlineBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
  },
  checkingBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: '#64748B',
  },
  healthDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  greenDot: {
    backgroundColor: '#10B981',
  },
  redDot: {
    backgroundColor: '#EF4444',
  },
  healthText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  heroHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroSubtext: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 19,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#38BDF8',
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  viewAllText: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
  },
  profileMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  profileMetaText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  arrowText: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 4,
  },
  boldText: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
});
