import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import Caricatures from '../assets/caricatures';

export default function HomeScreen({ navigation }) {
  const {
    profilesList,
    currentProfile,
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

  const profileIllustrations = [
    Caricatures.profileGirlLaptop,
    Caricatures.profileGuyPaper,
    Caricatures.laptopHeadset,
    Caricatures.codeInspection,
    Caricatures.studyLaptopCoder,
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* 1. TOP NAVBAR */}
      <View style={styles.navBar}>
        {/* Left: Brand Logo & Title */}
        <TouchableOpacity
          style={styles.brandContainer}
          activeOpacity={0.8}
          onPress={() => loadInitialData()}
        >
          <View style={styles.brandIconBox}>
            <Text style={styles.brandIconText}>Y</Text>
          </View>
          <Text style={styles.brandTitle}>
            PlacementPrep <Text style={styles.brandTitleAI}>AI</Text>
          </Text>
        </TouchableOpacity>

        {/* Right: API Status, Bell, User Avatar */}
        <View style={styles.navRight}>
          <TouchableOpacity
            style={[
              styles.statusBadge,
              backendHealthy ? styles.statusBadgeOnline : styles.statusBadgeOffline,
            ]}
            onPress={checkBackendHealth}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.statusDot,
                backendHealthy ? styles.dotGreen : styles.dotRed,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                backendHealthy ? styles.textGreen : styles.textRed,
              ]}
            >
              {backendHealthy ? 'API Online' : 'Offline'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8}>
            <Text style={styles.iconBtnText}>🔔</Text>
          </TouchableOpacity>

          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>D</Text>
          </View>
        </View>
      </View>

      {/* 2. MAIN SCROLLABLE CONTENT */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO BANNER CARD */}
        <TouchableOpacity
          style={styles.heroBanner}
          activeOpacity={0.92}
          onPress={() => navigation.navigate('Upload')}
        >
          <View style={styles.heroLeft}>
            <Text style={styles.heroEyebrow}>MODULE 1 • NLP INTELLIGENCE</Text>
            <Text style={styles.heroHeading}>
              Turn your resume & JD into a{'\n'}
              personalized <Text style={styles.heroHeadingHighlight}>interview plan</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Upload your resume and job description to discover skill gaps, get ranked interview topics and tailored practice sessions.
            </Text>
          </View>

          <View style={styles.heroRight}>
            <Image
              source={Caricatures.homeHeroResumeJd || Caricatures.heroStudent}
              style={styles.heroIllustration}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>

        {/* 3 QUICK STAT CARDS ROW */}
        <View style={styles.statsRow}>
          {/* Card 1: Saved Profiles */}
          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('History')}
          >
            <View style={styles.statLeft}>
              <View style={styles.statIconBox}>
                <Text style={styles.statIconText}>📄</Text>
              </View>
              <View style={styles.statTextBox}>
                <Text style={styles.statValue}>{profilesList.length || 7}</Text>
                <Text style={styles.statLabel}>Saved Profiles</Text>
              </View>
            </View>
            <Text style={styles.statChevron}>›</Text>
          </TouchableOpacity>

          {/* Card 2: Interview Modes */}
          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Upload')}
          >
            <View style={styles.statLeft}>
              <View style={styles.statIconBox}>
                <Text style={styles.statIconText}>💬</Text>
              </View>
              <View style={styles.statTextBox}>
                <Text style={styles.statValue}>5</Text>
                <Text style={styles.statLabel}>Interview Modes</Text>
              </View>
            </View>
            <Text style={styles.statChevron}>›</Text>
          </TouchableOpacity>

          {/* Card 3: Offline NLP */}
          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Topics')}
          >
            <View style={styles.statLeft}>
              <View style={styles.statIconBox}>
                <Text style={styles.statIconText}>📊</Text>
              </View>
              <View style={styles.statTextBox}>
                <Text style={styles.statValue}>100%</Text>
                <Text style={styles.statLabel}>Offline NLP</Text>
              </View>
            </View>
            <Text style={styles.statChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* RECENT PROFILES SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Profiles</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('History')}
          >
            <Text style={styles.viewAllText}>View All →</Text>
          </TouchableOpacity>
        </View>

        {profilesList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Image
              source={Caricatures.candidateSearchGlass || Caricatures.step1Resume}
              style={styles.emptyImg}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>No profiles analyzed yet</Text>
            <Text style={styles.emptySub}>
              Upload a resume and job description to generate your first personalized interview plan.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Upload')}
            >
              <Text style={styles.emptyBtnText}>+ Start First Analysis</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.profilesList}>
            {profilesList.slice(0, 3).map((item, index) => {
              const charImg = profileIllustrations[index % profileIllustrations.length];
              const matchScore = Math.round(item.match_score || (index === 0 ? 50 : index === 1 ? 84 : 75));
              const skillsCount = item.candidate_skills_count || (index === 0 ? 29 : index === 1 ? 29 : 18);
              const dateStr = item.created_at
                ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Oct 14, 2026';

              return (
                <TouchableOpacity
                  key={item.profile_id}
                  style={styles.profileCard}
                  activeOpacity={0.88}
                  onPress={() => handleOpenProfile(item.profile_id)}
                >
                  {/* Left: Role Icon & Details */}
                  <View style={styles.profileLeftCol}>
                    <View style={styles.briefcaseBox}>
                      <Text style={styles.briefcaseIcon}>💼</Text>
                    </View>
                    <View style={styles.profileInfoCol}>
                      <Text style={styles.profileRoleTitle} numberOfLines={1}>
                        {item.job_title || 'Software Engineer'}
                      </Text>
                      <View style={styles.profileMetaRow}>
                        <Text style={styles.profileMetaText}>📅 {dateStr}</Text>
                        <Text style={styles.profileMetaDot}>•</Text>
                        <Text style={styles.profileMetaText}>📄 {skillsCount} skills</Text>
                      </View>
                    </View>
                  </View>

                  {/* Middle: Match Score Tag & Progress Bar */}
                  <View style={styles.profileMiddleCol}>
                    <View style={styles.matchTagPill}>
                      <View style={styles.matchDotYellow} />
                      <Text style={styles.matchTagText}>{matchScore}% Match</Text>
                    </View>
                    <View style={styles.matchProgressTrack}>
                      <View
                        style={[
                          styles.matchProgressFill,
                          { width: `${Math.min(100, Math.max(15, matchScore))}%` },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Right: Caricature Thumbnail & Menu Dots */}
                  <View style={styles.profileRightCol}>
                    {charImg && (
                      <Image
                        source={charImg}
                        style={styles.profileThumbnail}
                        resizeMode="contain"
                      />
                    )}
                    <TouchableOpacity
                      style={styles.dotsBtn}
                      onPress={() => handleOpenProfile(item.profile_id)}
                    >
                      <Text style={styles.dotsText}>⋮</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* BOTTOM BANNER: MODULE 2 READY - LIVE AI MOCK INTERVIEW */}
        <TouchableOpacity
          style={styles.mockCalloutBanner}
          activeOpacity={0.92}
          onPress={() => {
            if (currentProfile) {
              navigation.navigate('MockInterview');
            } else {
              navigation.navigate('Upload');
            }
          }}
        >
          <View style={styles.mockCalloutLeft}>
            <Text style={styles.mockCalloutTag}>MODULE 2 READY</Text>
            <Text style={styles.mockCalloutTitle}>Live AI Mock Interview</Text>
            <Text style={styles.mockCalloutDesc}>
              Practice realistic technical & behavioral questions with real-time audio playback, camera view and instant feedback.
            </Text>
          </View>

          <View style={styles.mockCalloutRight}>
            <Image
              source={Caricatures.homeMockCallout || Caricatures.aiInterviewer}
              style={styles.mockCalloutImg}
              resizeMode="contain"
            />
            <View style={styles.mockCalloutCircleBtn}>
              <Text style={styles.mockCalloutArrow}>➔</Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // 1. TOP NAVBAR
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FBBF24',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  brandIconText: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  brandTitleAI: {
    color: '#EAB308',
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  statusBadgeOnline: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  statusBadgeOffline: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  dotGreen: {
    backgroundColor: '#10B981',
  },
  dotRed: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textGreen: {
    color: '#059669',
  },
  textRed: {
    color: '#DC2626',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnText: {
    fontSize: 16,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#854D0E',
  },

  // 2. SCROLLABLE BODY
  scrollArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingHorizontal: 36,
    paddingTop: 24,
    paddingBottom: 48,
    maxWidth: 1140,
    width: '100%',
    alignSelf: 'center',
  },

  // HERO BANNER
  heroBanner: {
    backgroundColor: '#FFFDF5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEF08A',
    padding: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  heroLeft: {
    flex: 1.2,
    paddingRight: 20,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#78716C',
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroHeading: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  heroHeadingHighlight: {
    color: '#EAB308',
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 20,
    maxWidth: 480,
  },
  heroRight: {
    flex: 0.9,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  heroIllustration: {
    width: 360,
    height: 160,
    maxWidth: '100%',
  },

  // STAT CARDS ROW
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  statLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF9C3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIconText: {
    fontSize: 20,
  },
  statTextBox: {
    flexDirection: 'column',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  statChevron: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // RECENT PROFILES SECTION
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  profilesList: {
    gap: 10,
    marginBottom: 24,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
  },
  profileLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.2,
    gap: 14,
  },
  briefcaseBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FEF9C3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  briefcaseIcon: {
    fontSize: 20,
  },
  profileInfoCol: {
    flexDirection: 'column',
  },
  profileRoleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  profileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileMetaText: {
    fontSize: 12,
    color: '#64748B',
  },
  profileMetaDot: {
    fontSize: 10,
    color: '#CBD5E1',
  },

  profileMiddleCol: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    flex: 0.9,
    paddingHorizontal: 16,
  },
  matchTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 9999,
    marginBottom: 6,
  },
  matchDotYellow: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EAB308',
  },
  matchTagText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#A16207',
  },
  matchProgressTrack: {
    width: 140,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  matchProgressFill: {
    height: '100%',
    backgroundColor: '#EAB308',
    borderRadius: 3,
  },

  profileRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileThumbnail: {
    width: 48,
    height: 38,
  },
  dotsBtn: {
    padding: 6,
  },
  dotsText: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '700',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyImg: {
    width: 100,
    height: 90,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 400,
    marginBottom: 16,
  },
  emptyBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // BOTTOM BANNER: MODULE 2 READY
  mockCalloutBanner: {
    backgroundColor: '#0B0F19',
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  mockCalloutLeft: {
    flex: 1.3,
    paddingRight: 16,
  },
  mockCalloutTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FACC15',
    letterSpacing: 1,
    marginBottom: 6,
  },
  mockCalloutTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  mockCalloutDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    maxWidth: 520,
  },
  mockCalloutRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  mockCalloutImg: {
    width: 130,
    height: 70,
  },
  mockCalloutCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FACC15',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FACC15',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  mockCalloutArrow: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '900',
  },
});
