import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { apiClient } from '../api/client';
import SectionCard from '../components/SectionCard';
import Caricatures from '../assets/caricatures';


export default function PerformanceReportScreen({ route, navigation }) {
  // Normalize: sessionAnswers may be an array or an object map
  const rawParams = route?.params || {};
  const rawSessionAnswers = rawParams.sessionAnswers || rawParams.session_answers || [];
  const sessionAnswersArray = Array.isArray(rawSessionAnswers)
    ? rawSessionAnswers
    : Object.values(rawSessionAnswers);
  const questions = rawParams.questions || [];
  const profile = rawParams.profile || null;
  const sessionId = rawParams.sessionId || rawParams.session_id || null;
  const visualIssues = rawParams.visualIssues || [];

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);

  useEffect(() => {
    buildReport();
  }, []);

  const buildReport = async () => {
    try {
      setLoading(true);
      setError(null);

      // All genuinely answered questions (status = 'saved', genuine spoken transcript)
      const answeredAnswers = sessionAnswersArray.filter((a) => {
        if (!a) return false;
        if (a.status === 'skipped') return false;
        const transcript = (a.transcript || '').trim();
        if (!transcript || transcript.toLowerCase() === 'no speech detected' || transcript.toLowerCase() === 'terminated early without speech') {
          return false;
        }
        return a.status === 'saved' || a.evaluated;
      });

      // Extract evaluations — include answers where evaluation ran OR create a stub from transcript
      const evaluationsList = answeredAnswers.map((a) => {
        if (!a) return null;
        const q = a.question || questions.find((q) => q.question_id === a.question_id);
        if (a.evaluation) {
          return {
            ...a.evaluation,
            question_id: a.question_id || a.evaluation?.question_id,
            target_topic: q?.target_topic || a.evaluation?.target_topic,
            question_text: q?.question_text || a.question_text || a.evaluation?.question_text,
            followup: a.followup || a.evaluation?.followup || null,
          };
        }
        // Stub evaluation from local transcript data so answered count is correct
        return {
          question_id: a.question_id,
          question_text: a.question_text || q?.question_text || '',
          target_topic: q?.target_topic || '',
          relevance: { relevance_score: null },
          concept_coverage: {
            coverage_score: null,
            covered_concepts: [],
            missing_concepts: q?.expected_key_concepts || [],
          },
          transcript_metadata: {
            transcript: a.transcript || '',
            word_count: a.transcript ? a.transcript.split(' ').filter(Boolean).length : 0,
            duration_seconds: a.duration || 0,
          },
          delivery_metrics: null,
          status: a.evaluated ? 'evaluated' : 'saved_no_eval',
          error: a.error || null,
        };
      }).filter(Boolean);

      const candidateName = profile?.candidate?.name || 'Candidate';
      const targetRole = profile?.job?.title || 'Software Engineer';
      const totalQ = questions?.length || Math.max(answeredAnswers.length, 1);

      // Call backend aggregation endpoint
      try {
        const remoteReport = await apiClient.generateSessionReport({
          evaluations: evaluationsList,
          totalQuestions: totalQ,
          answeredQuestions: answeredAnswers.length,
          questions: questions,
          profileId: profile?.profile_id,
          sessionId: sessionId || profile?.session_id,
          candidateName,
          targetRole,
          visualIssues,
        });
        setReport(remoteReport);
      } catch (apiErr) {
        console.warn('Backend report endpoint failed, falling back to local calculation:', apiErr);
        // Fallback local calculation
        const localReport = computeLocalReport(evaluationsList, totalQ, answeredAnswers.length, questions, candidateName, targetRole, sessionId);
        setReport(localReport);
      }
    } catch (err) {
      setError(err.message || 'Failed to assemble performance report.');
    } finally {
      setLoading(false);
    }
  };

  const computeLocalReport = (evaluations, totalQ, answeredCount, questionList, name, role, sessId) => {
    const completionRate = totalQ > 0 ? Math.round((answeredCount / totalQ) * 1000) / 10 : 0;


    const relScores = evaluations.map((e) => e.relevance?.relevance_score).filter((s) => typeof s === 'number');
    const covScores = evaluations.map((e) => e.concept_coverage?.coverage_score).filter((s) => typeof s === 'number');

    const avgRel = relScores.length > 0 ? Math.round((relScores.reduce((a, b) => a + b, 0) / relScores.length) * 10) / 10 : 0;
    const avgCov = covScores.length > 0 ? Math.round((covScores.reduce((a, b) => a + b, 0) / covScores.length) * 10) / 10 : 0;

    let totalCovered = 0;
    let totalMissing = 0;
    let totalWords = 0;
    let totalDur = 0;
    let totalFillers = 0;
    let totalPauses = 0;
    const fillerMap = {};
    const facePresence = [];
    const faceCentering = [];

    evaluations.forEach((e) => {
      totalCovered += e.concept_coverage?.covered_concepts?.length || 0;
      totalMissing += e.concept_coverage?.missing_concepts?.length || 0;
      totalWords += e.transcript_metadata?.word_count || 0;
      totalDur += e.transcript_metadata?.duration_seconds || 0;
      if (e.delivery_metrics) {
        totalFillers += e.delivery_metrics.total_filler_words || 0;
        totalPauses += e.delivery_metrics.extended_pause_count || 0;
        const b = e.delivery_metrics.filler_word_breakdown || {};
        Object.entries(b).forEach(([k, v]) => {
          fillerMap[k] = (fillerMap[k] || 0) + v;
        });
      }
      if (e.visual_metrics?.video_track_detected) {
        if (typeof e.visual_metrics.face_presence_ratio === 'number') {
          facePresence.push(e.visual_metrics.face_presence_ratio);
        }
        if (typeof e.visual_metrics.face_centering_ratio === 'number') {
          faceCentering.push(e.visual_metrics.face_centering_ratio);
        }
      }
    });

    const avgWpm = totalDur > 0 && totalWords > 0 ? Math.round(((totalWords / totalDur) * 60) * 10) / 10 : 0;
    const overallFillerPct = totalWords > 0 ? Math.round(((totalFillers / totalWords) * 100) * 10) / 10 : 0;
    const avgPresence = facePresence.length > 0 ? Math.round((facePresence.reduce((a, b) => a + b, 0) / facePresence.length) * 10) / 10 : null;
    const avgCenter = faceCentering.length > 0 ? Math.round((faceCentering.reduce((a, b) => a + b, 0) / faceCentering.length) * 10) / 10 : null;

    let readiness = 0;
    if (answeredCount > 0) {
      readiness = Math.round((avgRel * 0.4 + avgCov * 0.4 + (avgWpm > 110 && avgWpm < 165 ? 90 : 70) * 0.2) * 10) / 10;
    }

    const readinessTier = answeredCount === 0 ? 'Needs Practice' : (readiness >= 75 && completionRate >= 70 ? 'Placement Ready' : readiness >= 55 ? 'Strong Potential' : 'Needs Practice');

    const strengths = [];
    if (answeredCount > 0) {
      if (avgRel >= 70) strengths.push(`High answer relevance (${avgRel}%), directly answering interview questions.`);
      if (avgCov >= 70) strengths.push(`Strong concept coverage (${avgCov}%), demonstrating good domain knowledge.`);
      if (avgWpm >= 110 && avgWpm <= 165) strengths.push(`Optimal speaking pace (${avgWpm} WPM).`);
      if (overallFillerPct <= 3.0 && totalWords > 0) strengths.push(`Low filler word frequency (${overallFillerPct}%).`);
      if (avgPresence && avgPresence >= 80) strengths.push(`Consistent camera framing presence (${avgPresence}%).`);
      if (strengths.length === 0) strengths.push('Successfully submitted spoken interview responses.');
    }

    const improvements = [];
    if (answeredCount === 0) {
      improvements.push('No spoken responses were recorded. Record your voice during questions to receive readiness and delivery metrics.');
    } else {
      if (avgCov < 65) improvements.push(`Concept coverage averaged ${avgCov}%. Include more expected key concepts.`);
      if (avgRel < 65) improvements.push(`Answer relevance averaged ${avgRel}%. Focus closer on the interviewer's prompt.`);
      if (overallFillerPct > 4) improvements.push(`Filler word density reached ${overallFillerPct}%.`);
      if (totalPauses >= 3) improvements.push(`Detected ${totalPauses} extended pauses (>1.5s).`);
      if (answeredCount < totalQ) improvements.push(`Completed ${answeredCount} of ${totalQ} questions.`);
    }

    const recommendations = answeredCount === 0
      ? [
          'Enable microphone permissions and speak clearly into the mic when recording starts.',
          'State key technical definitions and concepts directly aligned with the question.',
          'Practice answering all assigned questions to simulate a real placement interview.',
        ]
      : [
          'Review missing concepts identified across questions to deepen technical breadth.',
          'Practice pausing silently instead of using verbal filler words.',
          'Maintain an upright seated posture centered in front of the camera.',
        ];

    const breakdown = (questionList || []).map((q) => {
      const ans = (sessionAnswersArray || []).find((a) => (a.question?.question_id === q.question_id) || (a.question_id === q.question_id));
      const ev = ans?.evaluation || evaluations.find((e) => e.question_id === q.question_id);
      const transcriptText = ev?.transcript_metadata?.transcript || ans?.transcript || '';
      const hasRealTranscript = !!transcriptText && transcriptText.trim().length > 0 && transcriptText.toLowerCase() !== 'no speech detected' && transcriptText.toLowerCase() !== 'terminated early without speech';
      const isAnswered = ans?.status !== 'skipped' && hasRealTranscript && (ans?.status === 'saved' || (ev && ev.status !== 'unanswered' && ev.status !== 'skipped'));

      if (isAnswered) {
        const hasEvaluation = typeof ev?.relevance?.relevance_score === 'number';
        return {
          question_id: q.question_id,
          question_text: q.question_text,
          target_topic: q.target_topic,
          category: q.category,
          difficulty: q.difficulty,
          status: 'answered',
          transcript: transcriptText,
          has_transcript: true,
          has_evaluation: hasEvaluation,
          transcript_status: 'available',
          evaluation_status: hasEvaluation ? 'available' : (ans?.isEvaluating ? 'pending' : 'missing'),
          relevance_score: ev?.relevance?.relevance_score ?? null,
          coverage_score: ev?.concept_coverage?.coverage_score ?? null,
          covered_concepts: ev?.concept_coverage?.covered_concepts || [],
          missing_concepts: ev?.concept_coverage?.missing_concepts || q.expected_key_concepts || [],
          words_per_minute: ev?.delivery_metrics?.words_per_minute ?? null,
          filler_word_count: ev?.delivery_metrics?.total_filler_words ?? null,
          extended_pause_count: ev?.delivery_metrics?.extended_pause_count ?? null,
          face_presence_ratio: ev?.visual_metrics?.face_presence_ratio ?? null,
          face_centering_ratio: ev?.visual_metrics?.face_centering_ratio ?? null,
          followup_question: ev?.followup?.followup_question || ans?.followup?.followup_question || null,
          followup_focus: ev?.followup?.focus_area || ans?.followup?.focus_area || null,
        };
      }
      return {
        question_id: q.question_id,
        question_text: q.question_text,
        target_topic: q.target_topic,
        category: q.category,
        difficulty: q.difficulty,
        status: 'unanswered',
        has_transcript: false,
        has_evaluation: false,
        transcript_status: 'skipped',
        evaluation_status: 'skipped',
        transcript: null,
        relevance_score: null,
        coverage_score: null,
        covered_concepts: [],
        missing_concepts: q.expected_key_concepts || [],
      };
    });

    return {
      session_id: sessId,
      candidate_name: name,
      target_role: role,
      total_questions: totalQ,
      answered_questions: answeredCount,
      completion_rate: completionRate,
      overall_readiness_score: readiness,
      readiness_level: readinessTier,
      average_relevance_score: avgRel,
      average_concept_coverage: avgCov,
      total_concepts_covered: totalCovered,
      total_concepts_missing: totalMissing,
      average_words_per_minute: avgWpm,
      overall_pace_rating: avgWpm >= 110 && avgWpm <= 165 ? 'Optimal' : avgWpm > 165 ? 'Fast' : 'Slow',
      total_filler_words: totalFillers,
      overall_filler_percentage: overallFillerPct,
      top_filler_words: fillerMap,
      total_extended_pauses: totalPauses,
      total_speaking_duration_seconds: Math.round(totalDur * 10) / 10,
      video_sessions_count: facePresence.length,
      average_face_presence_ratio: avgPresence,
      average_face_centering_ratio: avgCenter,
      visual_stability_summary: facePresence.length > 0 ? 'Video Framing Captured' : 'Audio-Only Mode',
      key_strengths: strengths,
      areas_for_improvement: improvements,
      actionable_recommendations: recommendations,
      questions_breakdown: breakdown,
      generated_at: new Date().toISOString(),
    };
  };

  const toggleExpand = (qid) => {
    setExpandedQuestionId(expandedQuestionId === qid ? null : qid);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingTitle}>Compiling Interview Session Analysis...</Text>
          <Text style={styles.loadingSub}>
            Aggregating answer relevance, NLP concepts, delivery pace, and video framing metrics.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !report) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Could Not Load Session Report</Text>
          <Text style={styles.errorSub}>{error || 'Session report data is unavailable.'}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>← Return to Interview</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Handle Empty State (0 answers submitted)
  if (report.answered_questions === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.headerHero}>
            <Text style={styles.heroPreTag}>INTERVIEW REPORT • MODULE 4 AGGREGATION</Text>
            <Text style={styles.heroTitle}>Session Complete</Text>
            <Text style={styles.heroSubtitle}>
              Candidate: {report.candidate_name} • Role: {report.target_role}
            </Text>
          </View>

          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🎙️</Text>
            <Text style={styles.emptyTitle}>No Interview Answers Recorded</Text>
            <Text style={styles.emptyDesc}>
              You concluded the interview session without recording answers to the questions.
              To generate an aggregated performance score, record and submit at least one spoken response.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryBtnText}>🎥 Return to Mock Interview</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Home')}>
              <Text style={styles.secondaryBtnText}>Return Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Hero Banner */}
        <View style={styles.headerHero}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <View style={styles.heroTagRow}>
                <Text style={styles.heroPreTag}>SESSION PERFORMANCE REPORT</Text>
                <Text style={styles.sessionIdTag}>
                  {report.session_id ? `ID: ${report.session_id.substring(0, 14)}` : 'MOCK SESSION'}
                </Text>
              </View>
              <Text style={styles.heroTitle}>Comprehensive Evaluation</Text>
              <Text style={styles.heroSubtitle}>
                Candidate: <Text style={styles.boldText}>{report.candidate_name}</Text> • Target: <Text style={styles.boldText}>{report.target_role}</Text>
              </Text>
            </View>
            <Image
              source={Caricatures.trophySuccess || Caricatures.girlReviewReport}
              style={{ width: 80, height: 80, resizeMode: 'contain' }}
            />
          </View>
        </View>

        {/* Overall Readiness Score Card */}
        <SectionCard title="Overall Interview Readiness">
          <View style={styles.readinessContainer}>
            <View style={styles.readinessScoreCol}>
              <Text style={styles.readinessNumber}>{report.overall_readiness_score}%</Text>
              <Text style={styles.readinessLabel}>OVERALL READINESS</Text>
            </View>

            <View style={styles.readinessBadgeCol}>
              <View
                style={[
                  styles.tierBadge,
                  report.readiness_level === 'Placement Ready'
                    ? styles.tierReady
                    : report.readiness_level === 'Strong Potential'
                    ? styles.tierPotential
                    : styles.tierPractice,
                ]}
              >
                <Text
                  style={[
                    styles.tierBadgeText,
                    report.readiness_level === 'Placement Ready'
                      ? styles.textReady
                      : report.readiness_level === 'Strong Potential'
                      ? styles.textPotential
                      : styles.textPractice,
                  ]}
                >
                  {report.readiness_level.toUpperCase()}
                </Text>
              </View>

              <Text style={styles.completionStat}>
                ✓ {report.answered_questions} of {report.total_questions} questions answered ({report.completion_rate}%)
              </Text>
              <Text style={styles.durationStat}>
                Speaking duration: {report.total_speaking_duration_seconds}s total
              </Text>
            </View>
          </View>
        </SectionCard>

        {/* Executive Metrics Grid */}
        <SectionCard title="Performance Analytics Matrix">
          <View style={styles.matrixGrid}>
            {/* Metric 1: Relevance */}
            <View style={styles.matrixBox}>
              <Text style={styles.matrixBoxLabel}>Answer Relevance</Text>
              <Text style={styles.matrixBoxValue}>{report.average_relevance_score}%</Text>
              <Text style={styles.matrixBoxSub}>Average across answers</Text>
            </View>

            {/* Metric 2: Concepts */}
            <View style={styles.matrixBox}>
              <Text style={styles.matrixBoxLabel}>Concept Coverage</Text>
              <Text style={[styles.matrixBoxValue, { color: '#38BDF8' }]}>
                {report.average_concept_coverage}%
              </Text>
              <Text style={styles.matrixBoxSub}>
                {report.total_concepts_covered} covered • {report.total_concepts_missing} missed
              </Text>
            </View>

            {/* Metric 3: Pace */}
            <View style={styles.matrixBox}>
              <Text style={styles.matrixBoxLabel}>Speaking Rate</Text>
              <Text style={[styles.matrixBoxValue, { color: '#F59E0B' }]}>
                {report.average_words_per_minute} WPM
              </Text>
              <Text style={styles.matrixBoxSub}>{report.overall_pace_rating} pace</Text>
            </View>

            {/* Metric 4: Fillers */}
            <View style={styles.matrixBox}>
              <Text style={styles.matrixBoxLabel}>Filler Word Rate</Text>
              <Text
                style={[
                  styles.matrixBoxValue,
                  { color: report.overall_filler_percentage <= 3.0 ? '#10B981' : '#F59E0B' },
                ]}
              >
                {report.overall_filler_percentage}%
              </Text>
              <Text style={styles.matrixBoxSub}>
                {report.total_filler_words} filler words total
              </Text>
            </View>

            {/* Metric 5: Pauses */}
            <View style={styles.matrixBox}>
              <Text style={styles.matrixBoxLabel}>Extended Pauses</Text>
              <Text style={styles.matrixBoxValue}>{report.total_extended_pauses}</Text>
              <Text style={styles.matrixBoxSub}>Pauses &gt; 1.5s</Text>
            </View>

            {/* Metric 6: Video Framing */}
            <View style={styles.matrixBox}>
              <Text style={styles.matrixBoxLabel}>Camera Centering</Text>
              <Text style={[styles.matrixBoxValue, { color: '#8B5CF6' }]}>
                {report.average_face_presence_ratio !== null
                  ? `${report.average_face_presence_ratio}%`
                  : 'N/A'}
              </Text>
              <Text style={styles.matrixBoxSub}>
                {report.average_face_centering_ratio !== null
                  ? `${report.average_face_centering_ratio}% centered`
                  : 'Audio recording mode'}
              </Text>
            </View>
          </View>
        </SectionCard>

        {/* Key Strengths */}
        {report.key_strengths && report.key_strengths.length > 0 && (
          <SectionCard title="Demonstrated Strengths">
            <View style={styles.strengthsList}>
              {report.key_strengths.map((s, idx) => (
                <View key={idx} style={styles.strengthItem}>
                  <Text style={styles.strengthIcon}>✅</Text>
                  <Text style={styles.strengthText}>{s}</Text>
                </View>
              ))}
            </View>
          </SectionCard>
        )}

        {/* Areas for Improvement */}
        {report.areas_for_improvement && report.areas_for_improvement.length > 0 && (
          <SectionCard title="Targeted Areas for Improvement">
            <View style={styles.improvementsList}>
              {report.areas_for_improvement.map((item, idx) => (
                <View key={idx} style={styles.improvementItem}>
                  <Text style={styles.improvementIcon}>⚠️</Text>
                  <Text style={styles.improvementText}>{item}</Text>
                </View>
              ))}
            </View>
          </SectionCard>
        )}

        {/* Actionable Coaching Recommendations */}
        {report.actionable_recommendations && report.actionable_recommendations.length > 0 && (
          <SectionCard title="Personalized Action Plan">
            <View style={styles.recommendationsList}>
              {report.actionable_recommendations.map((rec, idx) => (
                <View key={idx} style={styles.recommendationItem}>
                  <Text style={styles.recNumber}>{idx + 1}</Text>
                  <Text style={styles.recText}>{rec}</Text>
                </View>
              ))}
            </View>
          </SectionCard>
        )}

        {/* Per-Question Detailed Breakdown */}
        <SectionCard title="Question-by-Question Detailed Breakdown">
          <Text style={styles.breakdownIntro}>
            Review how you performed on each question assigned in this session:
          </Text>

          {report.questions_breakdown && report.questions_breakdown.map((q, idx) => {
            const isExpanded = expandedQuestionId === q.question_id || expandedQuestionId === idx;
            const isAnswered = q.status === 'answered';

            return (
              <View
                key={q.question_id || idx}
                style={[
                  styles.questionCard,
                  isAnswered ? styles.questionCardAnswered : styles.questionCardUnanswered,
                ]}
              >
                <TouchableOpacity
                  style={styles.questionCardHeader}
                  onPress={() => toggleExpand(q.question_id || idx)}
                >
                  <View style={styles.questionCardTitleRow}>
                    <Text style={styles.questionNumBadge}>Q{idx + 1}</Text>
                    <View style={styles.questionHeaderContent}>
                      {q.target_topic ? (
                        <Text style={styles.questionTopicText}>{q.target_topic}</Text>
                      ) : null}
                      <Text style={styles.questionShortText} numberOfLines={isExpanded ? 0 : 2}>
                        {q.question_text}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statusCol}>
                    <View
                      style={[
                        styles.statusPill,
                        isAnswered ? styles.pillAnswered : styles.pillUnanswered,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isAnswered ? styles.pillTextAnswered : styles.pillTextUnanswered,
                        ]}
                      >
                        {isAnswered ? '✓ ANSWERED' : 'SKIPPED'}
                      </Text>
                    </View>
                    <Text style={styles.expandChevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {/* Expanded Details */}
                {isExpanded && isAnswered && (
                  <View style={styles.questionDetails}>
                    {/* Transcript Display (Clearly Identifying Missing Transcripts) */}
                    {q.transcript ? (
                      <View style={styles.detailBox}>
                        <Text style={styles.detailLabel}>Candidate Spoken Transcript:</Text>
                        <Text style={styles.detailTranscript}>"{q.transcript}"</Text>
                      </View>
                    ) : (
                      <View style={styles.missingDetailBox}>
                        <Text style={styles.missingDetailLabel}>⚠️ Transcript Missing or Incomplete</Text>
                        <Text style={styles.missingDetailText}>
                          {q.transcript_status === 'pending'
                            ? 'Speech transcription is processing in background...'
                            : 'No speech was recognized or transcription failed for this answer.'}
                        </Text>
                      </View>
                    )}

                    {/* Scores Row (Clearly Identifying Missing Evaluations) */}
                    {q.relevance_score !== null && q.relevance_score !== undefined ? (
                      <View style={styles.scoresRow}>
                        <View style={styles.scorePill}>
                          <Text style={styles.scorePillLabel}>Relevance:</Text>
                          <Text style={styles.scorePillVal}>{q.relevance_score}%</Text>
                        </View>
                        <View style={styles.scorePill}>
                          <Text style={styles.scorePillLabel}>Coverage:</Text>
                          <Text style={styles.scorePillVal}>{q.coverage_score ?? 'N/A'}%</Text>
                        </View>
                        {q.words_per_minute !== null && q.words_per_minute !== undefined && (
                          <View style={styles.scorePill}>
                            <Text style={styles.scorePillLabel}>Pace:</Text>
                            <Text style={styles.scorePillVal}>{q.words_per_minute} WPM</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.missingDetailBox}>
                        <Text style={styles.missingDetailLabel}>⚠️ Evaluation Incomplete or Missing</Text>
                        <Text style={styles.missingDetailText}>
                          {q.evaluation_status === 'pending'
                            ? 'Answer evaluation is currently processing in background...'
                            : 'Quantitative relevance and coverage scores were not returned for this answer.'}
                        </Text>
                      </View>
                    )}

                    {/* Concepts Breakdown */}
                    {q.covered_concepts?.length > 0 && (
                      <View style={styles.conceptBreakdownRow}>
                        <Text style={styles.conceptLabelCovered}>Covered Concepts:</Text>
                        <View style={styles.chipsRow}>
                          {q.covered_concepts.map((c, i) => (
                            <View key={i} style={styles.chipCovered}>
                              <Text style={styles.chipCoveredText}>✓ {c}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {q.missing_concepts?.length > 0 && (
                      <View style={styles.conceptBreakdownRow}>
                        <Text style={styles.conceptLabelMissing}>Missing Concepts:</Text>
                        <View style={styles.chipsRow}>
                          {q.missing_concepts.map((c, i) => (
                            <View key={i} style={styles.chipMissing}>
                              <Text style={styles.chipMissingText}>✗ {c}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Adaptive Follow-up Note */}
                    {q.followup_question && (
                      <View style={styles.followupNoteBox}>
                        <Text style={styles.followupNoteLabel}>Adaptive Follow-up Triggered:</Text>
                        <Text style={styles.followupNoteText}>{q.followup_question}</Text>
                        {q.followup_focus && (
                          <Text style={styles.followupFocusText}>Focus: {q.followup_focus}</Text>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {isExpanded && !isAnswered && (
                  <View style={styles.questionDetails}>
                    <Text style={styles.unansweredNote}>
                      This question was not recorded or evaluated during the session. Expected concepts include:{' '}
                      {(q.missing_concepts || []).join(', ') || 'N/A'}.
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </SectionCard>

        {/* Footer Navigation Buttons */}
        <View style={styles.footerNavRow}>
          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={() => navigation.navigate('Topics')}
          >
            <Text style={styles.actionBtnSecondaryText}>🎯 Change Interview Topics</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnPrimary}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.actionBtnPrimaryText}>🏠 Return Home</Text>
          </TouchableOpacity>
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
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8F9FA',
  },
  loadingTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSub: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 400,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  errorSub: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 400,
  },

  // Hero Banner
  headerHero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroPreTag: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sessionIdTag: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heroTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#4B5563',
    fontSize: 13,
  },
  boldText: {
    color: '#111827',
    fontWeight: '700',
  },

  // Readiness Container
  readinessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 6,
  },
  readinessScoreCol: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    minWidth: 110,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  readinessNumber: {
    color: '#10B981',
    fontSize: 32,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  readinessLabel: {
    color: '#6B7280',
    fontSize: 9.5,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  readinessBadgeCol: {
    flex: 1,
    justifyContent: 'center',
  },
  tierBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  tierReady: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  tierPotential: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  tierPractice: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  textReady: {
    color: '#065F46',
  },
  textPotential: {
    color: '#4F46E5',
  },
  textPractice: {
    color: '#854D0E',
  },
  completionStat: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  durationStat: {
    color: '#6B7280',
    fontSize: 11,
  },

  // Matrix Grid
  matrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  matrixBox: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  matrixBoxLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  matrixBoxValue: {
    color: '#10B981',
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  matrixBoxSub: {
    color: '#9CA3AF',
    fontSize: 10.5,
    marginTop: 2,
  },

  // Strengths
  strengthsList: {
    gap: 8,
  },
  strengthItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  strengthIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  strengthText: {
    color: '#065F46',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  // Improvements
  improvementsList: {
    gap: 8,
  },
  improvementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF9C3',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  improvementIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  improvementText: {
    color: '#854D0E',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  // Recommendations
  recommendationsList: {
    gap: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  recNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4F46E5',
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 1,
  },
  recText: {
    color: '#1E40AF',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  // Breakdown Section
  breakdownIntro: {
    color: '#6B7280',
    fontSize: 12.5,
    marginBottom: 12,
  },
  questionCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  questionCardAnswered: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  questionCardUnanswered: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    opacity: 0.8,
  },
  questionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  questionCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  questionNumBadge: {
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginTop: 2,
  },
  questionHeaderContent: {
    flex: 1,
  },
  questionTopicText: {
    color: '#4F46E5',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  questionShortText: {
    color: '#111827',
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 19,
  },
  statusCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillAnswered: {
    backgroundColor: '#ECFDF5',
  },
  pillUnanswered: {
    backgroundColor: '#F3F4F6',
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  pillTextAnswered: {
    color: '#065F46',
  },
  pillTextUnanswered: {
    color: '#6B7280',
  },
  expandChevron: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 4,
  },
  questionDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 14,
    backgroundColor: '#F9FAFB',
  },
  missingDetailBox: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  missingDetailLabel: {
    color: '#854D0E',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  missingDetailText: {
    color: '#854D0E',
    fontSize: 11.5,
    lineHeight: 16,
  },
  detailBox: {
    marginBottom: 10,
  },
  detailLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  detailTranscript: {
    color: '#374151',
    fontSize: 12.5,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  scorePill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    gap: 4,
  },
  scorePillLabel: {
    color: '#6B7280',
    fontSize: 11,
  },
  scorePillVal: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  conceptBreakdownRow: {
    marginBottom: 8,
  },
  conceptLabelCovered: {
    color: '#065F46',
    fontSize: 10.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  conceptLabelMissing: {
    color: '#B91C1C',
    fontSize: 10.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipCovered: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipCoveredText: {
    color: '#065F46',
    fontSize: 10.5,
    fontWeight: '600',
  },
  chipMissing: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipMissingText: {
    color: '#B91C1C',
    fontSize: 10.5,
    fontWeight: '600',
  },
  followupNoteBox: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
    padding: 10,
    marginTop: 6,
    borderRadius: 6,
  },
  followupNoteLabel: {
    color: '#1E40AF',
    fontSize: 10.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  followupNoteText: {
    color: '#111827',
    fontSize: 12,
  },
  followupFocusText: {
    color: '#4B5563',
    fontSize: 10.5,
    marginTop: 2,
  },
  unansweredNote: {
    color: '#9CA3AF',
    fontSize: 12,
    fontStyle: 'italic',
  },

  // Empty State
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 440,
  },

  // Footer Buttons
  footerNavRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionBtnSecondaryText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnPrimaryText: {
    color: '#FFC82C',
    fontWeight: '800',
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryBtnText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13,
  },
  footerRow: {
    alignItems: 'center',
    marginTop: 8,
  },
});
