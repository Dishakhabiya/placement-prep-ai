import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import ScoreRing from '../components/ScoreRing';
import SectionCard from '../components/SectionCard';
import SkillChip from '../components/SkillChip';

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
          <Text style={styles.scoreRoleTitle}>{job.title || 'Target Position'}</Text>
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

        {/* Navigate to Interview Topics */}
        <TouchableOpacity
          style={styles.topicsBtn}
          onPress={() => navigation.navigate('Topics')}
        >
          <Text style={styles.topicsBtnText}>View Ranked Interview Topics (Module 2) →</Text>
        </TouchableOpacity>
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
  scoreCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreRoleTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
    textAlign: 'center',
  },
  scoreFormulaNotice: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  scoreFormulaText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 17,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 4,
  },
  boldText: {
    fontWeight: '700',
    color: '#F1F5F9',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  dimText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  successText: {
    fontSize: 12,
    color: '#34D399',
    fontWeight: '600',
  },
  linkCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  linkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkProjectName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38BDF8',
    flex: 1,
  },
  similarityBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  similarityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#1E293B',
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
  },
  linkRespText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
  topicsBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  topicsBtnText: {
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
