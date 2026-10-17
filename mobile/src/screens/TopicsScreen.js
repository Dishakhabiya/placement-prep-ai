import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import SectionCard from '../components/SectionCard';
import Caricatures from '../assets/caricatures';


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
    navigation.navigate('MockInterview');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Module 2 Integration Banner */}
        <View style={styles.integrationBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
            <Image
              source={Caricatures.whiteboardPresenter || Caricatures.puzzleSkills}
              style={{ width: 68, height: 68, resizeMode: 'contain', marginRight: 14 }}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.integrationHeader}>
                <Text style={styles.integrationTag}>MODULE 2: TOPICS READY</Text>
                <Text style={styles.topicsCountBadge}>{interview_topics.length} Topics</Text>
              </View>
              <Text style={styles.integrationTitle}>Targeted Interview Topics</Text>
            </View>
          </View>
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

        {/* Chat with AI Coach CTA */}
        <TouchableOpacity
          style={styles.chatCoachBtn}
          onPress={() => navigation.navigate('Chatbot')}
        >
          <Text style={styles.chatCoachBtnText}>💬 Chat with AI Coach</Text>
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
  integrationBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  integrationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  integrationTag: {
    fontSize: 10.5,
    color: '#4F46E5',
    fontWeight: '800',
    letterSpacing: 1,
  },
  topicsCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderColor: '#A7F3D0',
    borderWidth: 1,
  },
  integrationTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  integrationDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterPillActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  topicCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  topicTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topicRankBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  topicRankNum: {
    fontSize: 11,
    color: '#111827',
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
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  highText: {
    color: '#B91C1C',
  },
  mediumBadge: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
  },
  mediumText: {
    color: '#854D0E',
  },
  lowBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  lowText: {
    color: '#1E40AF',
  },
  topicTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  reasonBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reasonLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  reasonText: {
    fontSize: 12.5,
    color: '#374151',
    lineHeight: 17,
  },
  startInterviewBtn: {
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
  startInterviewBtnText: {
    color: '#FFC82C',
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
  chatCoachBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },
  chatCoachBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
