import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import { apiClient } from '../api/client';
import SectionCard from '../components/SectionCard';

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

    // 3. Perform background NLP & speech evaluation
    try {
      let evalResult = null;
      if (blob && blob.size > 0) {
        const formData = new FormData();
        const fileExt = blob.type.includes('mp4') ? 'mp4' : 'webm';
        formData.append('audio_file', blob, `answer_${answerId}.${fileExt}`);
        formData.append('question_id', answerId);
        formData.append('question_text', currentQ.question_text);
        formData.append('category', currentQ.category || 'TECHNICAL');
        formData.append('difficulty', currentQ.difficulty || 'MEDIUM');
        formData.append('target_role', currentProfile?.target_role || 'Software Engineer');

        if (currentQ.expected_key_concepts && currentQ.expected_key_concepts.length > 0) {
          currentQ.expected_key_concepts.forEach((concept) => {
            formData.append('expected_key_concepts', concept);
          });
        }

        evalResult = await apiClient.evaluateSpeechAnswer(formData);
      } else {
        // Fallback text evaluation if no video blob
        const answerText = liveCandidateTranscript || 'Answer provided by candidate.';
        evalResult = await apiClient.evaluateTextAnswer({
          question_id: answerId,
          question_text: currentQ.question_text,
          answer_text: answerText,
          expected_key_concepts: currentQ.expected_key_concepts || [],
          target_role: currentProfile?.target_role || 'Software Engineer',
          category: currentQ.category || 'TECHNICAL',
          difficulty: currentQ.difficulty || 'MEDIUM',
        });
      }

      // Update answer record with evaluation
      setSessionAnswers((prev) => ({
        ...prev,
        [answerId]: {
          ...prev[answerId],
          evaluated: true,
          evaluation: evalResult,
          transcript: evalResult?.transcript_metadata?.transcript || liveCandidateTranscript || 'Recorded speech',
        },
      }));

      // Construct spoken mistakes feedback
      const spokenFeedback = constructSpokenMistakesFeedback(evalResult, currentQ);
      setSpokenFeedbackText(spokenFeedback);
      setCurrentFeedback(evalResult);

      // Transition to feedback phase and speak mistakes aloud in neural audio!
      setInterviewPhase('feedback');
      isFinalizingRef.current = false;

      // Speak feedback in studio audio, then advance continuously
      speakTextWithNeuralVoice(spokenFeedback, () => {
        feedbackTimeoutRef.current = setTimeout(() => {
          advanceToNextQuestionOrComplete();
        }, 1500);
      });
    } catch (err) {
      console.warn('Evaluation notice:', err);
      setSessionAnswers((prev) => ({
        ...prev,
        [answerId]: {
          ...prev[answerId],
          status: 'saved',
          error: err.message || 'Evaluation error',
          retryable: true,
        },
      }));

      const fallbackMsg = 'Your answer has been saved successfully. Advancing to the next question.';
      setSpokenFeedbackText(fallbackMsg);
      setInterviewPhase('feedback');
      isFinalizingRef.current = false;

      speakTextWithNeuralVoice(fallbackMsg, () => {
        feedbackTimeoutRef.current = setTimeout(() => {
          advanceToNextQuestionOrComplete();
        }, 1200);
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
      const blob = await stopMediaRecorderAsync();

      setSessionAnswers((prev) => ({
        ...prev,
        [answerId]: {
          question_id: answerId,
          question_text: currentQ ? currentQ.question_text : '',
          duration: recordingDuration,
          blob: blob,
          status: 'saved',
          evaluated: false,
          transcript: liveCandidateTranscript || null,
          evaluation: null,
          error: null,
        },
      }));
    }

    stopWebcamTracks();
    exitFullscreenIfActive();
    setInterviewPhase('completed');
  };

  // Navigate to Performance Report Screen
  const handleNavigateToReport = () => {
    const answeredCount = Object.keys(sessionAnswers).length;
    const totalCount = questions.length;

    const evaluationsList = Object.values(sessionAnswers)
      .map((a) => a.evaluation)
      .filter(Boolean);

    navigation.navigate('PerformanceReport', {
      sessionData: {
        evaluations: evaluationsList,
        total_questions: totalCount,
        answered_questions: answeredCount,
        skipped_questions: Math.max(0, totalCount - answeredCount),
        questions: questions,
        session_answers: sessionAnswers,
        profile_id: currentProfile?.profile_id,
        session_id: `mock_session_${Date.now()}`,
      },
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
    <View style={[styles.container, isFullscreen && styles.containerFullscreen]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Header Row with Question Progress & Controls */}
        <View style={styles.headerRow}>
          <View style={styles.badgeContainer}>
            <Text style={styles.questionIndexBadge}>QUESTION {currentIndex + 1} OF {totalCount}</Text>
            <Text style={styles.categoryBadge}>{String(currentQ?.category || 'TECHNICAL').toUpperCase()}</Text>
            <Text style={styles.difficultyBadge}>{String(currentQ?.difficulty || 'MEDIUM').toUpperCase()}</Text>
          </View>

          <View style={styles.headerRightControls}>
            {/* Direct Native Fullscreen Button */}
            <TouchableOpacity
              style={[styles.fsBtn, isFullscreen && styles.fsBtnActive]}
              onPress={handleToggleFullscreen}
            >
              <Text style={styles.fsBtnText}>{isFullscreen ? '⛶ Exit Fullscreen' : '⛶ Full Screen Mode'}</Text>
            </TouchableOpacity>

            {/* Neural Voice & Accent Selector */}
            <TouchableOpacity
              style={styles.voiceSelectBtn}
              onPress={() => setShowVoicePicker(true)}
            >
              <Text style={styles.voiceSelectBtnText}>
                🎙️ {NEURAL_VOICES.find((v) => v.id === selectedVoice)?.accent || 'Voice'} ▾
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.endHeaderBtn} onPress={handlePromptEndInterview}>
              <Text style={styles.endHeaderBtnText}>End</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Fullscreen Prompt Banner if not in Fullscreen */}
        {!isFullscreen && (
          <TouchableOpacity style={styles.fullscreenBanner} onPress={handleToggleFullscreen}>
            <Text style={styles.fullscreenBannerIcon}>⛶</Text>
            <Text style={styles.fullscreenBannerText}>
              Click here to expand into full screen mode for a distraction-free interview
            </Text>
          </TouchableOpacity>
        )}

        {/* ON-SCREEN TRANSCRIBED QUESTION / TELEPROMPTER OVERLAY */}
        <View style={styles.teleprompterCard}>
          <View style={styles.teleprompterHeaderRow}>
            <View style={styles.teleprompterTag}>
              <Text style={styles.teleprompterTagText}>
                {interviewPhase === 'feedback'
                  ? '📢 SPOKEN FEEDBACK & COACHING'
                  : '🎙️ TRANSCRIBED QUESTION PROMPT'}
              </Text>
            </View>

            <View style={styles.teleprompterAudioActions}>
              {isTtsSpeaking ? (
                <View style={styles.speakingWaveBadge}>
                  <Text style={styles.speakingWaveText}>🔊 Speaking in AI Voice...</Text>
                </View>
              ) : (
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
                  <Text style={styles.replayAudioBtnText}>🔊 Replay Audio</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Autoplay Blocked Banner */}
          {autoplayBlocked && !isTtsSpeaking && (
            <TouchableOpacity
              style={styles.unmuteBanner}
              onPress={() => {
                if (interviewPhase === 'feedback') {
                  speakTextWithNeuralVoice(spokenFeedbackText);
                } else if (currentQ?.question_text) {
                  speakTextWithNeuralVoice(currentQ.question_text, null, currentQ.question_id);
                }
              }}
            >
              <Text style={styles.unmuteBannerText}>▶️ Click here to listen to question audio</Text>
            </TouchableOpacity>
          )}

          {/* Large, crystal-clear transcribed question text */}
          <Text style={styles.teleprompterQuestionText}>
            {interviewPhase === 'feedback'
              ? `"${spokenFeedbackText}"`
              : currentQ?.question_text}
          </Text>

          {/* Context Topic & Expected Concepts */}
          {interviewPhase !== 'feedback' && (
            <View style={styles.teleprompterMetaRow}>
              {currentQ?.target_topic ? (
                <Text style={styles.topicPill}>Topic: {currentQ.target_topic}</Text>
              ) : null}
              <View style={styles.conceptsInlineRow}>
                {(currentQ?.expected_key_concepts || []).map((concept, idx) => (
                  <View key={idx} style={styles.conceptChip}>
                    <Text style={styles.conceptChipText}>{concept}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Live Candidate Speech Transcription Display during recording */}
          {interviewPhase === 'recording' && (
            <View style={styles.liveCandidateBox}>
              <View style={styles.liveCandidateHeader}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveCandidateLabel}>YOUR LIVE SPEECH TRANSCRIPTION:</Text>
              </View>
              <Text style={styles.liveCandidateText}>
                {liveCandidateTranscript || 'Speak your answer clearly into your microphone...'}
              </Text>
            </View>
          )}
        </View>

        {/* Live Interaction & Video Area */}
        <SectionCard title="Live Interaction & Camera View">
          {recordingError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <View style={styles.errorTextWrap}>
                <Text style={styles.errorTitle}>Media Notice</Text>
                <Text style={styles.errorDetail}>{recordingError}</Text>
              </View>
            </View>
          )}

          {/* Camera Preview Box with Embedded HUD */}
          <View style={[styles.cameraPreviewContainer, isFullscreen && styles.cameraPreviewFullscreen]}>
            <View style={styles.cameraHeaderRow}>
              <View style={styles.cameraTitleRow}>
                <Text style={styles.cameraIcon}>📹</Text>
                <Text style={styles.cameraHeaderTitle}>CANDIDATE WEBCAM</Text>
              </View>
              {interviewPhase === 'recording' && (
                <View style={styles.liveCameraBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveCameraBadgeText}>LIVE ON AIR</Text>
                </View>
              )}
            </View>

            {/* Video element rendering webcam */}
            <div
              style={{
                width: '100%',
                height: isFullscreen ? 360 : 260,
                backgroundColor: '#0F172A',
                borderRadius: 12,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <video
                ref={videoElementRef}
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
                <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: 20 }}>
                  Camera stream offline or audio-only mode.
                </div>
              )}
            </div>

            {/* Phase HUD Overlays */}
            {interviewPhase === 'prep' && (
              <View style={styles.prepOverlayBox}>
                <View style={styles.prepTopRow}>
                  <View style={styles.prepTagBadge}>
                    <Text style={styles.prepTagBadgeText}>PHASE 1: PREPARATION</Text>
                  </View>
                  <Text style={styles.prepCountdownDigit}>{prepTimeRemaining}s</Text>
                </View>

                <Text style={styles.prepInstructions}>
                  Read and listen to the question carefully. Formulate your structure.
                </Text>

                <TouchableOpacity style={styles.skipPrepBtn} onPress={handleSkipPreparation}>
                  <Text style={styles.skipPrepBtnText}>⚡ Skip Preparation & Start Recording</Text>
                </TouchableOpacity>
              </View>
            )}

            {interviewPhase === 'countdown' && (
              <View style={styles.recordingCountdownBox}>
                <Text style={styles.recordingCountdownLabel}>RECORDING IN</Text>
                <Text style={styles.recordingCountdownNumber}>{countdownRemaining}</Text>
                <Text style={styles.recordingCountdownSub}>Get ready to speak...</Text>
              </View>
            )}

            {interviewPhase === 'recording' && (
              <View style={styles.activeRecordingBox}>
                <View style={styles.timerRow}>
                  <View style={styles.recordingBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.recordingBadgeText}>RECORDING ACTIVE</Text>
                  </View>

                  <View style={styles.timerDigitalWrap}>
                    <Text style={styles.timerLabel}>ANSWER TIMER (MAX 3:00):</Text>
                    <Text style={styles.timerDigits}>{formatTime(180 - recordingDuration)}</Text>
                  </View>
                </View>

                {/* Answer Timer Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(100, (recordingDuration / 180) * 100)}%` },
                    ]}
                  />
                </View>

                {/* Dual Controls: Stop Answer & Continue vs End Interview */}
                <View style={styles.dualControlsRow}>
                  <TouchableOpacity
                    style={styles.stopAndContinueBtn}
                    onPress={handleStopAnswerAndContinue}
                  >
                    <Text style={styles.stopAndContinueBtnText}>⏹ Stop Answer & Continue ➔</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.endInterviewBtn}
                    onPress={handlePromptEndInterview}
                  >
                    <Text style={styles.endInterviewBtnText}>✕ End Interview</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {interviewPhase === 'evaluating' && (
              <View style={styles.evaluatingBox}>
                <ActivityIndicator size="small" color="#38BDF8" />
                <Text style={styles.evaluatingText}>
                  Saving answer and synthesizing audio coaching feedback...
                </Text>
              </View>
            )}

            {interviewPhase === 'feedback' && (
              <View style={styles.feedbackSpokenBox}>
                <View style={styles.feedbackSpokenHeader}>
                  <Text style={styles.feedbackSpokenIcon}>🔊</Text>
                  <Text style={styles.feedbackSpokenTitle}>AI COACHING FEEDBACK (SPEAKING ALOUD)</Text>
                </View>
                <Text style={styles.feedbackSpokenQuote}>
                  {spokenFeedbackText}
                </Text>
                <View style={styles.autoAdvanceRow}>
                  <ActivityIndicator size="small" color="#10B981" />
                  <Text style={styles.autoAdvanceText}>
                    Continuously advancing to next question...
                  </Text>
                </View>
              </View>
            )}
          </View>
        </SectionCard>
      </ScrollView>

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
    backgroundColor: '#0F172A',
  },
  containerFullscreen: {
    padding: 0,
    backgroundColor: '#0A0F1D',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
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
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
  },
  readyEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  readyTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  readySub: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  roleHighlight: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  readyVoiceBox: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800',
  },
  readyTestBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  readyTestBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  readyVoiceSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  readyVoiceName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  readyVoicePill: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  changeVoiceLink: {
    color: '#38BDF8',
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 10,
    borderRadius: 8,
  },
  featureIcon: {
    fontSize: 16,
  },
  featureText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  launchBtnContainer: {
    width: '100%',
    gap: 10,
  },
  launchFsBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  launchFsBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  launchNormalBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  launchNormalBtnText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },

  // Header & Navigation
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  questionIndexBadge: {
    color: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  categoryBadge: {
    color: '#94A3B8',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  difficultyBadge: {
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fsBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  fsBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#60A5FA',
  },
  fsBtnText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
  },
  voiceSelectBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  voiceSelectBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  endHeaderBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  endHeaderBtnText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '800',
  },

  fullscreenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  fullscreenBannerIcon: {
    color: '#60A5FA',
    fontSize: 16,
    fontWeight: '900',
  },
  fullscreenBannerText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  // Teleprompter Card
  teleprompterCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#38BDF8',
    padding: 16,
    marginBottom: 14,
  },
  teleprompterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  teleprompterTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  teleprompterTagText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  teleprompterAudioActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speakingWaveBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  speakingWaveText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
  },
  replayAudioBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  replayAudioBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  unmuteBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  unmuteBannerText: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '800',
  },
  teleprompterQuestionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 10,
  },
  teleprompterMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  topicPill: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  conceptsInlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  conceptChip: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  conceptChipText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
  },

  // Live Candidate Speech Transcription Display
  liveCandidateBox: {
    marginTop: 12,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    padding: 10,
  },
  liveCandidateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveCandidateLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveCandidateText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },

  // Camera & Video HUD
  cameraPreviewContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cameraPreviewFullscreen: {
    padding: 16,
  },
  cameraHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cameraTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cameraIcon: {
    fontSize: 14,
  },
  cameraHeaderTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveCameraBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveCameraBadgeText: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '900',
  },

  // Prep Phase Overlay
  prepOverlayBox: {
    marginTop: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38BDF8',
    padding: 14,
  },
  prepTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  prepTagBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  prepTagBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '900',
  },
  prepCountdownDigit: {
    color: '#38BDF8',
    fontSize: 22,
    fontWeight: '900',
  },
  prepInstructions: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  skipPrepBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipPrepBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Countdown Phase Overlay
  recordingCountdownBox: {
    marginTop: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: 18,
    alignItems: 'center',
  },
  recordingCountdownLabel: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  recordingCountdownNumber: {
    color: '#F59E0B',
    fontSize: 48,
    fontWeight: '900',
  },
  recordingCountdownSub: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 4,
  },

  // Recording Active Box
  activeRecordingBox: {
    marginTop: 12,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordingBadgeText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '900',
  },
  timerDigitalWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  timerDigits: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#1E293B',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#EF4444',
  },
  dualControlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stopAndContinueBtn: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  stopAndContinueBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  endInterviewBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  endInterviewBtnText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
  },

  // Evaluating Box
  evaluatingBox: {
    marginTop: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38BDF8',
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  evaluatingText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },

  // Spoken Feedback Box
  feedbackSpokenBox: {
    marginTop: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    padding: 14,
  },
  feedbackSpokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  feedbackSpokenIcon: {
    fontSize: 14,
  },
  feedbackSpokenTitle: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  feedbackSpokenQuote: {
    color: '#F0FDF4',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    fontWeight: '600',
  },
  autoAdvanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoAdvanceText: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '600',
  },

  // Modals & Completion
  completedContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
  },
  completedEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  completedTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
  },
  completedSub: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  viewReportBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  viewReportBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: '#475569',
  },
  voiceModalContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#475569',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  modalSub: {
    color: '#94A3B8',
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
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  voiceItemSelected: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  voiceItemName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  voiceItemNameSelected: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  voiceItemLang: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  voiceItemCheck: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: '900',
  },
  modalCloseBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalDescription: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  modalHighlight: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  modalWarning: {
    color: '#FCA5A5',
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
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalContinueBtnText: {
    color: '#E2E8F0',
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
  primaryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
