import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
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
  const [errorMsg, setErrorMsg] = useState(null);

  // Browser Video & Audio Recording Lifecycle:
  // 'idle' | 'requesting' | 'recording' | 'recorded' | 'evaluating' | 'evaluated' | 'error'
  const [recordingState, setRecordingState] = useState('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [candidateTranscript, setCandidateTranscript] = useState('');
  const [evaluationData, setEvaluationData] = useState(null);
  const [followupData, setFollowupData] = useState(null);
  const [generatingFollowup, setGeneratingFollowup] = useState(false);
  const [recordingError, setRecordingError] = useState(null);
  // Session answer aggregation map: question_id -> { question, evaluation, transcript, followup, duration }
  const [sessionAnswers, setSessionAnswers] = useState({});

  // Browser MediaRecorder, stream, video element and timer references
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const videoElementRef = useRef(null);

  useEffect(() => {
    fetchQuestionSet();
    return () => {
      cleanupMediaResources();
    };
  }, []);

  const cleanupMediaResources = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // Safe silent cleanup
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {
        // Safe silent cleanup
      }
      mediaStreamRef.current = null;
    }

    if (videoElementRef.current) {
      try {
        videoElementRef.current.srcObject = null;
      } catch (e) {
        // Safe silent cleanup
      }
    }
    setHasVideoTrack(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchQuestionSet = async () => {
    if (!currentProfile || !currentProfile.profile_id) {
      setErrorMsg('No active candidate profile loaded.');
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

  const attachStreamToVideoElement = (stream) => {
    if (typeof window !== 'undefined' && videoElementRef.current && stream) {
      try {
        videoElementRef.current.srcObject = stream;
        videoElementRef.current.muted = true;
        videoElementRef.current.play().catch(() => {});
      } catch (err) {
        console.warn('Could not bind video stream to preview element:', err);
      }
    }
  };

  const startRecording = async () => {
    setRecordingError(null);
    setFollowupData(null);
    setEvaluationData(null);
    setCandidateTranscript('');
    setRecordedBlob(null);

    // Verify browser mediaDevices support
    if (
      typeof window === 'undefined' ||
      !navigator?.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setRecordingError(
        'Direct browser camera and microphone recording is not supported in this environment. Please open this application in Google Chrome, Microsoft Edge, or Mozilla Firefox.'
      );
      setRecordingState('error');
      return;
    }

    try {
      setRecordingState('requesting');
      cleanupMediaResources();

      let stream = null;
      let videoAcquired = false;

      // 1. Request combined camera + microphone access
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 24, max: 30 },
            facingMode: 'user',
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        videoAcquired = true;
      } catch (mediaErr) {
        // Fallback: If camera is unavailable or denied, fallback to audio-only recording
        console.warn('Camera request failed, attempting audio-only fallback:', mediaErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          videoAcquired = false;
        } catch (audioErr) {
          throw mediaErr; // Throw original error for permission/device feedback
        }
      }

      mediaStreamRef.current = stream;
      setHasVideoTrack(videoAcquired && stream.getVideoTracks().length > 0);

      // Attach stream to video preview element immediately
      attachStreamToVideoElement(stream);

      // 2. Select supported MIME type for MediaRecorder
      let chosenMime = '';
      const candidateMimes = videoAcquired
        ? [
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9,opus',
            'video/webm',
            'video/mp4',
            'audio/webm;codecs=opus',
            'audio/webm',
          ]
        : [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/wav',
          ];

      for (const mime of candidateMimes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          chosenMime = mime;
          break;
        }
      }

      const recorderOptions = chosenMime ? { mimeType: chosenMime } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || chosenMime || (videoAcquired ? 'video/webm' : 'audio/webm');
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        setRecordedBlob(blob);
        setRecordingState('recorded');

        // Stop media hardware tracks immediately to turn off camera and mic lights
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        if (videoElementRef.current) {
          videoElementRef.current.srcObject = null;
        }
      };

      recorder.onerror = (event) => {
        setRecordingError('Recording error: ' + (event.error?.message || 'MediaRecorder failed.'));
        setRecordingState('error');
        cleanupMediaResources();
      };

      // 3. Start recording with 250ms chunk interval
      recorder.start(250);
      setRecordingDuration(0);
      setRecordingState('recording');

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      cleanupMediaResources();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setRecordingError(
          'Camera or microphone permission was denied. Please allow camera and microphone access in your browser address bar permissions and try again.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setRecordingError(
          'No camera or microphone detected on your device. Please ensure your camera and microphone are connected and try again.'
        );
      } else {
        setRecordingError(`Could not access media devices: ${err.message || err.name}`);
      }
      setRecordingState('error');
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Error stopping MediaRecorder:', e);
      }
    }
  };

  const submitAndEvaluate = async () => {
    if (!recordedBlob || recordedBlob.size < 128) {
      Alert.alert(
        'Recording Too Short',
        'Your recording appears to be empty or too short. Please speak your answer and record for at least a few seconds.'
      );
      return;
    }

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    try {
      setRecordingState('evaluating');
      setRecordingError(null);

      const res = await apiClient.transcribeAudioAnswer({
        audioFile: recordedBlob,
        profileId: currentProfile?.profile_id,
        sessionId: currentProfile?.session_id,
        questionId: currentQ.question_id,
        questionText: currentQ.question_text,
        expectedKeyConcepts: currentQ.expected_key_concepts || [],
      });

      setCandidateTranscript(res.transcript_metadata?.transcript || '');
      setEvaluationData(res);
      setRecordingState('evaluated');

      // Record answer into session aggregation map
      setSessionAnswers((prev) => ({
        ...prev,
        [currentQ.question_id]: {
          question: currentQ,
          evaluation: res,
          transcript: res.transcript_metadata?.transcript || '',
          followup: null,
          duration: recordingDuration,
        },
      }));
    } catch (err) {
      setRecordingError(err.message || 'Failed to transcribe or evaluate audio answer.');
      setRecordingState('error');
    }
  };

  const resetToRecord = () => {
    cleanupMediaResources();
    setRecordingState('idle');
    setRecordingDuration(0);
    setRecordedBlob(null);
    setRecordingError(null);
  };

  const handleGenerateFollowup = async () => {
    if (!candidateTranscript.trim()) {
      Alert.alert('No Answer', 'Please record and evaluate your response before requesting a follow-up.');
      return;
    }

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    // Direct integration: prioritize actual missing concepts tagged by Member 3 NLP
    const missing =
      evaluationData?.concept_coverage?.missing_concepts &&
      evaluationData.concept_coverage.missing_concepts.length > 0
        ? evaluationData.concept_coverage.missing_concepts
        : currentQ.expected_key_concepts || [];

    try {
      setGeneratingFollowup(true);
      setFollowupData(null);

      const res = await apiClient.generateFollowup({
        questionId: currentQ.question_id,
        originalQuestion: currentQ.question_text,
        targetTopic: currentQ.target_topic,
        candidateAnswer: candidateTranscript,
        missingConcepts: missing,
      });

      setFollowupData(res);
      setSessionAnswers((prev) => {
        const curr = prev[currentQ.question_id];
        if (!curr) return prev;
        return {
          ...prev,
          [currentQ.question_id]: {
            ...curr,
            followup: res,
          },
        };
      });
    } catch (err) {
      Alert.alert('Followup Error', err.message || 'Could not generate follow-up question.');
    } finally {
      setGeneratingFollowup(false);
    }
  };

  const navigateToQuestion = (targetIndex) => {
    cleanupMediaResources();
    setCurrentIndex(targetIndex);
    const targetQ = questions[targetIndex];
    const existing = targetQ ? sessionAnswers[targetQ.question_id] : null;
    if (existing && existing.evaluation) {
      setCandidateTranscript(existing.transcript || '');
      setEvaluationData(existing.evaluation);
      setFollowupData(existing.followup || null);
      setRecordingDuration(existing.duration || 0);
      setRecordingState('evaluated');
    } else {
      setRecordingState('idle');
      setRecordingDuration(0);
      setRecordedBlob(null);
      setCandidateTranscript('');
      setEvaluationData(null);
      setFollowupData(null);
    }
    setRecordingError(null);
  };

  const finishSessionAndOpenReport = () => {
    cleanupMediaResources();
    navigation.navigate('PerformanceReport', {
      sessionAnswers: Object.values(sessionAnswers),
      questions,
      profile: currentProfile,
      sessionId: currentProfile?.session_id,
    });
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      navigateToQuestion(currentIndex + 1);
    } else {
      finishSessionAndOpenReport();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentIndex > 0) {
      navigateToQuestion(currentIndex - 1);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Generating interview questions from candidate profile...</Text>
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
  const isEvaluated = recordingState === 'evaluated' && !!evaluationData;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Question Progress & Finish Control */}
        <View style={styles.headerRow}>
          <View style={styles.badgeContainer}>
            <Text style={styles.categoryBadge}>{currentQ.category.toUpperCase()}</Text>
            <Text style={styles.difficultyBadge}>{currentQ.difficulty.toUpperCase()}</Text>
          </View>
          <View style={styles.headerRightControls}>
            <Text style={styles.progressCounter}>
              Q{currentIndex + 1} of {questions.length}
            </Text>
            <TouchableOpacity
              style={styles.finishHeaderBtn}
              onPress={finishSessionAndOpenReport}
            >
              <Text style={styles.finishHeaderBtnText}>
                Finish & Report ({Object.keys(sessionAnswers).length}/{questions.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Question Details Card */}
        <SectionCard title={currentQ.target_topic || "Interview Question"}>
          <Text style={styles.questionText}>{currentQ.question_text}</Text>

          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Context Justification:</Text>
            <Text style={styles.reasonText}>{currentQ.context_reason}</Text>
          </View>

          {/* Expected Key Concepts */}
          <Text style={styles.conceptsHeader}>EXPECTED KEY CONCEPTS:</Text>
          <View style={styles.conceptsRow}>
            {(currentQ.expected_key_concepts || []).map((concept, idx) => (
              <View key={idx} style={styles.conceptChip}>
                <Text style={styles.conceptChipText}>{concept}</Text>
              </View>
            ))}
          </View>
        </SectionCard>

        {/* Video & Audio Mock Interview Card */}
        <SectionCard title="Video & Spoken Interview Response">
          {/* Recoverable Error Banner */}
          {recordingError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <View style={styles.errorTextWrap}>
                <Text style={styles.errorTitle}>Camera / Microphone Notice</Text>
                <Text style={styles.errorDetail}>{recordingError}</Text>
              </View>
              <TouchableOpacity style={styles.retryBtn} onPress={resetToRecord}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Live Camera Preview Box */}
          <View
            style={[
              styles.cameraPreviewContainer,
              isEvaluated && styles.cameraPreviewContainerCompact,
            ]}
          >
            <View style={styles.cameraHeaderRow}>
              <View style={styles.cameraTitleRow}>
                <Text style={styles.cameraIcon}>📹</Text>
                <Text style={styles.cameraHeaderTitle}>
                  {isEvaluated ? 'RECORDING SESSION COMPLETED' : 'CANDIDATE WEBCAM PREVIEW'}
                </Text>
              </View>
              {recordingState === 'recording' && (
                <View style={styles.liveCameraBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveCameraBadgeText}>LIVE ON AIR</Text>
                </View>
              )}
              {isEvaluated && (
                <View style={styles.evaluatedCameraBadge}>
                  <Text style={styles.evaluatedCameraBadgeText}>EVALUATED</Text>
                </View>
              )}
              {recordingState !== 'recording' && !isEvaluated && (
                <View style={styles.idleCameraBadge}>
                  <Text style={styles.idleCameraBadgeText}>
                    {hasVideoTrack ? 'CAMERA ACTIVE' : 'AUDIO / VIDEO READY'}
                  </Text>
                </View>
              )}
            </View>

            {/* Video Viewport / Feed */}
            <View
              style={[
                styles.videoViewport,
                isEvaluated && styles.videoViewportCompact,
              ]}
            >
              {typeof window !== 'undefined' ? (
                <video
                  ref={videoElementRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    objectPosition: 'center',
                    transform: 'scaleX(-1)', // Mirrored selfie view
                    backgroundColor: '#020617',
                    display: recordingState === 'recording' && hasVideoTrack ? 'block' : 'none',
                  }}
                />
              ) : null}

              {/* Floating Recording Overlay Badge (on top of live video stream) */}
              {recordingState === 'recording' && (
                <View style={styles.recordingOverlayBadge}>
                  <View style={styles.recordingOverlayDot} />
                  <Text style={styles.recordingOverlayText}>
                    REC {formatTime(recordingDuration)}
                  </Text>
                </View>
              )}

              {/* Overlay / Placeholder when not actively streaming video */}
              {!(recordingState === 'recording' && hasVideoTrack) && (
                isEvaluated ? (
                  <View style={styles.cameraPlaceholderCompact}>
                    <Text style={styles.placeholderIconCompact}>✅</Text>
                    <View style={styles.placeholderTextWrapCompact}>
                      <Text style={styles.placeholderTextCompact}>
                        Video & Spoken Response Evaluated ({formatTime(recordingDuration)})
                      </Text>
                      <Text style={styles.placeholderSubCompact}>
                        Camera released • Performance analysis cards displayed below
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.cameraPlaceholder}>
                    <Text style={styles.placeholderIcon}>
                      {recordingState === 'requesting' ? '⏳' : hasVideoTrack ? '🎥' : '🎙️'}
                    </Text>
                    <Text style={styles.placeholderText}>
                      {recordingState === 'requesting'
                        ? 'Requesting camera & microphone access...'
                        : recordingState === 'recorded'
                        ? 'Response captured with synchronized video & audio'
                        : recordingState === 'evaluating'
                        ? 'Analyzing spoken response with Whisper & NLP...'
                        : 'Camera preview will activate when you click Start Answering'}
                    </Text>
                    <Text style={styles.placeholderSub}>
                      {hasVideoTrack
                        ? 'Webcam connected'
                        : 'Synchronized video & microphone capture enabled'}
                    </Text>
                  </View>
                )
              )}
            </View>
          </View>

          {/* State 1: Ready to Record */}
          {recordingState === 'idle' && (
            <View style={styles.recordActionBox}>
              <Text style={styles.recordPrompt}>
                Position yourself in front of your camera and speak clearly into your microphone:
              </Text>
              <TouchableOpacity style={styles.startRecordBtn} onPress={startRecording}>
                <Text style={styles.startRecordBtnText}>🎥 Start Answering with Video</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* State 2: Requesting Permission */}
          {recordingState === 'requesting' && (
            <View style={styles.centerStatusBox}>
              <ActivityIndicator color="#38BDF8" size="large" />
              <Text style={styles.statusPrompt}>Requesting camera & microphone permissions...</Text>
              <Text style={styles.statusSub}>Please click "Allow" in your browser prompt.</Text>
            </View>
          )}

          {/* State 3: Actively Recording */}
          {recordingState === 'recording' && (
            <View style={styles.activeRecordBox}>
              <View style={styles.liveIndicatorRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveLabel}>
                  {hasVideoTrack ? 'SYNCHRONIZED VIDEO & AUDIO RECORDING' : 'AUDIO RECORDING (CAMERA FALLBACK)'}
                </Text>
              </View>
              <Text style={styles.timerDisplay}>{formatTime(recordingDuration)}</Text>
              <Text style={styles.speakPrompt}>
                Maintain eye contact with your camera and explain your response...
              </Text>
              <TouchableOpacity style={styles.stopRecordBtn} onPress={stopRecording}>
                <Text style={styles.stopRecordBtnText}>⏹️ Stop Recording</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* State 4: Recording Stopped, Ready to Submit */}
          {recordingState === 'recorded' && (
            <View style={styles.recordedBox}>
              <View style={styles.recordedMetaRow}>
                <Text style={styles.recordedSuccessText}>
                  ✓ {hasVideoTrack ? 'Video & Audio Response Captured' : 'Audio Response Captured'}
                </Text>
                <Text style={styles.recordedTimeBadge}>{formatTime(recordingDuration)}</Text>
              </View>
              <Text style={styles.readyPrompt}>
                Submit your response for Whisper transcription and expected-concept evaluation, or record again:
              </Text>
              <View style={styles.recordBtnRow}>
                <TouchableOpacity style={styles.reRecordBtn} onPress={startRecording}>
                  <Text style={styles.reRecordBtnText}>🔄 Re-record</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={submitAndEvaluate}>
                  <Text style={styles.submitBtnText}>🚀 Submit & Evaluate</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* State 5: Processing Transcription & Evaluation */}
          {recordingState === 'evaluating' && (
            <View style={styles.centerStatusBox}>
              <ActivityIndicator color="#10B981" size="large" />
              <Text style={styles.statusPrompt}>Transcribing Speech with Whisper...</Text>
              <Text style={styles.statusSub}>
                Analyzing answer relevance and evaluating expected concepts ({formatTime(recordingDuration)} response).
              </Text>
            </View>
          )}

          {/* State 6: Evaluation Results Display */}
          {recordingState === 'evaluated' && evaluationData && (
            <View style={styles.evaluatedContainer}>
              {/* Candidate Transcript Box */}
              <View style={styles.transcriptCard}>
                <View style={styles.transcriptHeaderRow}>
                  <Text style={styles.transcriptLabel}>CANDIDATE SPOKEN TRANSCRIPT</Text>
                  <Text style={styles.transcriptWordsBadge}>
                    {evaluationData.transcript_metadata?.word_count || 0} words
                  </Text>
                </View>
                <Text style={styles.transcriptText}>
                  {candidateTranscript || "(No words recognized in audio recording. Please speak closer to the microphone and try again.)"}
                </Text>
                {evaluationData.transcript_metadata?.duration_seconds && (
                  <Text style={styles.transcriptDuration}>
                    Audio duration: {evaluationData.transcript_metadata.duration_seconds}s • Model: {evaluationData.transcript_metadata.model_used || 'whisper-base'}
                  </Text>
                )}
              </View>

              {/* Member 3 Evaluation Report Card */}
              <View style={styles.evalResultsCard}>
                <View style={styles.evalHeaderRow}>
                  <Text style={styles.evalHeaderTitle}>MEMBER 3: EVALUATION REPORT</Text>
                  <Text style={styles.evalScoreBadge}>
                    {evaluationData.relevance.relevance_score}% Relevance
                  </Text>
                </View>

                {/* Metrics Row */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Concept Coverage</Text>
                    <Text style={styles.metricValue}>
                      {evaluationData.concept_coverage.coverage_score}%
                    </Text>
                    <Text style={styles.metricSub}>
                      ({evaluationData.concept_coverage.covered_count}/{evaluationData.concept_coverage.total_expected} concepts)
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Relevance Level</Text>
                    <Text style={[styles.metricValue, { color: '#38BDF8' }]}>
                      {evaluationData.relevance.interpretation}
                    </Text>
                    <Text style={styles.metricSub}>
                      {evaluationData.transcript_metadata?.word_count || 0} words analyzed
                    </Text>
                  </View>
                </View>

                {/* Covered Concepts */}
                {evaluationData.concept_coverage.covered_concepts?.length > 0 && (
                  <View style={styles.conceptSection}>
                    <Text style={styles.coveredLabel}>✓ COVERED KEY CONCEPTS:</Text>
                    <View style={styles.conceptsRow}>
                      {evaluationData.concept_coverage.covered_concepts.map((c, i) => (
                        <View key={i} style={styles.coveredChip}>
                          <Text style={styles.coveredChipText}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Partially Covered Concepts */}
                {evaluationData.concept_coverage.partially_covered_concepts?.length > 0 && (
                  <View style={styles.conceptSection}>
                    <Text style={styles.partialLabel}>⚠ PARTIALLY COVERED CONCEPTS:</Text>
                    <View style={styles.conceptsRow}>
                      {evaluationData.concept_coverage.partially_covered_concepts.map((c, i) => (
                        <View key={i} style={styles.partialChip}>
                          <Text style={styles.partialChipText}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Missing Concepts */}
                {evaluationData.concept_coverage.missing_concepts?.length > 0 && (
                  <View style={styles.conceptSection}>
                    <Text style={styles.missingLabel}>✗ MISSING EXPECTED CONCEPTS:</Text>
                    <View style={styles.conceptsRow}>
                      {evaluationData.concept_coverage.missing_concepts.map((c, i) => (
                        <View key={i} style={styles.missingChip}>
                          <Text style={styles.missingChipText}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Module 4 Speaking Delivery Analysis Card */}
              {evaluationData.delivery_metrics && (
                <View style={styles.deliveryResultsCard}>
                  <View style={styles.evalHeaderRow}>
                    <Text style={styles.deliveryHeaderTitle}>SPEAKING DELIVERY ANALYSIS</Text>
                    <Text style={[
                      styles.deliveryBadge,
                      evaluationData.delivery_metrics.pace_rating === 'Optimal'
                        ? styles.badgeOptimal
                        : styles.badgeWarning
                    ]}>
                      {evaluationData.delivery_metrics.words_per_minute} WPM ({evaluationData.delivery_metrics.pace_rating})
                    </Text>
                  </View>

                  <View style={styles.metricsRow}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Pacing Cadence</Text>
                      <Text style={styles.metricValue}>
                        {evaluationData.delivery_metrics.words_per_minute} WPM
                      </Text>
                      <Text style={styles.metricSub}>
                        {evaluationData.delivery_metrics.pace_rating} pace (target: 110-165)
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Filler Word Count</Text>
                      <Text style={[
                        styles.metricValue,
                        { color: evaluationData.delivery_metrics.total_filler_words === 0 ? '#10B981' : '#F59E0B' }
                      ]}>
                        {evaluationData.delivery_metrics.total_filler_words}
                      </Text>
                      <Text style={styles.metricSub}>
                        {evaluationData.delivery_metrics.filler_percentage}% of total words
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Extended Pauses</Text>
                      <Text style={styles.metricValue}>
                        {evaluationData.delivery_metrics.extended_pause_count}
                      </Text>
                      <Text style={styles.metricSub}>
                        {evaluationData.delivery_metrics.total_pause_duration_seconds}s total silence (&gt;1.5s)
                      </Text>
                    </View>
                  </View>

                  {/* Coaching Tip */}
                  {evaluationData.delivery_metrics.speaking_coaching_tip ? (
                    <View style={styles.tipBox}>
                      <Text style={styles.tipLabel}>💡 Speaking Coach Tip:</Text>
                      <Text style={styles.tipText}>
                        {evaluationData.delivery_metrics.speaking_coaching_tip}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Module 4 Visual Engagement Analysis Card */}
              {evaluationData.visual_metrics && evaluationData.visual_metrics.video_track_detected && (
                <View style={styles.visualResultsCard}>
                  <View style={styles.evalHeaderRow}>
                    <Text style={styles.visualHeaderTitle}>VISUAL ENGAGEMENT & FRAMING</Text>
                    <Text style={styles.visualBadge}>
                      {evaluationData.visual_metrics.face_presence_ratio}% Face Presence
                    </Text>
                  </View>

                  <View style={styles.metricsRow}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Camera Visibility</Text>
                      <Text style={styles.metricValue}>
                        {evaluationData.visual_metrics.face_presence_ratio}%
                      </Text>
                      <Text style={styles.metricSub}>
                        {evaluationData.visual_metrics.face_detected_frames}/{evaluationData.visual_metrics.total_frames_sampled} frames detected
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Center Framing</Text>
                      <Text style={[styles.metricValue, { color: '#38BDF8' }]}>
                        {evaluationData.visual_metrics.face_centering_ratio}%
                      </Text>
                      <Text style={styles.metricSub}>
                        {evaluationData.visual_metrics.face_centered_frames} frames in center 50%
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Head & Posture</Text>
                      <Text style={[styles.metricValue, { color: '#A7F3D0', fontSize: 13 }]}>
                        {evaluationData.visual_metrics.head_movement_stability}
                      </Text>
                      <Text style={styles.metricSub}>
                        {evaluationData.visual_metrics.upper_body_posture_stability}
                      </Text>
                    </View>
                  </View>

                  {/* Visual Coaching Tip */}
                  {evaluationData.visual_metrics.visual_coaching_tip ? (
                    <View style={styles.tipBox}>
                      <Text style={styles.tipLabel}>📹 Camera Framing Tip:</Text>
                      <Text style={styles.tipText}>
                        {evaluationData.visual_metrics.visual_coaching_tip}
                      </Text>
                    </View>
                  ) : null}

                  {/* Objective Methodology Note */}
                  {evaluationData.visual_metrics.methodology_limitations ? (
                    <Text style={styles.methodologyNote}>
                      ℹ️ {evaluationData.visual_metrics.methodology_limitations}
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Record New Answer Button */}
              <TouchableOpacity style={styles.reRecordOutlinedBtn} onPress={resetToRecord}>
                <Text style={styles.reRecordOutlinedBtnText}>🎙️ Record New Answer for this Question</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Member 2 Adaptive Follow-up Probing Trigger Button */}
          {recordingState === 'evaluated' && candidateTranscript.trim().length > 0 && (
            <TouchableOpacity
              style={[styles.followupBtn, generatingFollowup && styles.btnDisabled]}
              onPress={handleGenerateFollowup}
              disabled={generatingFollowup}
            >
              {generatingFollowup ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.followupBtnText}>
                  {evaluationData?.concept_coverage?.missing_concepts?.length > 0
                    ? `⚡ Probing Follow-up on Missing Concepts (${evaluationData.concept_coverage.missing_concepts.length})`
                    : '⚡ Generate Adaptive Follow-up Question'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Follow-up Display Card */}
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
            <TouchableOpacity style={styles.secondaryBtn} onPress={handlePreviousQuestion}>
              <Text style={styles.secondaryBtnText}>← Previous</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.primaryNavBtn} onPress={handleNextQuestion}>
            <Text style={styles.primaryNavBtnText}>
              {currentIndex < questions.length - 1 ? 'Next Question →' : 'Finish & View Performance Report 🎉'}
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
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finishHeaderBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  finishHeaderBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
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

  // Camera Preview Styles
  cameraPreviewContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    marginBottom: 16,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  cameraPreviewContainerCompact: {
    marginBottom: 14,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  cameraHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  cameraTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cameraIcon: {
    fontSize: 14,
  },
  cameraHeaderTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  liveCameraBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  liveCameraBadgeText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  idleCameraBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  idleCameraBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  evaluatedCameraBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  evaluatedCameraBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  videoViewport: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 540,
    minHeight: 200,
    backgroundColor: '#020617',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  videoViewportCompact: {
    aspectRatio: undefined,
    height: 64,
    minHeight: 64,
    maxHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recordingOverlayBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    zIndex: 10,
  },
  recordingOverlayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recordingOverlayText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  cameraPlaceholder: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 520,
  },
  placeholderIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  placeholderText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 20,
  },
  placeholderSub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  cameraPlaceholderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  placeholderIconCompact: {
    fontSize: 20,
  },
  placeholderTextWrapCompact: {
    justifyContent: 'center',
  },
  placeholderTextCompact: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  placeholderSubCompact: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 14,
  },

  // Recording Experience Styles
  recordActionBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    marginBottom: 14,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  recordPrompt: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 18,
  },
  startRecordBtn: {
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  startRecordBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  centerStatusBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    marginBottom: 14,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  statusPrompt: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  statusSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  activeRecordBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    alignItems: 'center',
    marginBottom: 14,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  liveLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 1,
  },
  timerDisplay: {
    fontSize: 34,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 2,
    marginVertical: 4,
    fontVariant: ['tabular-nums'],
  },
  speakPrompt: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 16,
  },
  stopRecordBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  stopRecordBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  recordedBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10B981',
    marginBottom: 14,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  recordedMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordedSuccessText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },
  recordedTimeBadge: {
    color: '#A7F3D0',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: '800',
  },
  readyPrompt: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  recordBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  reRecordBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  reRecordBtnText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  submitBtn: {
    flex: 1.6,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Evaluated Results Styles
  evaluatedContainer: {
    marginBottom: 12,
  },
  transcriptCard: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  transcriptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  transcriptWordsBadge: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },
  transcriptText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'normal',
  },
  transcriptDuration: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 8,
  },
  evalResultsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
    padding: 14,
    marginBottom: 12,
  },
  evalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
  },
  evalHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  evalScoreBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 15,
    color: '#10B981',
    fontWeight: '800',
  },
  metricSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  conceptSection: {
    marginTop: 8,
  },
  coveredLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 4,
  },
  coveredChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  coveredChipText: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '600',
  },
  partialLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    marginBottom: 4,
  },
  partialChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  partialChipText: {
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: '600',
  },
  missingLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 4,
  },
  missingChip: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  missingChipText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '600',
  },
  reRecordOutlinedBtn: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  reRecordOutlinedBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },

  // Error Banner
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  errorIcon: {
    fontSize: 18,
  },
  errorTextWrap: {
    flex: 1,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  errorDetail: {
    color: '#FCA5A5',
    fontSize: 11,
    lineHeight: 15,
  },
  retryBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Follow-up Styles
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

  // Navigation Row
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
  // Module 4 Delivery & Visual Cards
  deliveryResultsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: 14,
    marginBottom: 12,
  },
  deliveryHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  deliveryBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeOptimal: {
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeWarning: {
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  visualResultsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    padding: 14,
    marginBottom: 12,
  },
  visualHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 0.5,
  },
  visualBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A78BFA',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tipBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    marginTop: 8,
  },
  tipLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 3,
  },
  tipText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  methodologyNote: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 8,
    fontStyle: 'italic',
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
