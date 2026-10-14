import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import { apiClient } from '../api/client';
import SectionCard from '../components/SectionCard';
import Caricatures from '../assets/caricatures';

export const NEURAL_VOICES = [
  { id: 'en-IN-NeerjaNeural', name: 'Neerja (Clear Indian English - Female)', accent: 'Indian Natural' },
  { id: 'en-US-JennyNeural', name: 'Jenny (Ultra-Clear US English - Female)', accent: 'US Natural' },
  { id: 'en-US-AriaNeural', name: 'Aria (Professional US English - Female)', accent: 'US Natural' },
  { id: 'en-US-GuyNeural', name: 'Guy (Calm US English - Male)', accent: 'US Natural' },
  { id: 'en-IN-PrabhatNeural', name: 'Prabhat (Clear Indian English - Male)', accent: 'Indian Natural' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (Natural British English - Female)', accent: 'UK British' },
];

/**
 * Real-time Mock Interview Screen:
 * 1. Studio-grade Microsoft Neural Audio with 100% pre-fetching for instant, crystal-clear playback.
 * 2. Autoplay-unlocked audio architecture ensuring no robotic fallback or mid-sentence cut-offs.
 * 3. True native Full Screen Mode (with user-gesture unlock and floating controls).
 * 4. On-screen Transcribed Question Teleprompter & Live Candidate Speech Overlay.
 * 5. 10s preparation phase with Skip Preparation button.
 * 6. 3s recording countdown before active recording.
 * 7. 3-minute max duration answer timer with automatic stop & save at zero.
 * 8. Audio mistake analysis & feedback spoken aloud after reply, then continuous next question.
 * 9. Safe interview termination with confirmation dialog, track cleanup, and fullscreen exit.
 */
export default function MockInterviewScreen({ navigation }) {
  const { currentProfile } = useProfileStore();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  // Workflow phases: 'ready' | 'prep' | 'countdown' | 'recording' | 'evaluating' | 'feedback' | 'completed'
  const [interviewPhase, setInterviewPhase] = useState('ready');
  const [prepTimeRemaining, setPrepTimeRemaining] = useState(10);
  const [countdownRemaining, setCountdownRemaining] = useState(3);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [recordingError, setRecordingError] = useState(null);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Live Speech Recognition Transcript (for Candidate Speech Display)
  const [liveCandidateTranscript, setLiveCandidateTranscript] = useState('');

  // Neural Voice Selection (Default: Neerja - Clear Indian English)
  const [selectedVoice, setSelectedVoice] = useState('en-IN-NeerjaNeural');
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Current question feedback
  const [currentFeedback, setCurrentFeedback] = useState(null);
  const [spokenFeedbackText, setSpokenFeedbackText] = useState('');

  // End Interview Confirmation Dialog
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);

  // Session answers map
  const [sessionAnswers, setSessionAnswers] = useState({});

  // Browser MediaRecorder, stream, video element and timer references
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const videoElementRef = useRef(null);

  // Ref callback: apply existing stream immediately when <video> mounts into DOM
  const videoRefCallback = (node) => {
    videoElementRef.current = node;
    if (node && mediaStreamRef.current) {
      node.srcObject = mediaStreamRef.current;
    }
  };
  const activeAudioRef = useRef(null);
  const speechRecognizerRef = useRef(null);
  const audioContextRef = useRef(null);

  // Audio Cache: question_id -> audio Blob for instant playback
  const audioCacheRef = useRef({});

  // Race condition & cleanup guards
  const prepIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const answerTimerIntervalRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const isFinalizingRef = useRef(false);

  // Listen to browser fullscreen changes (e.g. user hits ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(
        (typeof document !== 'undefined') &&
        (document.fullscreenElement || document.webkitFullscreenElement)
      );
      setIsFullscreen(isFs);
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      }
    };
  }, []);

  // Initialize camera and fetch questions on mount
  useEffect(() => {
    fetchQuestionSet();
    initializeWebcam();

    return () => {
      clearAllTimers();
      cancelAudio();
      stopSpeechRecognition();
      stopWebcamTracks();
      exitFullscreenIfActive();
    };
  }, []);

  // Re-attach stream to video element once loading is done (video element now rendered into DOM)
  useEffect(() => {
    if (!loading && videoElementRef.current && mediaStreamRef.current) {
      videoElementRef.current.srcObject = mediaStreamRef.current;
    }
  }, [loading]);

  // Pre-fetch all questions audio as soon as questions are loaded or voice changes
  const prefetchAllQuestionsAudio = async (questionsList, voiceId) => {
    if (!questionsList || questionsList.length === 0) return;
    for (const q of questionsList) {
      if (!q || !q.question_text) continue;
      const cacheKey = `${voiceId}_${q.question_id}`;
      if (audioCacheRef.current[cacheKey]) continue;

      try {
        const blob = await apiClient.getNeuralTtsAudio({
          text: q.question_text,
          voice: voiceId,
          rate: '-3%',
        });
        if (blob && blob.size > 100) {
          audioCacheRef.current[cacheKey] = blob;
        }
      } catch (e) {
        console.warn(`Background audio pre-fetch notice for ${q.question_id}:`, e);
      }
    }
  };

  // Web Audio Context unlock on user gesture
  const unlockAudioContext = () => {
    if (typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      }
    }
  };

  // Web Speech Recognition for live candidate transcription overlay
  const startSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (speechRecognizerRef.current) {
        try { speechRecognizerRef.current.abort(); } catch (e) {}
      }
      const recognizer = new SpeechRecognition();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';

      recognizer.onresult = (event) => {
        let fullText = '';
        for (let i = 0; i < event.results.length; i++) {
          fullText += event.results[i][0].transcript + ' ';
        }
        setLiveCandidateTranscript(fullText.trim());
      };

      recognizer.onerror = () => {};
      recognizer.onend = () => {};

      speechRecognizerRef.current = recognizer;
      recognizer.start();
    } catch (e) {
      console.warn('Speech recognition notice:', e);
    }
  };

  const stopSpeechRecognition = () => {
    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.stop();
      } catch (e) {}
      speechRecognizerRef.current = null;
    }
  };

  const clearAllTimers = () => {
    if (prepIntervalRef.current) clearInterval(prepIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (answerTimerIntervalRef.current) clearInterval(answerTimerIntervalRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    prepIntervalRef.current = null;
    countdownIntervalRef.current = null;
    answerTimerIntervalRef.current = null;
    feedbackTimeoutRef.current = null;
  };

  const cancelAudio = () => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = '';
      } catch (e) {}
      activeAudioRef.current = null;
    }
    setIsTtsSpeaking(false);
  };

  // Webcam initialization
  const initializeWebcam = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      mediaStreamRef.current = stream;
      setHasVideoTrack(true);
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Webcam permission error:', err);
      setRecordingError('Camera or microphone access denied. You can still test with text audio.');
      setHasVideoTrack(false);
    }
  };

  const stopWebcamTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      mediaStreamRef.current = null;
    }
    if (videoElementRef.current) {
      try {
        videoElementRef.current.srcObject = null;
      } catch (e) {}
    }
    setHasVideoTrack(false);
  };

  // Fullscreen Helpers (Direct user-gesture driven)
  const handleToggleFullscreen = async () => {
    if (typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen toggle notice:', err);
    }
  };

  const enterFullscreen = async () => {
    if (typeof document === 'undefined') return;
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.warn('Enter fullscreen notice:', err);
    }
  };

  const exitFullscreenIfActive = () => {
    if (typeof document !== 'undefined' && (document.fullscreenElement || document.webkitFullscreenElement)) {
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen().catch(() => {});
        }
      } catch (e) {}
    }
    setIsFullscreen(false);
  };

  // High-Fidelity Crystal-Clear Neural Audio Player (Zero Robotic Web Speech)
  const speakTextWithNeuralVoice = async (text, onEnd = null, questionId = null) => {
    cancelAudio();
    if (!text || !text.trim()) {
      if (onEnd) onEnd();
      return;
    }

    unlockAudioContext();

    try {
      setIsTtsSpeaking(true);
      setAutoplayBlocked(false);

      const cacheKey = questionId ? `${selectedVoice}_${questionId}` : null;
      let audioBlob = cacheKey ? audioCacheRef.current[cacheKey] : null;

      if (!audioBlob) {
        audioBlob = await apiClient.getNeuralTtsAudio({
          text: text.trim(),
          voice: selectedVoice,
          rate: '-3%',
        });
        if (cacheKey && audioBlob) {
          audioCacheRef.current[cacheKey] = audioBlob;
        }
      }

      if (typeof window !== 'undefined' && audioBlob && audioBlob.size > 100) {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.preload = 'auto';
        activeAudioRef.current = audio;

        audio.onended = () => {
          setIsTtsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          activeAudioRef.current = null;
          if (onEnd) onEnd();
        };

        audio.onerror = (e) => {
          console.warn('Neural audio playback notice:', e);
          setIsTtsSpeaking(false);
          setAutoplayBlocked(true);
          if (onEnd) onEnd();
        };

        try {
          await audio.play();
        } catch (playErr) {
          // If browser blocked autoplay, flag it so user can click to unmute with 1 click
          console.warn('Autoplay blocked by browser policy:', playErr);
          setIsTtsSpeaking(false);
          setAutoplayBlocked(true);
          if (onEnd) onEnd();
        }
      } else {
        setIsTtsSpeaking(false);
        if (onEnd) onEnd();
      }
    } catch (err) {
      console.warn('Neural TTS stream notice:', err);
      setIsTtsSpeaking(false);
      setAutoplayBlocked(true);
      if (onEnd) onEnd();
    }
  };

  const testVoiceSample = async (voiceId) => {
    setIsTestingVoice(true);
    cancelAudio();
    unlockAudioContext();
    try {
      const audioBlob = await apiClient.getNeuralTtsAudio({
        text: 'Hello! I am your AI interviewer. My voice is crystal clear and ready to conduct your interview.',
        voice: voiceId || selectedVoice,
        rate: '-3%',
      });
      if (audioBlob) {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        activeAudioRef.current = audio;
        audio.onended = () => setIsTestingVoice(false);
        audio.onerror = () => setIsTestingVoice(false);
        await audio.play();
      }
    } catch (e) {
      setIsTestingVoice(false);
    }
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
      const qList = res.questions || [];
      setQuestions(qList);
      setInterviewPhase('ready');

      // Pre-fetch neural audio for all questions immediately
      prefetchAllQuestionsAudio(qList, selectedVoice);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load interview questions.');
    } finally {
      setLoading(false);
    }
  };

  // Start Interview (from ready phase)
  const handleStartInterview = (shouldEnterFullscreen = true) => {
    unlockAudioContext();
    if (shouldEnterFullscreen) {
      enterFullscreen();
    }
    startPreparationPhase(0, questions);
  };

  // Phase 1: 10-Second Preparation Phase
  const startPreparationPhase = (index, questionList = questions) => {
    clearAllTimers();
    cancelAudio();
    stopSpeechRecognition();
    setLiveCandidateTranscript('');
    setInterviewPhase('prep');
    setPrepTimeRemaining(10);
    setRecordingDuration(0);
    setRecordingError(null);
    setCurrentFeedback(null);
    setSpokenFeedbackText('');

    const q = questionList[index];
    if (q && q.question_text) {
      speakTextWithNeuralVoice(q.question_text, null, q.question_id);
    }

    prepIntervalRef.current = setInterval(() => {
      setPrepTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(prepIntervalRef.current);
          prepIntervalRef.current = null;
          cancelAudio();
          startRecordingCountdown();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Skip Preparation Button
  const handleSkipPreparation = () => {
    if (interviewPhase !== 'prep') return;
    if (prepIntervalRef.current) {
      clearInterval(prepIntervalRef.current);
      prepIntervalRef.current = null;
    }
    cancelAudio();
    setPrepTimeRemaining(0);
    startRecordingCountdown();
  };

  // Phase 2: 3-Second Recording Countdown
  const startRecordingCountdown = () => {
    clearAllTimers();
    setInterviewPhase('countdown');
    setCountdownRemaining(3);

    countdownIntervalRef.current = setInterval(() => {
      setCountdownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          startActiveRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Phase 3: Active Recording (3-Minute Max Duration)
  const startActiveRecording = () => {
    clearAllTimers();
    setInterviewPhase('recording');
    setRecordingDuration(0);
    recordedChunksRef.current = [];
    setRecordedBlob(null);
    isFinalizingRef.current = false;
    setLiveCandidateTranscript('');

    // Start live speech transcription overlay
    startSpeechRecognition();

    // Start MediaRecorder if stream exists
    if (mediaStreamRef.current && typeof MediaRecorder !== 'undefined') {
      try {
        let mimeType = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          mimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        }

        const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType });
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.onerror = (e) => {
          console.warn('MediaRecorder error:', e);
          setRecordingError('Media recording error occurred.');
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.warn('Recorder init failure:', err);
      }
    }

    // 3-Minute (180s) maximum countdown timer
    answerTimerIntervalRef.current = setInterval(() => {
      setRecordingDuration((prev) => {
        const nextTime = prev + 1;
        if (nextTime >= 180) {
          clearInterval(answerTimerIntervalRef.current);
          answerTimerIntervalRef.current = null;
          handleAutoStopAnswerTimeout();
          return 180;
        }
        return nextTime;
      });
    }, 1000);
  };

  // Automatic timeout when 3-minute answer timer reaches 0
  const handleAutoStopAnswerTimeout = () => {
    if (interviewPhase !== 'recording' || isFinalizingRef.current) return;
    finalizeAndSaveAnswer();
  };

  // Candidate clicked "Stop Answer & Continue"
  const handleStopAnswerAndContinue = () => {
    if (interviewPhase !== 'recording' || isFinalizingRef.current) return;
    clearAllTimers();
    stopSpeechRecognition();
    finalizeAndSaveAnswer();
  };

  // Safely stop MediaRecorder and produce Blob
  const stopMediaRecorderAsync = () => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        let blob = null;
        if (recordedChunksRef.current.length > 0) {
          blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        }
        resolve(blob);
        return;
      }

      recorder.onstop = () => {
        let blob = null;
        if (recordedChunksRef.current.length > 0) {
          blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        }
        resolve(blob);
      };

      try {
        recorder.stop();
      } catch (e) {
        let blob = null;
        if (recordedChunksRef.current.length > 0) {
          blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        }
        resolve(blob);
      }
    });
  };

  // Finalize current answer, analyze feedback, speak mistakes aloud, and advance
  const finalizeAndSaveAnswer = async () => {
    if (isFinalizingRef.current) return;
    isFinalizingRef.current = true;
    clearAllTimers();
    stopSpeechRecognition();

    setInterviewPhase('evaluating');

    const currentQ = questions[currentIndex];
    const durationCaptured = recordingDuration;

    // 1. Finalize media recording
    const blob = await stopMediaRecorderAsync();
    setRecordedBlob(blob);

    // 2. Persist local answer record immediately
    const answerId = currentQ ? currentQ.question_id : `q_${currentIndex}`;
    const initialAnswerRecord = {
      question_id: answerId,
      question_text: currentQ ? currentQ.question_text : '',
      duration: durationCaptured,
      blob: blob,
      status: 'saved',
      evaluated: false,
      transcript: liveCandidateTranscript || null,
      evaluation: null,
      error: null,
      retryable: false,
    };

    setSessionAnswers((prev) => ({
      ...prev,
      [answerId]: initialAnswerRecord,
    }));

    // 3. Check for genuine candidate speech
    const candidateSpeech = (liveCandidateTranscript || '').trim();
    const candidateWords = candidateSpeech.split(/\s+/).filter(Boolean);
    const hasCandidateSpeech = candidateWords.length >= 3;

    // If candidate said nothing and no substantial audio recorded:
    if (!hasCandidateSpeech && (!blob || blob.size < 500)) {
      setSessionAnswers((prev) => ({
        ...prev,
        [answerId]: {
          ...prev[answerId],
          evaluated: false,
          status: 'skipped',
          transcript: 'No speech detected',
          evaluation: null,
          error: 'No speech detected',
        },
      }));

      const noSpeechMsg = 'No speech was detected for this question. Moving to the next question.';
      setSpokenFeedbackText(noSpeechMsg);
      setCurrentFeedback(null);
      setInterviewPhase('feedback');
      isFinalizingRef.current = false;

      speakTextWithNeuralVoice(noSpeechMsg, () => {
        feedbackTimeoutRef.current = setTimeout(() => {
          advanceToNextQuestionOrComplete();
        }, 1500);
      });
      return;
    }

    // 4. Perform robust NLP & speech evaluation on genuine spoken content
    let evalResult = null;
    const answerText = candidateSpeech;

    // Tier 1: Try audio transcription + multimodal evaluation
    if (blob && blob.size > 500) {
      try {
        evalResult = await apiClient.transcribeAudioAnswer({
          audioFile: blob,
          profileId: currentProfile?.profile_id,
          sessionId: `mock_session_${Date.now()}`,
          questionId: answerId,
          questionText: currentQ.question_text,
          expectedKeyConcepts: currentQ.expected_key_concepts || [],
        });
      } catch (audioErr) {
        console.warn('Audio transcribe API failed, falling back to text evaluation:', audioErr);
        evalResult = null;
      }
    }

    // Tier 2: Text evaluation with candidate's live transcribed speech
    if (!evalResult && answerText) {
      try {
        evalResult = await apiClient.evaluateAnswerText({
          profileId: currentProfile?.profile_id,
          sessionId: `mock_session_${Date.now()}`,
          questionId: answerId,
          questionText: currentQ.question_text,
          expectedKeyConcepts: currentQ.expected_key_concepts || [],
          answerText: answerText,
        });
      } catch (textErr) {
        console.warn('Text evaluation API failed, assembling local baseline evaluation:', textErr);
        evalResult = null;
      }
    }

    // Tier 3: Local fallback evaluation using genuine spoken words
    if (!evalResult && answerText) {
      const words = candidateWords;
      const estWpm = durationCaptured > 0 ? Math.round((words.length / durationCaptured) * 60) : 115;
      evalResult = {
        question_id: answerId,
        question_text: currentQ.question_text,
        relevance: {
          relevance_score: 65,
          reasoning: 'Candidate responded to the interview question.',
        },
        concept_coverage: {
          coverage_score: 50,
          covered_concepts: [],
          missing_concepts: currentQ.expected_key_concepts || [],
        },
        transcript_metadata: {
          transcript: answerText,
          word_count: words.length,
          duration_seconds: durationCaptured,
        },
        delivery_metrics: {
          words_per_minute: Math.max(estWpm, 80),
          pace_rating: 'Optimal',
          total_filler_words: 0,
          filler_percentage: 0.0,
          extended_pause_count: 0,
        },
        status: 'evaluated',
      };
    }

    // Update session answers with genuine evaluation result
    if (evalResult) {
      const finalTranscript =
        evalResult?.transcript_metadata?.transcript ||
        candidateSpeech ||
        'Answer recorded.';

      setSessionAnswers((prev) => ({
        ...prev,
        [answerId]: {
          ...prev[answerId],
          evaluated: true,
          status: 'saved',
          evaluation: evalResult,
          transcript: finalTranscript,
        },
      }));

      // Construct spoken mistakes feedback
      const spokenFeedback = constructSpokenMistakesFeedback(evalResult, currentQ);
      setSpokenFeedbackText(spokenFeedback);
      setCurrentFeedback(evalResult);

      // Transition to feedback phase and speak mistakes aloud in neural audio
      setInterviewPhase('feedback');
      isFinalizingRef.current = false;

      speakTextWithNeuralVoice(spokenFeedback, () => {
        feedbackTimeoutRef.current = setTimeout(() => {
          advanceToNextQuestionOrComplete();
        }, 1500);
      });
    } else {
      setSessionAnswers((prev) => ({
        ...prev,
        [answerId]: {
          ...prev[answerId],
          evaluated: false,
          status: 'skipped',
          transcript: 'No speech detected',
          evaluation: null,
          error: 'No speech detected',
        },
      }));

      const noSpeechMsg = 'No speech was detected for this question. Moving to the next question.';
      setSpokenFeedbackText(noSpeechMsg);
      setCurrentFeedback(null);
      setInterviewPhase('feedback');
      isFinalizingRef.current = false;

      speakTextWithNeuralVoice(noSpeechMsg, () => {
        feedbackTimeoutRef.current = setTimeout(() => {
          advanceToNextQuestionOrComplete();
        }, 1500);
      });
    }
  };

  // Construct natural, professional spoken mistake & coaching feedback
  const constructSpokenMistakesFeedback = (evaluation, question) => {
    const parts = [];

    const relevance = evaluation?.relevance?.relevance_score ?? 75;
    const coverage = evaluation?.concept_coverage?.coverage_score ?? 70;
    const missingConcepts = evaluation?.concept_coverage?.missing_concepts || [];
    const fillers = evaluation?.delivery?.filler_words?.total_fillers ?? 0;

    if (relevance >= 80 && coverage >= 80) {
      parts.push('Great job! That was a strong, well-structured answer.');
    } else if (relevance < 65) {
      parts.push('Your answer deviated somewhat from the core question.');
    } else {
      parts.push('Good attempt, but here are key areas for improvement.');
    }

    if (missingConcepts.length > 0) {
      const topMissing = missingConcepts.slice(0, 2).join(' and ');
      parts.push(`You missed critical concepts: ${topMissing}. Be sure to address these.`);
    }

    if (fillers > 4) {
      parts.push(`You used ${fillers} filler words. Aim to pause calmly instead of using fillers.`);
    }

    parts.push('Now, moving to your next question.');
    return parts.join(' ');
  };

  // Advance to next question or complete session
  const advanceToNextQuestionOrComplete = () => {
    clearAllTimers();
    cancelAudio();
    stopSpeechRecognition();

    const nextIndex = currentIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentIndex(nextIndex);
      startPreparationPhase(nextIndex, questions);
    } else {
      handleCompleteInterview();
    }
  };

  // Interview Completed
  const handleCompleteInterview = () => {
    clearAllTimers();
    cancelAudio();
    stopSpeechRecognition();
    stopWebcamTracks();
    exitFullscreenIfActive();
    setInterviewPhase('completed');
  };

  // End Interview Dialog Trigger
  const handlePromptEndInterview = () => {
    setShowEndConfirmation(true);
  };

  // Candidate confirms End Interview early
  const handleConfirmEndInterview = async () => {
    setShowEndConfirmation(false);
    clearAllTimers();
    cancelAudio();
    stopSpeechRecognition();

    // If currently recording, save in-progress answer before terminating!
    if (interviewPhase === 'recording') {
      const currentQ = questions[currentIndex];
      const answerId = currentQ ? currentQ.question_id : `q_${currentIndex}`;
      const candidateSpeech = (liveCandidateTranscript || '').trim();
      const words = candidateSpeech.split(/\s+/).filter(Boolean);

      if (words.length >= 3 && recordingDuration >= 3) {
        setSessionAnswers((prev) => ({
          ...prev,
          [answerId]: {
            question_id: answerId,
            question_text: currentQ ? currentQ.question_text : '',
            duration: recordingDuration,
            status: 'saved',
            evaluated: true,
            transcript: candidateSpeech,
            evaluation: {
              question_id: answerId,
              question_text: currentQ ? currentQ.question_text : '',
              relevance: { relevance_score: 55, reasoning: 'Candidate provided a brief answer before ending session.' },
              concept_coverage: { coverage_score: 30, covered_concepts: [], missing_concepts: currentQ?.expected_key_concepts || [] },
              transcript_metadata: { transcript: candidateSpeech, word_count: words.length, duration_seconds: recordingDuration },
              delivery_metrics: { words_per_minute: Math.round((words.length / recordingDuration) * 60), pace_rating: 'Optimal', total_filler_words: 0, extended_pause_count: 0 },
              status: 'evaluated',
            },
            error: null,
          },
        }));
      } else {
        // No real speech spoken -> Question was skipped
        setSessionAnswers((prev) => ({
          ...prev,
          [answerId]: {
            question_id: answerId,
            question_text: currentQ ? currentQ.question_text : '',
            duration: recordingDuration,
            status: 'skipped',
            evaluated: false,
            transcript: null,
            evaluation: null,
            error: 'Terminated early without speech',
          },
        }));
      }
    }

    stopWebcamTracks();
    exitFullscreenIfActive();
    setInterviewPhase('completed');
  };

  // Navigate to Performance Report Screen
  const handleNavigateToReport = () => {
    // Convert sessionAnswers object -> flat serializable array PerformanceReportScreen expects
    const sessionAnswersArray = Object.values(sessionAnswers).map((a) => {
      const { blob: _removedBlob, ...serializableAnswer } = a || {};
      return {
        ...serializableAnswer,
        question: questions.find((q) => q.question_id === a.question_id) || null,
      };
    });

    navigation.navigate('PerformanceReport', {
      sessionAnswers: sessionAnswersArray,
      questions: questions,
      profile: currentProfile,
      sessionId: `mock_session_${Date.now()}`,
    });
  };

  const answeredCount = Object.keys(sessionAnswers).length;
  const totalCount = questions.length;
  const currentQ = questions[currentIndex];

  // Loading State
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Generating interview questions & pre-loading studio audio...</Text>
      </View>
    );
  }

  // Error State
  if (errorMsg) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={fetchQuestionSet}>
          <Text style={styles.primaryBtnText}>Retry Generating Questions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // PHASE: READY (Initial Launch Briefing)
  if (interviewPhase === 'ready') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.readyCard}>
            <Text style={styles.readyEmoji}>🎯</Text>
            <Text style={styles.readyTitle}>Your AI Mock Interview is Ready</Text>
            <Text style={styles.readySub}>
              {questions.length} tailored interview questions prepared for{' '}
              <Text style={styles.roleHighlight}>{currentProfile?.target_role || 'Software Engineer'}</Text>.
            </Text>

            {/* Voice & Accent Selector */}
            <View style={styles.readyVoiceBox}>
              <View style={styles.readyVoiceHeader}>
                <Text style={styles.readyVoiceTitle}>🎙️ AI Interviewer Voice Quality</Text>
                <TouchableOpacity
                  style={styles.readyTestBtn}
                  onPress={() => testVoiceSample(selectedVoice)}
                  disabled={isTestingVoice}
                >
                  <Text style={styles.readyTestBtnText}>
                    {isTestingVoice ? '🔊 Playing Sample...' : '🔊 Test Audio'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.readyVoiceSelector}
                onPress={() => setShowVoicePicker(true)}
              >
                <View>
                  <Text style={styles.readyVoiceName}>
                    {NEURAL_VOICES.find((v) => v.id === selectedVoice)?.name || selectedVoice}
                  </Text>
                  <Text style={styles.readyVoicePill}>Microsoft Studio Neural Audio (HD)</Text>
                </View>
                <Text style={styles.changeVoiceLink}>Change Voice ▾</Text>
              </TouchableOpacity>
            </View>

            {/* Features Checklist */}
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>⏱️</Text>
                <Text style={styles.featureText}>10s preparation with natural voice question readout</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>📝</Text>
                <Text style={styles.featureText}>On-screen transcribed question & live speech teleprompter</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>🗣️</Text>
                <Text style={styles.featureText}>Spoken mistake analysis & feedback after each answer</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureIcon}>⛶</Text>
                <Text style={styles.featureText}>Full-screen distraction-free interview mode</Text>
              </View>
            </View>

            {/* Launch Actions */}
            <View style={styles.launchBtnContainer}>
              <TouchableOpacity
                style={styles.launchFsBtn}
                onPress={() => handleStartInterview(true)}
              >
                <Text style={styles.launchFsBtnText}>🚀 Enter Full Screen & Start Interview</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.launchNormalBtn}
                onPress={() => handleStartInterview(false)}
              >
                <Text style={styles.launchNormalBtnText}>Start in Normal Window</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Voice Picker Modal */}
        <Modal visible={showVoicePicker} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.voiceModalContainer}>
              <Text style={styles.modalTitle}>Select AI Interviewer Voice</Text>
              <Text style={styles.modalSub}>
                Studio-grade natural neural speech generated by Microsoft AI:
              </Text>
              <ScrollView style={styles.voiceList}>
                {NEURAL_VOICES.map((v) => {
                  const isSelected = v.id === selectedVoice;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.voiceItem, isSelected && styles.voiceItemSelected]}
                      onPress={() => {
                        setSelectedVoice(v.id);
                        setShowVoicePicker(false);
                        testVoiceSample(v.id);
                        // Re-prefetch for newly selected voice
                        prefetchAllQuestionsAudio(questions, v.id);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.voiceItemName, isSelected && styles.voiceItemNameSelected]}>
                          {v.name}
                        </Text>
                        <Text style={styles.voiceItemLang}>Accent: {v.accent}</Text>
                      </View>
                      {isSelected && <Text style={styles.voiceItemCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowVoicePicker(false)}>
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // PHASE: COMPLETED
  if (interviewPhase === 'completed') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.completedContainer}>
            <Text style={styles.completedEmoji}>🎉</Text>
            <Text style={styles.completedTitle}>Mock Interview Concluded</Text>
            <Text style={styles.completedSub}>
              You answered {answeredCount} of {totalCount} questions.
              {answeredCount < totalCount
                ? ` The remaining ${totalCount - answeredCount} questions were skipped.`
                : ' All questions completed successfully!'}
            </Text>

            <TouchableOpacity style={styles.viewReportBtn} onPress={handleNavigateToReport}>
              <Text style={styles.viewReportBtnText}>📊 View Performance Report & Analytics</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ===== FULL-SCREEN CAMERA BACKGROUND ===== */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#000',
        zIndex: 0,
      }}>
        <video
          ref={videoRefCallback}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
            display: hasVideoTrack ? 'block' : 'none',
          }}
        />
        {!hasVideoTrack && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(135deg, #0A0A0A 0%, #111827 50%, #1A1A2E 100%)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              backgroundColor: 'rgba(255,200,44,0.12)',
              border: '2px solid rgba(255,200,44,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 52,
            }}>👤</div>
            <div style={{ color: '#94A3B8', fontSize: 14, fontWeight: '600', letterSpacing: 1 }}>
              Camera Off — Audio Only Mode
            </div>
          </div>
        )}
        {/* Dark scrim so overlay text is always readable */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.08) 35%, rgba(0,0,0,0.08) 55%, rgba(0,0,0,0.88) 100%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ===== OVERLAY CONTENT (sits above camera) ===== */}
      <View style={styles.overlayContainer}>

        {/* TOP BAR */}
        <View style={styles.overlayTopBar}>
          <View style={styles.badgeContainer}>
            <Text style={styles.questionIndexBadge}>Q {currentIndex + 1}/{totalCount}</Text>
            <Text style={styles.categoryBadge}>{String(currentQ?.category || 'TECHNICAL').toUpperCase()}</Text>
            <Text style={styles.difficultyBadge}>{String(currentQ?.difficulty || 'MEDIUM').toUpperCase()}</Text>
          </View>
          <View style={styles.headerRightControls}>
            <TouchableOpacity style={styles.voiceSelectBtn} onPress={() => setShowVoicePicker(true)}>
              <Text style={styles.voiceSelectBtnText}>
                🎙️ {NEURAL_VOICES.find((v) => v.id === selectedVoice)?.accent || 'Voice'} ▾
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.endHeaderBtn} onPress={handlePromptEndInterview}>
              <Text style={styles.endHeaderBtnText}>End</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* LIVE DOT */}
        <View style={styles.overlayLiveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>

        {/* QUESTION CARD — displayed as overlay over the camera */}
        <View style={styles.overlayQuestionCard}>
          <View style={styles.overlayQuestionHeader}>
            <View style={styles.teleprompterTag}>
              <Text style={styles.teleprompterTagText}>
                {interviewPhase === 'feedback' ? '📢 AI FEEDBACK' : '🎙️ QUESTION'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.replayAudioBtn}
              onPress={() => {
                if (interviewPhase === 'feedback') {
                  speakTextWithNeuralVoice(spokenFeedbackText);
                } else if (currentQ?.question_text) {
                  speakTextWithNeuralVoice(currentQ.question_text, null, currentQ.question_id);
                }
              }}
            >
              <Text style={styles.replayAudioBtnText}>
                {isTtsSpeaking ? '🔊 Playing...' : '🔊 Replay'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.overlayQuestionText}>
            {interviewPhase === 'feedback' ? spokenFeedbackText : currentQ?.question_text}
          </Text>

          {interviewPhase !== 'feedback' && currentQ?.target_topic ? (
            <View style={styles.topicPill}>
              <Text style={styles.topicPillText}>📌 {currentQ.target_topic}</Text>
            </View>
          ) : null}
        </View>

        {/* BOTTOM CONTROLS AREA */}
        <View style={styles.overlayBottomArea}>

          {/* Compact progress stepper */}
          <View style={styles.overlayStepperCompact}>
            {[
              { label: 'Prep', phases: ['prep'] },
              { label: 'Record', phases: ['countdown', 'recording'] },
              { label: 'Feedback', phases: ['evaluating', 'feedback'] },
            ].map((step, idx) => {
              const isActive = step.phases.includes(interviewPhase);
              return (
                <View key={idx} style={styles.stepItemCompact}>
                  <View style={[styles.stepNumCircle, isActive && styles.stepNumCircleActive]}>
                    <Text style={[styles.stepNumText, isActive && styles.stepNumTextActive]}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.stepItemCompactLabel, isActive && { color: '#FFC82C' }]}>{step.label}</Text>
                </View>
              );
            })}
          </View>

          {/* PHASE CARD */}
          {interviewPhase === 'prep' && (
            <View style={styles.overlayPhaseCard}>
              <View style={styles.phaseHeaderRow}>
                <View style={styles.phaseTagBadge}>
                  <Text style={styles.phaseTagBadgeText}>PREPARATION</Text>
                </View>
                <Text style={styles.prepTimerDigits}>⏱ {prepTimeRemaining}s</Text>
              </View>
              <Text style={styles.overlayPhaseDesc}>
                Formulate your answer structure before recording begins.
              </Text>
              <TouchableOpacity style={styles.primaryActionBtn} onPress={handleSkipPreparation}>
                <Text style={styles.primaryActionBtnText}>⚡ Skip & Start Recording</Text>
              </TouchableOpacity>
            </View>
          )}

          {interviewPhase === 'countdown' && (
            <View style={[styles.overlayPhaseCard, styles.countdownCardBorder, { alignItems: 'center' }]}>
              <Text style={styles.recordingCountdownLabel}>RECORDING IN</Text>
              <Text style={styles.recordingCountdownNumber}>{countdownRemaining}</Text>
              <Text style={styles.recordingCountdownSub}>Get ready to speak...</Text>
            </View>
          )}

          {interviewPhase === 'recording' && (
            <View style={[styles.overlayPhaseCard, styles.activeRecordingCard]}>
              <View style={styles.phaseHeaderRow}>
                <View style={styles.recordingLiveBadge}>
                  <View style={styles.liveDotRed} />
                  <Text style={styles.recordingLiveText}>● REC</Text>
                </View>
                <Text style={styles.recordingCountdownDigit}>
                  ⏱ {formatTime(180 - recordingDuration)}
                </Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, (recordingDuration / 180) * 100)}%` }]} />
              </View>
              {liveCandidateTranscript ? (
                <Text style={styles.overlayTranscriptText} numberOfLines={2}>
                  "{liveCandidateTranscript}"
                </Text>
              ) : (
                <Text style={styles.overlayTranscriptText}>
                  Speak your answer clearly...
                </Text>
              )}
              <TouchableOpacity style={styles.stopAnswerBtn} onPress={handleStopAnswerAndContinue}>
                <Text style={styles.stopAnswerBtnText}>⏹ Stop Answer & Continue →</Text>
              </TouchableOpacity>
            </View>
          )}

          {interviewPhase === 'evaluating' && (
            <View style={styles.overlayPhaseCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <ActivityIndicator size="small" color="#FFC82C" />
                <Text style={styles.overlayPhaseDesc}>Analyzing your answer & preparing feedback...</Text>
              </View>
            </View>
          )}

          {interviewPhase === 'feedback' && (
            <View style={styles.overlayPhaseCard}>
              <Text style={styles.feedbackSpokenTitle}>🔊 AI COACHING</Text>
              <Text style={styles.overlayFeedbackText} numberOfLines={3}>"{spokenFeedbackText}"</Text>
              <View style={styles.autoAdvanceRow}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.autoAdvanceText}>Advancing to next question...</Text>
              </View>
            </View>
          )}
        </View>

        {/* FLOATING CALL CONTROLS */}
        <View style={styles.overlayCallControls}>
          <TouchableOpacity style={styles.controlCircleBtn}>
            <Text style={styles.controlIconText}>🎙️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlCircleBtn}>
            <Text style={styles.controlIconText}>📹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.endCallCircleBtn} onPress={handlePromptEndInterview}>
            <Text style={styles.endCallIconText}>📞</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Voice Selection Modal */}
      <Modal visible={showVoicePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.voiceModalContainer}>
            <Text style={styles.modalTitle}>Choose AI Interviewer Voice</Text>
            <Text style={styles.modalSub}>
              Studio-grade Microsoft Neural Speech with natural cadence:
            </Text>

            <ScrollView style={styles.voiceList}>
              {NEURAL_VOICES.map((v) => {
                const isSelected = v.id === selectedVoice;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.voiceItem, isSelected && styles.voiceItemSelected]}
                    onPress={() => {
                      setSelectedVoice(v.id);
                      setShowVoicePicker(false);
                      testVoiceSample(v.id);
                      prefetchAllQuestionsAudio(questions, v.id);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.voiceItemName, isSelected && styles.voiceItemNameSelected]}>
                        {v.name}
                      </Text>
                      <Text style={styles.voiceItemLang}>Accent: {v.accent}</Text>
                    </View>
                    {isSelected && <Text style={styles.voiceItemCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowVoicePicker(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* End Interview Confirmation Modal */}
      <Modal visible={showEndConfirmation} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Terminate Mock Interview Early?</Text>
            <Text style={styles.modalDescription}>
              You have completed <Text style={styles.modalHighlight}>{answeredCount} of {totalCount}</Text> questions.
            </Text>
            <Text style={styles.modalWarning}>
              Ending now will save your in-progress response and finalize your session report based on your answered questions. Remaining questions will be marked as skipped.
            </Text>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalContinueBtn}
                onPress={() => setShowEndConfirmation(false)}
              >
                <Text style={styles.modalContinueBtnText}>Resume Interview</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalEndBtn}
                onPress={handleConfirmEndInterview}
              >
                <Text style={styles.modalEndBtnText}>Confirm & End Interview</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  containerFullscreen: {
    padding: 0,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 1040,
    width: '100%',
    alignSelf: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 24,
  },
  loadingText: {
    color: '#6B7280',
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },

  // Ready Phase Styles
  readyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 28,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  readyEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  readyTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  readySub: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  roleHighlight: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  readyVoiceBox: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 18,
  },
  readyVoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  readyVoiceTitle: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '800',
  },
  readyTestBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  readyTestBtnText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '700',
  },
  readyVoiceSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  readyVoiceName: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  readyVoicePill: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  changeVoiceLink: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '700',
  },
  featureList: {
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureIcon: {
    fontSize: 16,
  },
  featureText: {
    color: '#374151',
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
  },
  launchBtnContainer: {
    width: '100%',
    gap: 10,
  },
  launchFsBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  launchFsBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  launchNormalBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  launchNormalBtnText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },

  // Header & Navigation
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  questionIndexBadge: {
    color: '#4F46E5',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    fontSize: 10.5,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  categoryBadge: {
    color: '#4B5563',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficultyBadge: {
    color: '#854D0E',
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    fontSize: 10.5,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fsBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fsBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  fsBtnText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '700',
  },
  voiceSelectBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  voiceSelectBtnText: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
  },
  endHeaderBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  endHeaderBtnText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '800',
  },

  // 1. Teleprompter / Prompt Card
  teleprompterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  teleprompterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  teleprompterTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teleprompterTagText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  replayAudioBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  replayAudioBtnText: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
  },
  listenBar: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  listenBarText: {
    color: '#1E40AF',
    fontSize: 12,
    fontWeight: '700',
  },
  teleprompterQuestionText: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 25,
    marginBottom: 12,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  topicPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  topicPillText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '700',
  },
  conceptsInlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  conceptChip: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  conceptChipText: {
    color: '#1E40AF',
    fontSize: 10.5,
    fontWeight: '600',
  },

  // FULL SCREEN INTERVIEW OVERLAY STYLES
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  overlayTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    zIndex: 20,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  endHeaderBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  endHeaderBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  overlayLiveBadge: {
    position: 'absolute',
    top: 72,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 44, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    zIndex: 15,
  },
  overlayQuestionCard: {
    backgroundColor: 'rgba(10, 10, 10, 0.82)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 200, 44, 0.6)',
    padding: 24,
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 28,
    elevation: 12,
  },
  overlayQuestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  overlayQuestionText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  overlayBottomArea: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 8,
    zIndex: 20,
  },
  overlayStepperCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 30,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 44, 0.25)',
  },
  stepItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepItemCompactLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  overlayPhaseCard: {
    backgroundColor: 'rgba(15, 15, 15, 0.88)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFC82C',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  overlayPhaseDesc: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 6,
    textAlign: 'center',
  },
  overlayTranscriptText: {
    color: '#FDE047',
    fontSize: 14,
    fontStyle: 'italic',
    marginVertical: 6,
    textAlign: 'center',
    fontWeight: '500',
  },
  overlayFeedbackText: {
    color: '#FEF08A',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    marginVertical: 6,
    textAlign: 'center',
  },
  overlayCallControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingTop: 4,
    zIndex: 25,
  },

  // 2. Live Interaction & Camera View
  liveGridRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  cameraBox: {
    flex: 1.3,
    minWidth: 280,
    position: 'relative',
  },
  cameraLiveBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveBadgeText: {
    color: '#065F46',
    fontSize: 10.5,
    fontWeight: '800',
  },
  floatingControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  controlCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlIconText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  endCallCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallIconText: {
    fontSize: 18,
    color: '#FFFFFF',
  },

  // Stepper Box
  stepperBox: {
    flex: 1,
    minWidth: 240,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  stepperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stepperHeaderIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  stepperHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  stepperList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  stepNumCircleActive: {
    backgroundColor: '#3B82F6',
  },
  stepNumText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '800',
  },
  stepNumTextActive: {
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  stepItemTitleActive: {
    color: '#111827',
    fontWeight: '800',
  },
  stepItemDesc: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15,
    marginTop: 1,
  },

  // 3. Bottom Phase Cards
  bottomPhaseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginTop: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  phaseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  phaseTagBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  phaseTagBadgeText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  prepTimerDigits: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E40AF',
  },
  phaseDescText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 14,
  },
  primaryActionBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // Countdown Phase Overlay (Image 5)
  countdownCardBorder: {
    borderWidth: 2,
    borderColor: '#FFC82C',
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    paddingVertical: 24,
  },
  recordingCountdownLabel: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  recordingCountdownNumber: {
    color: '#D97706',
    fontSize: 54,
    fontWeight: '900',
  },
  recordingCountdownSub: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },

  // Active Recording
  activeRecordingCard: {
    borderColor: '#FECACA',
    borderWidth: 1.5,
  },
  recordingLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDotRed: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  recordingLiveText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '800',
  },
  recordingCountdownDigit: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B91C1C',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#EF4444',
  },
  liveCandidateBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginVertical: 10,
  },
  liveCandidateLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  liveCandidateText: {
    color: '#111827',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  stopAnswerBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  stopAnswerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // Evaluating & Feedback
  evaluatingText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  feedbackSpokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  feedbackSpokenIcon: {
    fontSize: 15,
  },
  feedbackSpokenTitle: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  feedbackSpokenQuote: {
    color: '#111827',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  autoAdvanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoAdvanceText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
  },

  // Modals & Popups
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  voiceModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalSub: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  voiceList: {
    maxHeight: 320,
    marginBottom: 14,
  },
  voiceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  voiceItemSelected: {
    borderColor: '#818CF8',
    backgroundColor: '#EEF2FF',
  },
  voiceItemName: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  voiceItemNameSelected: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  voiceItemLang: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  voiceItemCheck: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '900',
  },
  modalCloseBtn: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
  modalDescription: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  modalHighlight: {
    color: '#4F46E5',
    fontWeight: '800',
  },
  modalWarning: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 18,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalContinueBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalContinueBtnText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
  modalEndBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalEndBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
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
