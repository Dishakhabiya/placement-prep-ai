import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import { apiClient } from '../api/client';
import SectionCard from '../components/SectionCard';

export default function MockInterviewScreen({ navigation }) {
  const { currentProfile } = useProfileStore();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [followupData, setFollowupData] = useState(null);
  const [generatingFollowup, setGeneratingFollowup] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    fetchQuestionSet();
  }, []);

  const fetchQuestionSet = async () => {
    if (!currentProfile || !currentProfile.profile_id) {
      setErrorMsg('No active profile loaded.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiClient.generateQuestions(currentProfile.profile_id, 5);
      setQuestions(res.questions || []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load interview questions.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFollowup = async () => {
    if (!candidateAnswer.trim()) {
      Alert.alert('Empty Answer', 'Please enter your response before requesting an adaptive follow-up.');
      return;
    }

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    try {
      setGeneratingFollowup(true);
      setFollowupData(null);
      
      const res = await apiClient.generateFollowup({
        questionId: currentQ.question_id,
        originalQuestion: currentQ.question_text,
        targetTopic: currentQ.target_topic,
        candidateAnswer: candidateAnswer,
        missingConcepts: currentQ.expected_key_concepts || [],
      });
      
      setFollowupData(res);
    } catch (err) {
      Alert.alert('Followup Error', err.message || 'Could not generate follow-up question.');
    } finally {
      setGeneratingFollowup(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCandidateAnswer('');
      setFollowupData(null);
    } else {
      Alert.alert(
        'Mock Interview Complete!',
        'You have reviewed all generated questions. Ready to hand off to Member 3 (Speech Transcription) & Member 4 (Answer Evaluation).',
        [
          { text: 'Return to Topics', onPress: () => navigation.navigate('Topics') },
          { text: 'Return Home', onPress: () => navigation.navigate('Home') }
        ]
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Generating personalized interview questions using Module 2 Engine...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg || questions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{errorMsg || 'No questions generated.'}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={fetchQuestionSet}>
            <Text style={styles.primaryBtnText}>Retry Loading Questions</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Progress */}
        <View style={styles.headerRow}>
          <View style={styles.badgeContainer}>
            <Text style={styles.categoryBadge}>{currentQ.category.toUpperCase()}</Text>
            <Text style={styles.difficultyBadge}>{currentQ.difficulty.toUpperCase()}</Text>
          </View>
          <Text style={styles.progressCounter}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
        </View>

        {/* Question Card */}
        <SectionCard title={currentQ.target_topic || "Interview Question"}>
          <Text style={styles.questionText}>{currentQ.question_text}</Text>

          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Context Justification:</Text>
            <Text style={styles.reasonText}>{currentQ.context_reason}</Text>
          </View>

          {/* Expected Key Concepts */}
          <Text style={styles.conceptsHeader}>EXPECTED EVALUATION CONCEPTS:</Text>
          <View style={styles.conceptsRow}>
            {(currentQ.expected_key_concepts || []).map((concept, idx) => (
              <View key={idx} style={styles.conceptChip}>
                <Text style={styles.conceptChipText}>{concept}</Text>
              </View>
            ))}
          </View>
        </SectionCard>

        {/* Answer & Practice Box */}
        <SectionCard title="Practice Response / Transcript Input">
          <Text style={styles.inputGuide}>
            Type candidate response below to test Member 2's Adaptive Follow-up generator:
          </Text>
          <TextInput
            style={styles.answerInput}
            multiline
            numberOfLines={4}
            placeholder="Type candidate spoken response here..."
            placeholderTextColor="#64748B"
            value={candidateAnswer}
            onChangeText={setCandidateAnswer}
          />

          <TouchableOpacity
            style={[styles.followupBtn, generatingFollowup && styles.btnDisabled]}
            onPress={handleGenerateFollowup}
            disabled={generatingFollowup}
          >
            {generatingFollowup ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.followupBtnText}>⚡ Generate Adaptive Follow-up Question</Text>
            )}
          </TouchableOpacity>

          {/* Followup Display */}
          {followupData && (
            <View style={styles.followupCard}>
              <View style={styles.followupHeader}>
                <Text style={styles.followupTag}>ADAPTIVE FOLLOW-UP</Text>
                <Text style={styles.focusTag}>Focus: {followupData.focus_area}</Text>
              </View>
              <Text style={styles.followupQuestionText}>{followupData.followup_question}</Text>
            </View>
          )}
        </SectionCard>

        {/* Navigation Controls */}
        <View style={styles.navRow}>
          {currentIndex > 0 && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                setCurrentIndex(currentIndex - 1);
                setCandidateAnswer('');
                setFollowupData(null);
              }}
            >
              <Text style={styles.secondaryBtnText}>← Previous</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.primaryNavBtn} onPress={handleNextQuestion}>
            <Text style={styles.primaryNavBtnText}>
              {currentIndex < questions.length - 1 ? 'Next Question →' : 'Finish Mock Session 🎉'}
            </Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  difficultyBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  progressCounter: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 22,
    marginBottom: 12,
  },
  reasonBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
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
  },
  conceptsHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  conceptsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  conceptChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  conceptChipText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '600',
  },
  inputGuide: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  answerInput: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 12,
  },
  followupBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  followupBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  followupCard: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  followupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  followupTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1,
  },
  focusTag: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  followupQuestionText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryBtnText: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  primaryNavBtn: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryNavBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
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
