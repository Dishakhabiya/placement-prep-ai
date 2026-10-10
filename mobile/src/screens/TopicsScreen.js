import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import SectionCard from '../components/SectionCard';

export default function TopicsScreen({ navigation }) {
  const { currentProfile } = useProfileStore();
  const [filterPriority, setFilterPriority] = useState('all');

  if (!currentProfile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No interview topics available.</Text>
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

  const { interview_topics, mode, job, profile_id, candidate } = currentProfile;

  const filteredTopics = interview_topics.filter((t) => {
    if (filterPriority === 'all') return true;
    return t.priority.toLowerCase() === filterPriority;
  });

  const getPriorityStyle = (priority) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return {
          container: styles.highBadge,
          text: styles.highText,
          label: 'HIGH PRIORITY',
        };
      case 'medium':
        return {
          container: styles.mediumBadge,
          text: styles.mediumText,
          label: 'MEDIUM PRIORITY',
        };
      default:
        return {
          container: styles.lowBadge,
          text: styles.lowText,
          label: 'LOW PRIORITY',
        };
    }
  };

  const handleStartInterviewHandoff = () => {
    // Integration handoff point for Person 2's question generation module
    const handoffPayload = {
      profile_id: profile_id,
      mode: mode,
      job_title: job.title,
      interview_topics: interview_topics,
      candidate_projects: candidate.projects,
      job_responsibilities: job.responsibilities,
    };

    Alert.alert(
      'Ready for Module 2 Mock Interview',
      `Profile ID: ${profile_id}\n\n${interview_topics.length} ranked topics and project metadata packaged for Module 2 Question Engine.`,
      [
        {
          text: 'Return Home',
          onPress: () => navigation.navigate('Home'),
        },
        {
          text: 'Stay on Topics',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Module 2 Integration Banner */}
        <View style={styles.integrationBanner}>
          <View style={styles.integrationHeader}>
            <Text style={styles.integrationTag}>MODULE 2 HANDOFF READY</Text>
            <Text style={styles.topicsCountBadge}>{interview_topics.length} Topics</Text>
          </View>
          <Text style={styles.integrationTitle}>Targeted Interview Topics</Text>
          <Text style={styles.integrationDesc}>
            Topics generated for {job.title} ({mode.toUpperCase()} mode), prioritized by resume skill gaps, candidate projects, and key role deliverables.
          </Text>

          {/* Priority Filters */}
          <View style={styles.filterRow}>
            {['all', 'high', 'medium', 'low'].map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.filterPill,
                  filterPriority === p && styles.filterPillActive,
                ]}
                onPress={() => setFilterPriority(p)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterPriority === p && styles.filterPillTextActive,
                  ]}
                >
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Ranked Topics List */}
        {filteredTopics.map((topicItem, index) => {
          const { container, text, label } = getPriorityStyle(topicItem.priority);
          return (
            <View key={index} style={styles.topicCard}>
              <View style={styles.topicTopRow}>
                <View style={styles.topicRankBadge}>
                  <Text style={styles.topicRankNum}>#{index + 1}</Text>
                </View>
                <View style={[styles.priorityBadge, container]}>
                  <Text style={[styles.priorityBadgeText, text]}>{label}</Text>
                </View>
              </View>

              <Text style={styles.topicTitle}>{topicItem.topic}</Text>

              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>Target Evaluation Objective:</Text>
                <Text style={styles.reasonText}>{topicItem.reason}</Text>
              </View>
            </View>
          );
        })}

        {/* Start Interview CTA */}
        <TouchableOpacity
          style={styles.startInterviewBtn}
          onPress={handleStartInterviewHandoff}
        >
          <Text style={styles.startInterviewBtnText}>🚀 Start Mock Interview (Module 2) →</Text>
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
  integrationBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  integrationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  integrationTag: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '800',
    letterSpacing: 1,
  },
  topicsCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderColor: '#10B981',
    borderWidth: 1,
  },
  integrationTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  integrationDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterPillActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  topicCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  topicTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topicRankBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  topicRankNum: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '800',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  highBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  highText: {
    color: '#F87171',
  },
  mediumBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
  },
  mediumText: {
    color: '#FBBF24',
  },
  lowBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
  },
  lowText: {
    color: '#60A5FA',
  },
  topicTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  reasonBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reasonLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16,
  },
  startInterviewBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startInterviewBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
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
