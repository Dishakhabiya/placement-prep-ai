import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import ScoreRing from '../components/ScoreRing';
import SectionCard from '../components/SectionCard';
import SkillChip from '../components/SkillChip';
import Caricatures from '../assets/caricatures';


export default function MatchSummaryScreen({ navigation }) {
  const { currentProfile } = useProfileStore();

  if (!currentProfile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No match data available.</Text>
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

  const { match, job, project_job_links, mode } = currentProfile;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Score Ring Section */}
        <View style={styles.scoreCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Image
              source={Caricatures.handshakeOffer || Caricatures.trophySuccess}
              style={{ width: 56, height: 56, resizeMode: 'contain', marginRight: 12 }}
            />
            <View>
              <Text style={styles.scoreRoleTitle}>{job.title || 'Target Position'}</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '600' }}>Placement Alignment Score</Text>
            </View>
          </View>
          <ScoreRing score={match.score} size={160} label="Resume Coverage" />
          <View style={styles.scoreFormulaNotice}>
            <Text style={styles.scoreFormulaText}>
              📊 <Text style={styles.boldText}>Score Formula:</Text> 80% weight for required skills + 20% weight for preferred skills.
            </Text>
            <Text style={styles.disclaimerText}>
              * Note: Match score reflects resume keyword & section coverage, not hiring likelihood.
            </Text>
          </View>
        </View>

        {/* 1. Matched Skills */}
        <SectionCard
          title="Matched Skills"
          subtitle="Skills identified in resume that match job requirements"
          badge={`${match.matched.length} Matched`}
          badgeColor="#10B981"
        >
          {match.matched.length === 0 ? (
            <Text style={styles.dimText}>No overlapping skills detected yet.</Text>
          ) : (
            <View style={styles.chipsWrap}>
              {match.matched.map((skill, idx) => (
                <SkillChip key={`matched-${idx}`} label={skill} variant="matched" />
              ))}
            </View>
          )}
        </SectionCard>

        {/* 2. Requirements Not Found in Resume */}
        <SectionCard
          title="Requirements Not Found in Resume"
          subtitle="Skills requested by JD but not explicitly stated on candidate resume"
          badge={`${match.missing.length} Gaps`}
          badgeColor="#EF4444"
        >
          {match.missing.length === 0 ? (
            <Text style={styles.successText}>🎉 All JD requirements were detected in the resume!</Text>
          ) : (
            <View style={styles.chipsWrap}>
              {match.missing.map((skill, idx) => (
                <SkillChip key={`missing-${idx}`} label={skill} variant="missing" />
              ))}
            </View>
          )}
        </SectionCard>

        {/* 3. Extra Skills */}
        <SectionCard
          title="Extra Candidate Skills"
          subtitle="Valuable candidate skills not explicitly requested in JD"
          badge={`${match.extra.length} Extra`}
          badgeColor="#6366F1"
        >
          {match.extra.length === 0 ? (
            <Text style={styles.dimText}>No extra skills outside the JD scope.</Text>
          ) : (
            <View style={styles.chipsWrap}>
              {match.extra.map((skill, idx) => (
                <SkillChip key={`extra-${idx}`} label={skill} variant="extra" />
              ))}
            </View>
          )}
        </SectionCard>

        {/* 4. Project-to-Job Responsibility Links */}
        <SectionCard
          title="Project to Job Links"
          subtitle="Semantic & tech stack alignment between projects and responsibilities"
        >
          {project_job_links.length === 0 ? (
            <Text style={styles.dimText}>No direct project-to-responsibility links established.</Text>
          ) : (
            project_job_links.map((link, idx) => (
              <View key={idx} style={styles.linkCard}>
                <View style={styles.linkHeader}>
                  <Text style={styles.linkProjectName}>📂 {link.project}</Text>
                  <View style={styles.similarityBadge}>
                    <Text style={styles.similarityText}>
                      {Math.round(link.similarity * 100)}% Match
                    </Text>
                  </View>
                </View>

                {/* Similarity Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.round(link.similarity * 100)}%` },
                    ]}
                  />
                </View>

                <Text style={styles.linkRespText}>
                  🎯 <Text style={styles.boldText}>Responsibility:</Text> {link.responsibility}
                </Text>
              </View>
            ))
          )}
        </SectionCard>

        {/* Module 2 Mock Interview Prep Banner */}
        <View style={styles.prepBanner}>
          <Image
            source={Caricatures.rocketLaunchCoder || Caricatures.aiInterviewer}
            style={{ width: 68, height: 68, resizeMode: 'contain', marginRight: 14 }}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.prepBadge}>
              <Text style={styles.prepBadgeText}>NEXT STEP: MODULE 2</Text>
            </View>
            <Text style={styles.prepBannerTitle}>Real-time AI Mock Interview</Text>
            <Text style={styles.prepBannerDesc}>
              Practice personalized questions tailored to your gaps with real-time video & voice coaching.
            </Text>
          </View>
        </View>

        {/* Navigate to Interview Topics */}
        <TouchableOpacity
          style={styles.topicsBtn}
          onPress={() => navigation.navigate('Topics')}
        >
          <Text style={styles.topicsBtnText}>Launch Mock Interview Questions →</Text>
        </TouchableOpacity>
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
    maxWidth: 960,
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
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  scoreRoleTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  scoreFormulaNotice: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scoreFormulaText: {
    fontSize: 12.5,
    color: '#374151',
    lineHeight: 18,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  boldText: {
    fontWeight: '800',
    color: '#111827',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  dimText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  successText: {
    fontSize: 12.5,
    color: '#065F46',
    fontWeight: '700',
  },
  linkCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  linkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkProjectName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  similarityBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  similarityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  linkRespText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 17,
  },
  topicsBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  topicsBtnText: {
    color: '#FFC82C',
    fontSize: 15,
    fontWeight: '800',
  },
  prepBanner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  prepBadge: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  prepBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#854D0E',
    letterSpacing: 0.5,
  },
  prepBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  prepBannerDesc: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
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
