import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Image,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import SectionCard from '../components/SectionCard';
import SkillChip from '../components/SkillChip';
import ErrorBanner from '../components/ErrorBanner';
import Caricatures from '../assets/caricatures';


export default function ReviewProfileScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const {
    currentProfile,
    saveCorrections,
    addCandidateSkill,
    removeCandidateSkill,
    isLoading,
    error,
    clearError,
  } = useProfileStore();

  const [newSkillText, setNewSkillText] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState({});

  if (!currentProfile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No profile loaded.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.primaryBtnText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { candidate, job, match, mode, profile_id } = currentProfile;

  const handleAddSkill = () => {
    if (newSkillText.trim()) {
      addCandidateSkill(newSkillText.trim());
      setNewSkillText('');
    }
  };

  const handleSaveProfile = async () => {
    try {
      clearError();
      await saveCorrections(candidate, job, mode);
      setSaveSuccessMsg('Profile corrections saved & scores recalculated!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (e) {
      // Handled in store
    }
  };

  const toggleProject = (index) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const projectIcons = ['📊', '📅', '📝', '⭐', '💻', '🚀'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header Summary Banner */}
        <View style={styles.headerBanner}>
          <Image
            source={Caricatures.candidateTargetCircle || Caricatures.profileGirlLaptop}
            style={styles.headerCaricature}
          />
          <View style={styles.headerLeft}>
            <Text style={styles.modeTag}>MODE: {mode.toUpperCase()}</Text>
            <Text style={styles.roleTitle}>{job.title || 'Software Engineer'}</Text>
            <Text style={styles.idText}>ID: {profile_id}</Text>
            <Text style={styles.bannerDescription}>
              Review and adjust extracted candidate details. Changes will automatically update the gap analysis and topic generator.
            </Text>
          </View>

          <View style={styles.coverageBadgeBox}>
            <Text style={styles.coveragePercent}>{Math.round(match.score)}%</Text>
            <Text style={styles.coverageLabel}>COVERAGE</Text>
          </View>
        </View>

        {saveSuccessMsg && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓ {saveSuccessMsg}</Text>
          </View>
        )}
        {error && <ErrorBanner message={error} onDismiss={clearError} />}

        {/* 2-Column Responsive Layout */}
        <View style={[styles.columnsWrap, isWide && styles.columnsRow]}>
          {/* ================= LEFT COLUMN ================= */}
          <View style={[styles.column, isWide && styles.columnLeft]}>
            {/* Candidate Skills Card */}
            <SectionCard
              title="Candidate Skills"
              subtitle={`${candidate.skills.length} skills detected (Editable)`}
              badge={`${candidate.skills.length} Skills`}
            >
              <View style={styles.chipsWrap}>
                {candidate.skills.map((skill, idx) => (
                  <SkillChip
                    key={`${skill}-${idx}`}
                    label={skill}
                    variant="neutral"
                    isRemovable={true}
                    onRemove={() => removeCandidateSkill(skill)}
                  />
                ))}
              </View>

              {/* Add Skill Input */}
              <View style={styles.addSkillRow}>
                <TextInput
                  style={styles.addSkillInput}
                  placeholder="+ Add skill (e.g., Docker, PyTorch)..."
                  placeholderTextColor="#9CA3AF"
                  value={newSkillText}
                  onChangeText={setNewSkillText}
                  onSubmitEditing={handleAddSkill}
                />
                <TouchableOpacity style={styles.addSkillBtn} onPress={handleAddSkill}>
                  <Text style={styles.addSkillBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </SectionCard>

            {/* Extracted Projects Card */}
            <SectionCard
              title="Extracted Projects"
              subtitle={`${candidate.projects.length} projects parsed from resume`}
            >
              {candidate.projects.length === 0 ? (
                <Text style={styles.dimText}>No explicit projects detected in resume.</Text>
              ) : (
                candidate.projects.map((proj, pIdx) => {
                  const isExpanded = expandedProjects[pIdx] !== false; // default expanded
                  const icon = projectIcons[pIdx % projectIcons.length];
                  const cleanTitle = (proj.title || 'Untitled Project').replace(
                    /^[\s\-\*•\u2022\u25cf]+\s*/,
                    ''
                  );

                  return (
                    <TouchableOpacity
                      key={pIdx}
                      style={styles.projectAccordion}
                      activeOpacity={0.9}
                      onPress={() => toggleProject(pIdx)}
                    >
                      <View style={styles.projectHeaderRow}>
                        <View style={styles.projectIconWrap}>
                          <Text style={styles.projectIcon}>{icon}</Text>
                        </View>
                        <View style={styles.projectTitleWrap}>
                          <Text style={styles.projectTitle}>{cleanTitle}</Text>
                          {proj.tech && proj.tech.length > 0 && (
                            <View style={styles.projectTechWrap}>
                              {proj.tech.map((t, tIdx) => (
                                <View key={tIdx} style={styles.miniTechBadge}>
                                  <Text style={styles.miniTechText}>{t}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                        <Text style={styles.chevronIcon}>{isExpanded ? '⌃' : '⌄'}</Text>
                      </View>

                      {isExpanded && proj.description ? (
                        <View style={styles.projectBody}>
                          <Text style={styles.projectDesc}>{proj.description}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </SectionCard>
          </View>

          {/* ================= RIGHT COLUMN ================= */}
          <View style={[styles.column, isWide && styles.columnRight]}>
            {/* Target Role Requirements Card */}
            <SectionCard
              title="Target Role Requirements"
              subtitle={`JD extracted skills for ${job.title || 'Role'}`}
            >
              <Text style={styles.subHeading}>
                Required Skills ({job.required_skills?.length || 0}):
              </Text>
              <View style={styles.chipsWrap}>
                {job.required_skills && job.required_skills.length > 0 ? (
                  job.required_skills.map((s, idx) => (
                    <SkillChip key={`req-${idx}`} label={s} variant="matched" />
                  ))
                ) : (
                  <Text style={styles.dimText}>No mandatory skills specified.</Text>
                )}
              </View>

              <Text style={[styles.subHeading, { marginTop: 14 }]}>
                Preferred / Bonus Skills ({job.preferred_skills?.length || 0}):
              </Text>
              <View style={styles.chipsWrap}>
                {job.preferred_skills && job.preferred_skills.length > 0 ? (
                  job.preferred_skills.map((s, idx) => (
                    <SkillChip key={`pref-${idx}`} label={s} variant="extra" />
                  ))
                ) : (
                  <Text style={styles.dimText}>No preferred skills specified.</Text>
                )}
              </View>
            </SectionCard>

            {/* Education & Experience Card */}
            <SectionCard title="Education & Experience" subtitle="Background information">
              <View style={styles.bgInfoSection}>
                <View style={styles.bgIconBox}>
                  <Text style={styles.bgIcon}>🎓</Text>
                </View>
                <View style={styles.bgTextWrap}>
                  <Text style={styles.bgTitle}>Education</Text>
                  {candidate.education && candidate.education.length > 0 ? (
                    candidate.education.map((edu, idx) => (
                      <Text key={`edu-${idx}`} style={styles.bgContentText}>
                        {edu}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.dimText}>No education section detected.</Text>
                  )}
                </View>
              </View>

              <View style={[styles.bgInfoSection, { marginTop: 14 }]}>
                <View style={styles.bgIconBox}>
                  <Text style={styles.bgIcon}>💼</Text>
                </View>
                <View style={styles.bgTextWrap}>
                  <Text style={styles.bgTitle}>Experience</Text>
                  {candidate.experience && candidate.experience.length > 0 ? (
                    candidate.experience.map((exp, idx) => (
                      <Text key={`exp-${idx}`} style={styles.bgContentText}>
                        {exp}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.dimText}>No experience section detected.</Text>
                  )}
                </View>
              </View>
            </SectionCard>

            {/* Action Buttons */}
            <View style={styles.actionsBox}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveProfile}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#4F46E5" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>💾 Save Corrections</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.matchSummaryBtn}
                onPress={() => navigation.navigate('MatchSummary')}
              >
                <Text style={styles.matchSummaryBtnText}>View Match Summary →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 1140,
    width: '100%',
    alignSelf: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Header Banner
  headerBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 16,
  },
  modeTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 1,
    marginBottom: 4,
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  idText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  bannerDescription: {
    fontSize: 12.5,
    color: '#4B5563',
    lineHeight: 18,
  },
  headerCaricature: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    marginRight: 16,
    borderRadius: 30,
    backgroundColor: '#FEF9C3',
    alignSelf: 'center',
  },
  coverageBadgeBox: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coveragePercent: {
    fontSize: 22,
    fontWeight: '900',
    color: '#854D0E',
  },
  coverageLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#A16207',
    letterSpacing: 0.8,
  },


  successBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#065F46',
    fontWeight: '700',
    fontSize: 13,
  },

  // Layout Columns
  columnsWrap: {
    flexDirection: 'column',
    gap: 16,
  },
  columnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
  },
  columnLeft: {
    flex: 1.25,
  },
  columnRight: {
    flex: 1,
  },

  // Chips
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 8,
  },

  // Add Skill
  addSkillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addSkillInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    marginRight: 8,
  },
  addSkillBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  addSkillBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // Projects
  projectAccordion: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  projectHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  projectIcon: {
    fontSize: 16,
  },
  projectTitleWrap: {
    flex: 1,
  },
  projectTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
  },
  projectTechWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  miniTechBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  miniTechText: {
    fontSize: 10.5,
    color: '#1E40AF',
    fontWeight: '600',
  },
  chevronIcon: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  projectBody: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  projectDesc: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 17,
  },

  // Target Role & Headings
  subHeading: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  dimText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },

  // Education & Experience
  bgInfoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  bgIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  bgIcon: {
    fontSize: 16,
  },
  bgTextWrap: {
    flex: 1,
  },
  bgTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  bgContentText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
  },

  // Actions Box
  actionsBox: {
    gap: 10,
    marginTop: 4,
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  saveBtnText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 14,
  },
  matchSummaryBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  matchSummaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
