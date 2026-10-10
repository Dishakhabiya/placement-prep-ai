import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import SectionCard from '../components/SectionCard';
import SkillChip from '../components/SkillChip';
import ErrorBanner from '../components/ErrorBanner';

export default function ReviewProfileScreen({ navigation }) {
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
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (e) {
      // Handled in store
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header summary banner */}
        <View style={styles.banner}>
          <View style={styles.bannerHeader}>
            <View>
              <Text style={styles.bannerMode}>MODE: {mode.toUpperCase()}</Text>
              <Text style={styles.bannerTitle}>{job.title || 'Software Engineer'}</Text>
              <Text style={styles.profileIdText}>ID: {profile_id}</Text>
            </View>
            <View style={styles.scorePill}>
              <Text style={styles.scorePillNum}>{Math.round(match.score)}%</Text>
              <Text style={styles.scorePillLabel}>Coverage</Text>
            </View>
          </View>
          <Text style={styles.bannerSubtext}>
            Review and adjust extracted candidate details. Changes will automatically update the gap analysis and topic generator.
          </Text>
        </View>

        {saveSuccessMsg && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓ {saveSuccessMsg}</Text>
          </View>
        )}
        {error && <ErrorBanner message={error} onDismiss={clearError} />}

        {/* Section 1: Candidate Technical Skills */}
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
              placeholder="Add skill (e.g., Docker, PyTorch)..."
              placeholderTextColor="#64748B"
              value={newSkillText}
              onChangeText={setNewSkillText}
              onSubmitEditing={handleAddSkill}
            />
            <TouchableOpacity style={styles.addSkillBtn} onPress={handleAddSkill}>
              <Text style={styles.addSkillBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* Section 2: Candidate Projects */}
        <SectionCard
          title="Extracted Projects"
          subtitle={`${candidate.projects.length} projects parsed from resume`}
        >
          {candidate.projects.length === 0 ? (
            <Text style={styles.dimText}>No explicit projects detected in resume.</Text>
          ) : (
            candidate.projects.map((proj, pIdx) => (
              <View key={pIdx} style={styles.projectItem}>
                <Text style={styles.projectTitle}>
                  • {(proj.title || 'Untitled Project').replace(/^[\s\-\*•\u2022\u25cf]+\s*/, '')}
                </Text>
                {proj.description ? (
                  <Text style={styles.projectDesc}>{proj.description}</Text>
                ) : null}
                {proj.tech && proj.tech.length > 0 && (
                  <View style={styles.projectTechRow}>
                    {proj.tech.map((t, tIdx) => (
                      <View key={tIdx} style={styles.miniTechBadge}>
                        <Text style={styles.miniTechText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </SectionCard>

        {/* Section 3: Target Role Requirements */}
        <SectionCard
          title="Target Role Requirements"
          subtitle={`JD extracted skills for ${job.title}`}
        >
          <Text style={styles.subHeading}>Required Skills ({job.required_skills.length}):</Text>
          <View style={styles.chipsWrap}>
            {job.required_skills.length > 0 ? (
              job.required_skills.map((s, idx) => (
                <SkillChip key={`req-${idx}`} label={s} variant="matched" />
              ))
            ) : (
              <Text style={styles.dimText}>No mandatory skills specified.</Text>
            )}
          </View>

          <Text style={[styles.subHeading, { marginTop: 12 }]}>
            Preferred / Bonus Skills ({job.preferred_skills.length}):
          </Text>
          <View style={styles.chipsWrap}>
            {job.preferred_skills.length > 0 ? (
              job.preferred_skills.map((s, idx) => (
                <SkillChip key={`pref-${idx}`} label={s} variant="extra" />
              ))
            ) : (
              <Text style={styles.dimText}>No preferred skills specified.</Text>
            )}
          </View>
        </SectionCard>

        {/* Section 4: Education & Experience */}
        <SectionCard title="Education & Experience" subtitle="Background information">
          <Text style={styles.subHeading}>Education:</Text>
          {candidate.education.length > 0 ? (
            candidate.education.map((edu, idx) => (
              <Text key={`edu-${idx}`} style={styles.bulletItem}>
                🎓 {edu}
              </Text>
            ))
          ) : (
            <Text style={styles.dimText}>No education section detected.</Text>
          )}

          <Text style={[styles.subHeading, { marginTop: 10 }]}>Experience:</Text>
          {candidate.experience.length > 0 ? (
            candidate.experience.map((exp, idx) => (
              <Text key={`exp-${idx}`} style={styles.bulletItem}>
                💼 {exp}
              </Text>
            ))
          ) : (
            <Text style={styles.dimText}>No experience section detected.</Text>
          )}
        </SectionCard>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveProfile}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    marginBottom: 16,
  },
  banner: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bannerMode: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '800',
    letterSpacing: 1,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  profileIdText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  bannerSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
  scorePill: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  scorePillNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#38BDF8',
  },
  scorePillLabel: {
    fontSize: 9,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  addSkillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  addSkillInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginRight: 8,
  },
  addSkillBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addSkillBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  projectItem: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  projectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 4,
  },
  projectDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
  projectTechRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  miniTechBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  miniTechText: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  subHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 6,
  },
  dimText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  bulletItem: {
    fontSize: 12,
    color: '#CBD5E1',
    marginBottom: 4,
    lineHeight: 17,
  },
  buttonRow: {
    flexDirection: 'column',
    marginTop: 8,
    gap: 10,
  },
  saveBtn: {
    backgroundColor: '#1E293B',
    borderColor: '#3B82F6',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  matchSummaryBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  matchSummaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
