import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import Caricatures from '../assets/caricatures';

export default function HomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 880;

  const {
    profilesList,
    backendHealthy,
    checkBackendHealth,
    loadInitialData,
    fetchProfile,
  } = useProfileStore();

  const [activeNav, setActiveNav] = useState('Home');

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

  const navItems = [
    { name: 'Home', icon: '🏠', action: () => {} },
    { name: 'Resume & JD Upload', icon: '📄', action: () => navigation.navigate('Upload') },
    { name: 'Ranked Interview Topics', icon: '🎯', action: () => navigation.navigate('Topics') },
    { name: 'Saved Profiles', icon: '📁', action: () => navigation.navigate('History') },
    {
      name: 'Mock Interview',
      icon: '🎙️',
      action: () => {
        if (currentProfile) {
          navigation.navigate('MockInterview');
        } else {
          navigation.navigate('Upload');
        }
      },
    },
  ];

  const profileIllustrations = [
    Caricatures.profileGirlLaptop,
    Caricatures.profileGuyPaper,
    Caricatures.laptopHeadset,
    Caricatures.codeInspection,
  ];

  const profileColors = ['#3B82F6', '#EC4899', '#F59E0B', '#10B981'];

  // Render Sidebar
  const renderSidebar = () => (
    <View style={styles.sidebar}>
      {/* Brand Logo */}
      <View style={styles.brandRow}>
        <View style={styles.brandLogoBox}>
          <Text style={styles.brandLogoText}>Y</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>PlacementPrep AI</Text>
          <Text style={styles.brandTag}>MODULE 1 • NLP INTELLIGENCE</Text>
        </View>
      </View>

      {/* Nav Menu */}
      <View style={styles.navMenu}>
        {navItems.map((item) => {
          const isActive = activeNav === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => {
                setActiveNav(item.name);
                item.action();
              }}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Upgrade Card with Caricature */}
      <View style={styles.upgradeCard}>
        <Image
          source={Caricatures.sidebarUpgrade}
          style={styles.upgradeImg}
          resizeMode="contain"
        />
        <Text style={styles.upgradeTitle}>Unlock more analyses with Premium</Text>
        <TouchableOpacity
          style={styles.upgradeBtn}
          onPress={() => navigation.navigate('Upload')}
        >
          <Text style={styles.upgradeBtnText}>Upgrade →</Text>
        </TouchableOpacity>
      </View>

      {/* User Footer Profile */}
      <View style={styles.userProfileFooter}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>D</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>Disha</Text>
          <Text style={styles.userEmail} numberOfLines={1}>dishaj726@gmail.com</Text>
        </View>
        <Text style={styles.chevron}>⌵</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={[styles.mainLayout, isDesktop && styles.desktopLayout]}>
        {isDesktop && renderSidebar()}

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.contentContainer, !isDesktop && styles.mobileContent]}
        >
          {/* Top Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerModuleTag}>MODULE 1 • NLP INTELLIGENCE</Text>
              <Text style={styles.headerTitle}>PlacementPrep AI</Text>
              <Text style={styles.headerSub}>
                Extract technical skills, analyze job description requirements, detect skill gaps, and generate ranked interview topics tailored for mock sessions.
              </Text>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[
                  styles.statusBadge,
                  backendHealthy ? styles.statusBadgeOnline : styles.statusBadgeOffline,
                ]}
                onPress={checkBackendHealth}
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

              <TouchableOpacity style={styles.bellBtn}>
                <Text style={styles.bellIcon}>🔔</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero Banner Card */}
          <View style={styles.heroBanner}>
            <View style={styles.heroContent}>
              <Text style={styles.heroTag}>GET STARTED</Text>
              <Text style={styles.heroHeading}>
                Turn Your Resume & JD into a{' '}
                <Text style={styles.heroHeadingAccent}>Personalized Interview Plan</Text>
              </Text>
              <Text style={styles.heroDesc}>
                Upload your resume and job description to discover skill gaps, get ranked interview topics and tailored practice sessions.
              </Text>
              <TouchableOpacity
                style={styles.heroBtn}
                onPress={() => navigation.navigate('Upload')}
              >
                <Text style={styles.heroBtnText}>+ Start New Analysis</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroImageWrapper}>
              <Image
                source={Caricatures.heroStudent}
                style={styles.heroCaricature}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Quick Stats Grid */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Text style={styles.statIcon}>📄</Text>
              </View>
              <View>
                <Text style={styles.statNumber}>{profilesList.length}</Text>
                <Text style={styles.statLabel}>Saved Profiles</Text>
              </View>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#FDF2F8' }]}>
                <Text style={styles.statIcon}>💬</Text>
              </View>
              <View>
                <Text style={styles.statNumber}>5</Text>
                <Text style={styles.statLabel}>Interview Modes</Text>
              </View>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#FEF9C3' }]}>
                <Text style={styles.statIcon}>📊</Text>
              </View>
              <View>
                <Text style={styles.statNumber}>100%</Text>
                <Text style={styles.statLabel}>Offline NLP</Text>
              </View>
            </View>
          </View>

          {/* Recent Profiles Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Profiles</Text>
            {profilesList.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('History')}>
                <Text style={styles.viewAllLink}>
                  View All ({profilesList.length}) ›
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {profilesList.length === 0 ? (
            <View style={styles.emptyCard}>
              <Image
                source={Caricatures.cardChecklistSearch || Caricatures.step1Resume}
                style={styles.emptyImg}
                resizeMode="contain"
              />
              <Text style={styles.emptyTitle}>No profiles analyzed yet</Text>
              <Text style={styles.emptySub}>
                Upload a PDF/DOCX resume and match against a job description to generate personalized interview plans.
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
              {profilesList.slice(0, 4).map((item, index) => {
                const charImg = profileIllustrations[index % profileIllustrations.length];
                const iconColor = profileColors[index % profileColors.length];

                return (
                  <View key={item.profile_id} style={styles.profileCard}>
                    {/* Left: Role Icon & Details */}
                    <View style={styles.profileLeft}>
                      <View style={[styles.profileIconWrap, { backgroundColor: `${iconColor}15` }]}>
                        <Text style={styles.briefcaseIcon}>💼</Text>
                      </View>
                      <View style={styles.profileTextWrap}>
                        <Text style={styles.profileRoleTitle} numberOfLines={1}>
                          {item.job_title || 'Software Engineer'}
                        </Text>
                        <Text style={styles.profileMeta}>
                          Mode: {item.mode?.toUpperCase()} • {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                        <Text style={styles.profileSkillsCount}>
                          {item.candidate_skills_count || 21} skills extracted
                        </Text>
                      </View>
                    </View>

                    {/* Middle: Match Badge & Action Button */}
                    <View style={styles.profileMiddle}>
                      <View style={styles.matchPill}>
                        <View style={styles.matchRing} />
                        <Text style={styles.matchPillText}>
                          {Math.round(item.match_score || 34)}% Match
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.reviewBtn}
                        onPress={() => handleOpenProfile(item.profile_id)}
                      >
                        <Text style={styles.reviewBtnText}>Review Profile →</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Right: Caricature & Dots */}
                    <View style={styles.profileRight}>
                      {charImg && (
                        <Image
                          source={charImg}
                          style={styles.profileCaricature}
                          resizeMode="contain"
                        />
                      )}
                      <TouchableOpacity style={styles.dotsBtn}>
                        <Text style={styles.dotsText}>⋮</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Quick Mock Interview Callout Banner */}
          <View style={styles.mockCalloutCard}>
            <View style={styles.mockCalloutContent}>
              <View style={styles.yellowBadgeTag}>
                <Text style={styles.yellowBadgeText}>MODULE 2 READY</Text>
              </View>
              <Text style={styles.mockCalloutTitle}>Live AI Mock Interview</Text>
              <Text style={styles.mockCalloutDesc}>
                Practice realistic technical & behavioral questions with real-time audio playback, camera view, and instant spoken feedback.
              </Text>
              <TouchableOpacity
                style={styles.mockCalloutBtn}
                onPress={() => navigation.navigate('MockInterview')}
              >
                <Text style={styles.mockCalloutBtnText}>Launch Mock Interview Session 🎙️</Text>
              </TouchableOpacity>
            </View>
            <Image
              source={Caricatures.aiInterviewer}
              style={styles.mockCalloutImg}
              resizeMode="contain"
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainLayout: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  desktopLayout: {
    flexDirection: 'row',
  },
  // Sidebar
  sidebar: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    paddingVertical: 24,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  brandLogoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  brandLogoText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  brandTag: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
  },
  navMenu: {
    flex: 1,
    marginTop: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: '#EEF2FF',
  },
  navIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  navLabelActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  upgradeCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  upgradeImg: {
    width: 100,
    height: 70,
    marginBottom: 10,
  },
  upgradeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 10,
  },
  upgradeBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'center',
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  userProfileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F766E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  userEmail: {
    fontSize: 11,
    color: '#6B7280',
  },
  chevron: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  // Main Content Scroll Area
  scrollArea: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  mobileContent: {
    padding: 16,
  },

  // Top Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 16,
  },
  headerModuleTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headerSub: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    maxWidth: 700,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
  },
  statusBadgeOnline: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
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
    fontWeight: '700',
  },
  textGreen: {
    color: '#065F46',
  },
  textRed: {
    color: '#B91C1C',
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellIcon: {
    fontSize: 15,
  },

  // Hero Card
  heroBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  heroContent: {
    flex: 1.2,
    paddingRight: 16,
  },
  heroTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 28,
    marginBottom: 8,
  },
  heroHeadingAccent: {
    color: '#4338CA',
  },
  heroDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
    marginBottom: 18,
  },
  heroBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 22,
    alignSelf: 'flex-start',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  heroBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  heroImageWrapper: {
    flex: 0.9,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  heroCaricature: {
    width: 250,
    height: 140,
  },

  // Quick Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  statIcon: {
    fontSize: 20,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 2,
  },

  // Recent Profiles Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  viewAllLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3B82F6',
  },

  // Profile List Items
  profilesList: {
    gap: 12,
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.5,
  },
  profileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  briefcaseIcon: {
    fontSize: 20,
  },
  profileTextWrap: {
    flex: 1,
  },
  profileRoleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  profileMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  profileSkillsCount: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  profileMiddle: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    gap: 6,
  },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  matchRing: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#854D0E',
    marginRight: 6,
  },
  matchPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#854D0E',
  },
  reviewBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  profileRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileCaricature: {
    width: 90,
    height: 55,
    marginRight: 10,
  },
  dotsBtn: {
    padding: 6,
  },
  dotsText: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: '700',
  },

  // Mock Callout Banner
  mockCalloutCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 30,
  },
  mockCalloutContent: {
    flex: 1.3,
    paddingRight: 16,
  },
  yellowBadgeTag: {
    backgroundColor: '#FFC82C',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  yellowBadgeText: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  mockCalloutTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  mockCalloutDesc: {
    fontSize: 12,
    color: '#D1D5DB',
    lineHeight: 18,
    marginBottom: 14,
  },
  mockCalloutBtn: {
    backgroundColor: '#FFC82C',
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  mockCalloutBtnText: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 12,
  },
  mockCalloutImg: {
    width: 140,
    height: 110,
  },

  // Empty State
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyImg: {
    width: 130,
    height: 100,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 450,
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 20,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
