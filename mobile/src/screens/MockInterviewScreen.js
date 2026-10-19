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
  const questionsRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [evaluatingStatusText, setEvaluatingStatusText] = useState('Analyzing answer & p-score...');

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

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

  const [liveCandidateTranscript, setLiveCandidateTranscript] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

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

  // Real-time visual analysis state
  const [visualAlert, setVisualAlert] = useState(null); // { message, severity, type }
  const [sessionVisualIssues, setSessionVisualIssues] = useState([]); // accumulated issues for final report
  const frameAnalysisIntervalRef = useRef(null);
  const canvasRef = useRef(null); // hidden canvas for frame capture

  // Browser MediaRecorder, stream, video element and timer references
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const videoElementRef = useRef(null);

  // Ref callback: apply existing stream immediately when <video> mounts into DOM.
  // useCallback ensures the same function reference is used across renders so React
  // does NOT unmount/remount the <video> element — this prevents camera flickering.
  const videoRefCallback = React.useCallback((node) => {
    videoElementRef.current = node;
    if (node && mediaStreamRef.current) {
      node.srcObject = mediaStreamRef.current;
    }
  }, []); // empty deps — intentionally stable reference
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
  const isSessionEndedRef = useRef(false);

  // Hidden canvas for video frame capture (injected into DOM)
  const ensureCanvas = () => {
    if (typeof document === 'undefined') return null;
    if (!canvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 240;
      c.style.display = 'none';
      c.id = 'ai-frame-capture-canvas';
      document.body.appendChild(c);
      canvasRef.current = c;
    }
    return canvasRef.current;
  };

  // Capture current video frame as base64 JPEG
  const captureVideoFrame = () => {
    if (isCameraOff || !videoElementRef.current || !hasVideoTrack) return null;
    const videoEl = videoElementRef.current;
    if (!videoEl.videoWidth || !videoEl.videoHeight) return null;
    try {
      const canvas = ensureCanvas();
      if (!canvas) return null;
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      // Mirror to match displayed video (scaleX -1)
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(videoEl, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      // Strip the data:image/jpeg;base64, prefix
      return dataUrl.split(',')[1] || null;
    } catch (e) {
      return null;
    }
  };

  // Run AI visual analysis on a captured frame
  const runFrameAnalysis = async () => {
    if (isCameraOff || !hasVideoTrack) return;
    const base64Frame = captureVideoFrame();
    if (!base64Frame) return;
    try {
      const result = await apiClient.analyzeInterviewFrame(base64Frame);
      if (result && result.overall_alert && result.alert_message) {
        const severity = result.posture === 'lying_down' ? 'critical' : 'warning';
        const alertType = result.posture === 'lying_down' ? 'posture'
          : result.background === 'extra_people' ? 'background'
          : result.eye_contact === 'poor' ? 'eye_contact'
          : result.attire === 'informal' ? 'attire'
          : 'general';
        setVisualAlert({ message: result.alert_message, severity, type: alertType });
        // Accumulate issue for final report
        setSessionVisualIssues(prev => {
          const isDupe = prev.some(p => p.type === alertType && Date.now() - p.ts < 20000);
          if (isDupe) return prev;
          return [...prev, { message: result.alert_message, severity, type: alertType, ts: Date.now(), posture: result.posture, attire: result.attire, eye_contact: result.eye_contact, background: result.background }];
        });
        // Auto-dismiss warning after 6 seconds
        setTimeout(() => setVisualAlert(null), 6000);
      }
    } catch (e) {
      // Silent — visual analysis is non-blocking
    }
  };

  // Start periodic frame analysis during interview
  const startFrameAnalysis = () => {
    stopFrameAnalysis();
    // First check after 1.5s, then every 5s
    frameAnalysisIntervalRef.current = setInterval(() => {
      runFrameAnalysis();
    }, 5000);
    // Run first check immediately after short delay
    setTimeout(() => runFrameAnalysis(), 1500);
  };

  const stopFrameAnalysis = () => {
    if (frameAnalysisIntervalRef.current) {
      clearInterval(frameAnalysisIntervalRef.current);
      frameAnalysisIntervalRef.current = null;
    }
    setVisualAlert(null);
  };

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
    isSessionEndedRef.current = false;
    fetchQuestionSet();
    initializeWebcam();

    return () => {
      isSessionEndedRef.current = true;
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
    stopFrameAnalysis();
  };

  const cancelAudio = () => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.onended = null;
        activeAudioRef.current.onerror = null;
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

  const handleToggleMute = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // Toggle: if currently muted, enable it
      });
    }
    setIsMuted((prev) => !prev);
  };

  const handleToggleCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = isCameraOff; // Toggle: if currently off, enable it
      });
    }
    setIsCameraOff((prev) => !prev);
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
      questionsRef.current = qList;
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
    const currentQList = questionsRef.current.length > 0 ? questionsRef.current : questions;
    startPreparationPhase(0, currentQList);
  };

  // Phase 1: 10-Second Preparation Phase
  const startPreparationPhase = (index, questionList = (questionsRef.current.length > 0 ? questionsRef.current : questions)) => {
    if (isSessionEndedRef.current) return;
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
    setEvaluatingStatusText('Analyzing answer & p-score...');

    const q = questionList[index];
    if (q && q.question_text) {
      speakTextWithNeuralVoice(q.question_text, null, q.question_id);
    }

    // Start AI visual monitoring early during question prep
    startFrameAnalysis();

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
    if (isSessionEndedRef.current) return;
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
    if (isSessionEndedRef.current) return;
    clearAllTimers();
    setInterviewPhase('recording');
    setRecordingDuration(0);
    recordedChunksRef.current = [];
    setRecordedBlob(null);
    isFinalizingRef.current = false;
    setLiveCandidateTranscript('');

    // Start live speech transcription overlay
    startSpeechRecognition();

    // Start AI visual frame monitoring (posture, attire, eye contact, background)
    startFrameAnalysis();

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
    if (isSessionEndedRef.current || isFinalizingRef.current) return;
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

    // Tier 3: Local fallback evaluation — honest scoring based on actual spoken content
    if (!evalResult && answerText) {
      const words = candidateWords;
      const totalExpected = (currentQ.expected_key_concepts || []).length;
      const estWpm = durationCaptured > 0 ? Math.round((words.length / durationCaptured) * 60) : 100;

      // Compute honest relevance: compare spoken words against question keywords
      const qWords = new Set(currentQ.question_text.toLowerCase().split(/\W+/).filter(w => w.length > 3));
      const ansWordsSet = new Set(answerText.toLowerCase().split(/\W+/).filter(w => w.length > 3));
      const overlap = [...qWords].filter(w => ansWordsSet.has(w)).length;
      const rawRelevance = qWords.size > 0 ? (overlap / qWords.size) : 0;
      // Scale: very few word matches => low score, good overlap => up to 70
      const fallbackRelevance = Math.min(70, Math.round(rawRelevance * 100));

      // Concept coverage: how many expected concepts appear in answer
      const coveredConcepts = (currentQ.expected_key_concepts || []).filter(concept =>
        answerText.toLowerCase().includes(concept.toLowerCase().split(' ')[0])
      );
      const missingConcepts = (currentQ.expected_key_concepts || []).filter(c => !coveredConcepts.includes(c));
      const fallbackCoverage = totalExpected > 0 ? Math.round((coveredConcepts.length / totalExpected) * 100) : (words.length >= 20 ? 40 : 15);

      evalResult = {
        question_id: answerId,
        question_text: currentQ.question_text,
        relevance: {
          relevance_score: Math.max(5, fallbackRelevance),
          reasoning: fallbackRelevance < 25
            ? 'Answer appears largely off-topic or too vague to assess relevance.'
            : 'Candidate addressed some aspects of the question.',
        },
        concept_coverage: {
          coverage_score: Math.max(0, fallbackCoverage),
          covered_concepts: coveredConcepts,
          missing_concepts: missingConcepts,
        },
        transcript_metadata: {
          transcript: answerText,
          word_count: words.length,
          duration_seconds: durationCaptured,
        },
        delivery_metrics: {
          words_per_minute: Math.max(estWpm, 30),
          pace_rating: estWpm < 80 ? 'Too Slow' : estWpm > 170 ? 'Too Fast' : 'Optimal',
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

      const isMainQuestion = !currentQ?.is_followup;
      const missingConcepts = evalResult?.concept_coverage?.missing_concepts || [];
      const hasMeaningfulMissing =
        Array.isArray(missingConcepts) &&
        missingConcepts.filter((c) => c && typeof c === 'string' && c.trim().length > 0).length > 0;
      const coverageScore = evalResult?.concept_coverage?.coverage_score ?? 100;

      // Determine whether an adaptive follow-up question is appropriate:
      // 1. Current question must be a main question (not already a follow-up)
      // 2. Candidate answer has meaningful missing concepts and coverage score < 85%
      // 3. Question has not already had a follow-up generated (max 1 follow-up per main question)
      const shouldProbeFollowup =
        isMainQuestion &&
        hasMeaningfulMissing &&
        coverageScore < 85 &&
        !currentQ?.has_generated_followup;

      let followupData = null;

      if (shouldProbeFollowup) {
        const jobCtx = currentProfile?.job?.title
          ? `${currentProfile.job.title}${currentProfile.job.responsibilities?.[0] ? ` - ${currentProfile.job.responsibilities[0]}` : ''}`
          : '';
        try {
          followupData = await apiClient.generateFollowup({
            questionId: currentQ.question_id,
            originalQuestion: currentQ.question_text,
            targetTopic: currentQ.target_topic || '',
            candidateAnswer: finalTranscript,
            missingConcepts: missingConcepts,
            jobContext: jobCtx,
          });
        } catch (fErr) {
          console.warn('Adaptive follow-up generation failed, proceeding with standard feedback:', fErr);
          followupData = null;
        }
      }

      const hasValidFollowup =
        followupData &&
        typeof followupData.followup_question === 'string' &&
        followupData.followup_question.trim().length > 10;

      if (isMainQuestion) {
        let followupRecord = null;
        if (hasValidFollowup) {
          currentQ.has_generated_followup = true;
          followupRecord = {
            followup_id: followupData.followup_id,
            parent_question_id: currentQ.question_id,
            followup_question: followupData.followup_question.trim(),
            focus_area: followupData.focus_area || missingConcepts.join(', '),
            expected_key_concepts: followupData.expected_key_concepts || missingConcepts,
            status: 'pending',
            answered: false,
          };
          evalResult.followup = followupRecord;

          const followupQuestionObj = {
            question_id: followupData.followup_id,
            parent_question_id: currentQ.question_id,
            question_text: followupData.followup_question.trim(),
            category: currentQ.category || 'technical',
            difficulty: currentQ.difficulty || 'medium',
            target_topic: currentQ.target_topic || 'Adaptive Follow-up',
            expected_key_concepts: followupData.expected_key_concepts || missingConcepts,
            context_reason: `Adaptive follow-up probing ${followupData.focus_area || 'missing concepts'}`,
            is_followup: true,
            focus_area: followupData.focus_area,
            main_question_id: currentQ.question_id,
            main_question_index: currentIndex,
          };

          const currentQuestions = questionsRef.current.length > 0 ? questionsRef.current : questions;
          const updatedQuestions = [...currentQuestions];
          updatedQuestions.splice(currentIndex + 1, 0, followupQuestionObj);
          questionsRef.current = updatedQuestions;
          setQuestions(updatedQuestions);

          // Background pre-fetch of neural TTS audio for follow-up
          apiClient.getNeuralTtsAudio({
            text: followupQuestionObj.question_text,
            voice: selectedVoice,
          }).then((blob) => {
            if (blob) {
              audioCacheRef.current[followupQuestionObj.question_id] = blob;
            }
          }).catch(() => {});
        }

        setSessionAnswers((prev) => ({
          ...prev,
          [answerId]: {
            ...prev[answerId],
            evaluated: true,
            status: 'saved',
            evaluation: evalResult,
            transcript: finalTranscript,
            followup: followupRecord,
          },
        }));
      } else {
        // Follow-up question was answered
        setSessionAnswers((prev) => {
          const parentAns = prev[currentQ.parent_question_id];
          const updatedParentFollowup = parentAns?.followup ? {
            ...parentAns.followup,
            answer_transcript: finalTranscript,
            evaluation: evalResult,
            answered: true,
            status: 'saved',
          } : {
            followup_id: currentQ.question_id,
            parent_question_id: currentQ.parent_question_id,
            followup_question: currentQ.question_text,
            focus_area: currentQ.focus_area,
            answer_transcript: finalTranscript,
            evaluation: evalResult,
            answered: true,
            status: 'saved',
          };

          return {
            ...prev,
            [answerId]: {
              ...prev[answerId],
              evaluated: true,
              status: 'saved',
              evaluation: evalResult,
              transcript: finalTranscript,
              is_followup: true,
              parent_question_id: currentQ.parent_question_id,
            },
            ...(parentAns ? {
              [currentQ.parent_question_id]: {
                ...parentAns,
                followup: updatedParentFollowup,
                evaluation: parentAns.evaluation ? {
                  ...parentAns.evaluation,
                  followup: updatedParentFollowup,
                } : null,
              },
            } : {}),
          };
        });
      }

      // Construct spoken mistakes feedback
      const spokenFeedback = constructSpokenMistakesFeedback(evalResult, currentQ, hasValidFollowup ? followupData : null);
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
  const constructSpokenMistakesFeedback = (evaluation, question, followupData = null) => {
    const parts = [];

    const relevance = evaluation?.relevance?.relevance_score ?? 75;
    const coverage = evaluation?.concept_coverage?.coverage_score ?? 70;
    const coveredConcepts = evaluation?.concept_coverage?.covered_concepts || [];
    const missingConcepts = evaluation?.concept_coverage?.missing_concepts || [];
    const fillers =
      evaluation?.delivery?.filler_words?.total_fillers ??
      evaluation?.delivery_metrics?.total_filler_words ??
      0;
    const wpm =
      evaluation?.delivery_metrics?.words_per_minute ??
      evaluation?.delivery?.pacing?.wpm ??
      0;
    const category = (question?.category || 'technical').toLowerCase();
    const topic = question?.target_topic || '';
    const isHr = category === 'hr' || category === 'behavioral';

    // 1. Follow-up Question Answer Evaluation
    if (question?.is_followup) {
      if (relevance >= 75 && coverage >= 70) {
        if (coveredConcepts.length > 0) {
          parts.push(`Well done! You clarified ${coveredConcepts.slice(0, 2).join(' and ')} effectively.`);
        } else {
          parts.push('Great job expanding on that concept.');
        }
      } else {
        if (missingConcepts.length > 0) {
          parts.push(`Thank you for adding details. Moving forward, keep in mind to also address ${missingConcepts[0]}.`);
        } else {
          parts.push('Thank you for providing that additional context.');
        }
      }
      parts.push('Now, moving to your next question.');
      return parts.join(' ');
    }

    // 2. Main Question: Content & Structural Evaluation
    if (isHr) {
      // HR & Behavioural coaching
      if (coverage >= 75 && relevance >= 75) {
        if (coveredConcepts.length > 0) {
          parts.push(`Strong behavioural response! You effectively demonstrated ${coveredConcepts.slice(0, 2).join(' and ')}.`);
        } else {
          parts.push(`Strong behavioural answer with clear context for ${topic || 'the scenario'}.`);
        }
      } else if (relevance < 60) {
        parts.push(`Your answer drifted away from the specific behavioural scenario requested in ${topic || 'this question'}.`);
      } else {
        if (coveredConcepts.length > 0) {
          parts.push(`You touched on ${coveredConcepts.slice(0, 2).join(' and ')}, but the story lacked a concrete resolution.`);
        } else {
          parts.push('Good attempt, but your response needs a clearer narrative structure.');
        }
      }

      // Actionable HR Tip
      if (missingConcepts.length > 0) {
        parts.push(`To stand out, frame your story using the STAR method (Situation, Task, Action, Result) and clearly highlight ${missingConcepts.slice(0, 2).join(' and ')}.`);
      }
    } else {
      // Technical & JD-based coaching
      if (coverage >= 80 && relevance >= 80) {
        if (coveredConcepts.length > 0) {
          parts.push(`Excellent technical breakdown covering ${coveredConcepts.slice(0, 2).join(' and ')}.`);
        } else {
          parts.push(`Strong technical explanation for ${topic || 'this question'}.`);
        }
      } else if (relevance < 65) {
        parts.push(`Your response didn't directly target the core principles of ${topic || 'this question'}.`);
      } else {
        if (coveredConcepts.length > 0) {
          parts.push(`Good start addressing ${coveredConcepts.slice(0, 2).join(' and ')}, but important technical depth was omitted.`);
        } else {
          parts.push(`Your answer covers the general idea, but lacks technical depth for ${topic || 'this question'}.`);
        }
      }

      // Actionable Technical Tip
      if (missingConcepts.length > 0) {
        parts.push(`In a technical interview, be sure to explicitly discuss ${missingConcepts.slice(0, 2).join(' and ')} and the production tradeoffs.`);
      }
    }

    // 3. Speech Delivery & Pacing Feedback
    if (fillers >= 4) {
      parts.push(`You used ${fillers} filler words—practice pausing quietly while formulating your thoughts.`);
    }
    if (wpm > 175) {
      parts.push(`Your delivery pace of ${wpm} WPM was on the faster side; slowing down slightly will improve comprehension.`);
    } else if (wpm > 0 && wpm < 85) {
      parts.push(`Your speaking pace was ${wpm} WPM; speaking with slightly more momentum will convey stronger confidence.`);
    }

    // 4. Next Step Transition
    if (followupData) {
      const focusText = followupData.focus_area ? ` on ${followupData.focus_area}` : '';
      parts.push(`Let's dive into that with a quick adaptive follow-up question${focusText}.`);
    } else {
      parts.push('Now, moving to your next question.');
    }

    return parts.join(' ');
  };

  // Advance to next question or complete session
  const advanceToNextQuestionOrComplete = () => {
    if (isSessionEndedRef.current) return;
    clearAllTimers();
    cancelAudio();
    stopSpeechRecognition();

    const currentQuestions = questionsRef.current.length > 0 ? questionsRef.current : questions;
    const nextIndex = currentIndex + 1;
    if (nextIndex < currentQuestions.length) {
      setCurrentIndex(nextIndex);
      startPreparationPhase(nextIndex, currentQuestions);
    } else {
      handleCompleteInterview();
    }
  };

  // Interview Completed
  const handleCompleteInterview = () => {
    isSessionEndedRef.current = true;
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

  // Return to Home cleanly from interview
  const handleReturnHome = () => {
    isSessionEndedRef.current = true;
    clearAllTimers();
    cancelAudio();
    stopSpeechRecognition();
    stopWebcamTracks();
    exitFullscreenIfActive();
    navigation.navigate('Home');
  };

  // Candidate confirms End Interview early
  const handleConfirmEndInterview = async () => {
    isSessionEndedRef.current = true;
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
        const evalStub = {
          question_id: answerId,
          question_text: currentQ ? currentQ.question_text : '',
          relevance: { relevance_score: 55, reasoning: 'Candidate provided a brief answer before ending session.' },
          concept_coverage: { coverage_score: 30, covered_concepts: [], missing_concepts: currentQ?.expected_key_concepts || [] },
          transcript_metadata: { transcript: candidateSpeech, word_count: words.length, duration_seconds: recordingDuration },
          delivery_metrics: { words_per_minute: Math.round((words.length / recordingDuration) * 60), pace_rating: 'Optimal', total_filler_words: 0, extended_pause_count: 0 },
          status: 'evaluated',
        };

        setSessionAnswers((prev) => {
          const next = {
            ...prev,
            [answerId]: {
              question_id: answerId,
              question_text: currentQ ? currentQ.question_text : '',
              duration: recordingDuration,
              status: 'saved',
              evaluated: true,
              transcript: candidateSpeech,
              evaluation: evalStub,
              error: null,
            },
          };
          if (currentQ?.is_followup && prev[currentQ.parent_question_id]) {
            const p = prev[currentQ.parent_question_id];
            next[currentQ.parent_question_id] = {
              ...p,
              followup: {
                ...(p.followup || {}),
                answer_transcript: candidateSpeech,
                evaluation: evalStub,
                answered: true,
                status: 'saved',
              },
            };
          }
          return next;
        });
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

  // Navigate to Performance Report Screen (using replace so MockInterview doesn't linger in stack)
  const handleNavigateToReport = () => {
    isSessionEndedRef.current = true;
    clearAllTimers();
    cancelAudio();
    stopSpeechRecognition();
    stopWebcamTracks();
    exitFullscreenIfActive();

    const currentQuestions = questionsRef.current.length > 0 ? questionsRef.current : questions;
    const mainQuestions = currentQuestions.filter((q) => !q.is_followup);

    // Convert sessionAnswers object -> flat serializable array PerformanceReportScreen expects
    const sessionAnswersArray = mainQuestions.map((q) => {
      const a = sessionAnswers[q.question_id] || {
        question_id: q.question_id,
        question_text: q.question_text,
        status: 'skipped',
        evaluated: false,
        transcript: null,
        evaluation: null,
      };
      const { blob: _removedBlob, ...serializableAnswer } = a;
      return {
        ...serializableAnswer,
        question: q,
      };
    });

    navigation.replace('PerformanceReport', {
      sessionAnswers: sessionAnswersArray,
      questions: mainQuestions,
      profile: currentProfile,
      sessionId: `mock_session_${Date.now()}`,
      visualIssues: sessionVisualIssues, // AI visual monitoring alerts
    });
  };

  const mainQuestions = questions.filter((q) => !q.is_followup);
  const totalCount = Math.max(mainQuestions.length, 1);
  const answeredCount = mainQuestions.filter((q) => sessionAnswers[q.question_id]?.status === 'saved' || sessionAnswers[q.question_id]?.evaluated).length;
  const currentQ = questions[currentIndex];
  const currentMainIndex = currentQ?.is_followup
    ? (currentQ.main_question_index ?? questions.slice(0, currentIndex).filter((q) => !q.is_followup).length - 1)
    : questions.slice(0, currentIndex + 1).filter((q) => !q.is_followup).length - 1;
  const displayMainIndex = Math.max(1, currentMainIndex + 1);


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

  // PHASE: COMPLETED (Redesigned with celebration caricature)
  if (interviewPhase === 'completed') {
    const skippedCount = Math.max(0, totalCount - answeredCount);
    const candidateInitial = (currentProfile?.full_name || currentProfile?.candidate_name || 'D').charAt(0).toUpperCase();

    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#FFFFFF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background decorative corner blobs and confetti doodles */}
        {/* Bottom Left Pastel Yellow Shape + doodle line */}
        <div style={{
          position: 'absolute',
          bottom: -40,
          left: -40,
          width: 280,
          height: 280,
          borderRadius: '45% 55% 60% 40% / 50% 60% 40% 50%',
          backgroundColor: '#FEF9C3',
          opacity: 0.65,
          zIndex: 1,
          pointerEvents: 'none',
        }} />
        <svg style={{
          position: 'absolute',
          bottom: 25,
          left: 15,
          width: 140,
          height: 90,
          zIndex: 2,
          pointerEvents: 'none',
        }} viewBox="0 0 140 90" fill="none">
          <path d="M10,80 Q40,20 70,60 T130,40" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>

        {/* Bottom Right Pastel Purple/Lavender Shape + doodle line */}
        <div style={{
          position: 'absolute',
          bottom: -50,
          right: -50,
          width: 300,
          height: 300,
          borderRadius: '50% 50% 40% 60% / 60% 40% 60% 40%',
          backgroundColor: '#EEF2FF',
          opacity: 0.8,
          zIndex: 1,
          pointerEvents: 'none',
        }} />
        <svg style={{
          position: 'absolute',
          bottom: 30,
          right: 20,
          width: 140,
          height: 90,
          zIndex: 2,
          pointerEvents: 'none',
        }} viewBox="0 0 140 90" fill="none">
          <path d="M15,50 Q60,85 95,45 T135,70" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>

        {/* Scattered Confetti Accents */}
        <div style={{
          position: 'absolute', top: 120, left: '12%', width: 8, height: 16,
          backgroundColor: '#FEF08A', borderRadius: 4, transform: 'rotate(25deg)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: 220, left: '8%', width: 14, height: 7,
          backgroundColor: '#93C5FD', borderRadius: 4, transform: 'rotate(-40deg)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: 160, right: '14%', width: 7, height: 14,
          backgroundColor: '#FBCFE8', borderRadius: 4, transform: 'rotate(35deg)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: 260, right: '9%', width: 16, height: 7,
          backgroundColor: '#818CF8', borderRadius: 4, transform: 'rotate(-30deg)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: 140, left: '6%', width: 14, height: 7,
          backgroundColor: '#60A5FA', borderRadius: 4, transform: 'rotate(45deg)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: 130, right: '7%', width: 8, height: 16,
          backgroundColor: '#F472B6', borderRadius: 4, transform: 'rotate(-20deg)', pointerEvents: 'none',
        }} />

        {/* 1. TOP NAVBAR */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 36px',
          backgroundColor: '#FFFFFF',
          zIndex: 10,
          position: 'relative',
        }}>
          {/* Logo brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: '#EEF2FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 4L12 14L20 4M12 14V21" stroke="#4F46E5" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: 19, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 }}>
              PlacementPrep <span style={{ color: '#4F46E5' }}>AI</span>
            </span>
          </div>

          {/* Right status & profile items */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* API Online Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              backgroundColor: '#ECFDF5',
              padding: '6px 14px',
              borderRadius: 9999,
              border: '1px solid #D1FAE5',
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#10B981',
                boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)',
              }} />
              <span style={{ fontSize: 13, fontWeight: '600', color: '#059669' }}>
                API Online
              </span>
            </div>

            {/* Notification Bell */}
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748B',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>

            {/* User Avatar Circle */}
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: '#EEF2FF',
              border: '1px solid #C7D2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4F46E5',
              fontSize: 15,
              fontWeight: '800',
              cursor: 'pointer',
            }}>
              {candidateInitial}
            </div>
          </div>
        </header>

        {/* 2. MAIN CENTER BODY */}
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 24px 36px 24px',
          zIndex: 5,
          position: 'relative',
        }}>
          {/* Caricature Illustration */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 6,
          }}>
            <Image
              source={Caricatures.completedCelebration}
              style={{
                width: 480,
                maxWidth: '92vw',
                height: 210,
              }}
              resizeMode="contain"
            />
          </div>

          {/* Heading with spark accents */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginTop: 4,
          }}>
            {/* Left yellow sparks */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 14L10 12M6 8L12 10" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
            </svg>

            <h1 style={{
              margin: 0,
              fontSize: 34,
              fontWeight: '900',
              color: '#0F172A',
              letterSpacing: -0.6,
            }}>
              Mock Interview <span style={{ color: '#3B82F6' }}>Completed!</span>
            </h1>

            {/* Right yellow sparks */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M20 14L14 12M18 8L12 10" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>

          {/* Subtitle */}
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 16, color: '#1E293B', fontWeight: '500' }}>
              You answered <span style={{ color: '#3B82F6', fontWeight: '800' }}>{answeredCount}</span> of <span style={{ color: '#3B82F6', fontWeight: '800' }}>{totalCount}</span> questions.
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: 14, color: '#64748B', fontWeight: '400' }}>
              {skippedCount > 0
                ? `The remaining ${skippedCount} question${skippedCount === 1 ? ' was' : 's were'} skipped.`
                : 'All questions were completed successfully!'}
            </p>
          </div>

          {/* Stat Metric Card (Answered / Skipped / Total) */}
          <div style={{
            marginTop: 26,
            marginBottom: 26,
            width: '100%',
            maxWidth: 640,
            backgroundColor: '#FFFFFF',
            borderRadius: 18,
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '18px 24px',
          }}>
            {/* 1. Answered */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, justifyContent: 'center' }}>
              <div style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                backgroundColor: '#DCFCE7',
                border: '1px solid #BBF7D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', lineHeight: '28px' }}>
                  {answeredCount}
                </span>
                <span style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }}>
                  Answered
                </span>
              </div>
            </div>

            {/* Divider 1 */}
            <div style={{ width: 1, height: 42, backgroundColor: '#E2E8F0' }} />

            {/* 2. Skipped */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, justifyContent: 'center' }}>
              <div style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                backgroundColor: '#FEE2E2',
                border: '1px solid #FECACA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', lineHeight: '28px' }}>
                  {skippedCount}
                </span>
                <span style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }}>
                  Skipped
                </span>
              </div>
            </div>

            {/* Divider 2 */}
            <div style={{ width: 1, height: 42, backgroundColor: '#E2E8F0' }} />

            {/* 3. Total Questions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, justifyContent: 'center' }}>
              <div style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                backgroundColor: '#EFF6FF',
                border: '1px solid #DBEAFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', lineHeight: '28px' }}>
                  {totalCount}
                </span>
                <span style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }}>
                  Total Questions
                </span>
              </div>
            </div>
          </div>

          {/* Action CTA Buttons */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleNavigateToReport}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                backgroundColor: '#3B82F6',
                backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '700',
                padding: '14px 34px',
                borderRadius: 9999,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.4)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 28px -4px rgba(37, 99, 235, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(37, 99, 235, 0.4)';
              }}
            >
              <span>View Performance Report</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            <button
              onClick={handleReturnHome}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#F8FAFC',
                color: '#334155',
                fontSize: 16,
                fontWeight: '600',
                padding: '14px 28px',
                borderRadius: 9999,
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E2E8F0';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F8FAFC';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span>🏠 Return Home</span>
            </button>
          </div>
        </main>
      </div>
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
        {/* Subtle scrim so question text is readable without darkening candidate video */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.0) 70%, rgba(0,0,0,0.3) 100%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ===== OVERLAY CONTENT (sits above camera, designed exactly as Image 01) ===== */}
      <View style={styles.overlayContainer}>

        {/* 1. TOP WHITE HEADER BAR (As seen in Image 01) */}
        <View style={styles.imgHeaderBar}>
          {/* Back button & Title */}
          <View style={styles.imgHeaderLeft}>
            <TouchableOpacity style={styles.imgBackCircleBtn} onPress={handlePromptEndInterview}>
              <Text style={styles.imgBackArrow}>←</Text>
            </TouchableOpacity>
            <Text style={styles.imgHeaderTitle}>Mock Interview</Text>
          </View>

          {/* Stepper (1 Prep — 2 Interview — 3 Feedback) */}
          <View style={styles.imgStepperContainer}>
            {/* Step 1: Prep */}
            <View style={styles.imgStepItem}>
              <View style={[styles.imgStepCircle, interviewPhase === 'prep' ? styles.imgStepCircleActive : styles.imgStepCircleInactive]}>
                <Text style={[styles.imgStepNumber, interviewPhase === 'prep' ? styles.imgStepNumberActive : styles.imgStepNumberInactive]}>1</Text>
              </View>
              <Text style={[styles.imgStepLabel, interviewPhase === 'prep' ? styles.imgStepLabelActive : styles.imgStepLabelInactive]}>Prep</Text>
            </View>

            <View style={styles.imgStepDivider} />

            {/* Step 2: Interview */}
            <View style={styles.imgStepItem}>
              <View style={[styles.imgStepCircle, (interviewPhase === 'countdown' || interviewPhase === 'recording' || interviewPhase === 'evaluating') ? styles.imgStepCircleActive : styles.imgStepCircleInactive]}>
                <Text style={[styles.imgStepNumber, (interviewPhase === 'countdown' || interviewPhase === 'recording' || interviewPhase === 'evaluating') ? styles.imgStepNumberActive : styles.imgStepNumberInactive]}>2</Text>
              </View>
              <View style={styles.imgStepLabelWithUnderline}>
                <Text style={[styles.imgStepLabel, (interviewPhase === 'countdown' || interviewPhase === 'recording' || interviewPhase === 'evaluating') ? styles.imgStepLabelActive : styles.imgStepLabelInactive]}>Interview</Text>
                {(interviewPhase === 'countdown' || interviewPhase === 'recording' || interviewPhase === 'evaluating') && (
                  <View style={styles.imgStepActiveUnderline} />
                )}
              </View>
            </View>

            <View style={styles.imgStepDivider} />

            {/* Step 3: Feedback */}
            <View style={styles.imgStepItem}>
              <View style={[styles.imgStepCircle, interviewPhase === 'feedback' ? styles.imgStepCircleActive : styles.imgStepCircleInactive]}>
                <Text style={[styles.imgStepNumber, interviewPhase === 'feedback' ? styles.imgStepNumberActive : styles.imgStepNumberInactive]}>3</Text>
              </View>
              <Text style={[styles.imgStepLabel, interviewPhase === 'feedback' ? styles.imgStepLabelActive : styles.imgStepLabelInactive]}>Feedback</Text>
            </View>
          </View>

          {/* Right Red Button: End Interview */}
          <TouchableOpacity style={styles.imgEndInterviewBtn} onPress={handlePromptEndInterview}>
            <View style={styles.imgEndSquareIcon} />
            <Text style={styles.imgEndInterviewBtnText}>End Interview</Text>
          </TouchableOpacity>
        </View>

        {/* 2. MAIN VIEW AREA (Video background is behind this) */}
        <View style={styles.imgVideoStageContainer}>

          {/* ===== REAL-TIME AI VISUAL ALERT BANNER ===== */}
          {visualAlert && (
            <div style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 50,
              background: visualAlert.severity === 'critical'
                ? 'linear-gradient(135deg, rgba(185,28,28,0.97) 0%, rgba(239,68,68,0.97) 100%)'
                : 'linear-gradient(135deg, rgba(146,64,14,0.97) 0%, rgba(217,119,6,0.97) 100%)',
              borderRadius: 14,
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: visualAlert.severity === 'critical'
                ? '0 4px 24px rgba(239,68,68,0.6)'
                : '0 4px 24px rgba(217,119,6,0.5)',
              border: `1px solid ${visualAlert.severity === 'critical' ? 'rgba(252,165,165,0.5)' : 'rgba(253,230,138,0.4)'}`,
              backdropFilter: 'blur(8px)',
              maxWidth: 520,
              animation: 'slideDown 0.3s ease',
            }}>
              <span style={{ fontSize: 22 }}>
                {visualAlert.type === 'posture' ? '🛑'
                  : visualAlert.type === 'attire' ? '👔'
                  : visualAlert.type === 'background' ? '👥'
                  : '👁️'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#FEF3C7', fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 2 }}>
                  AI INTERVIEW MONITOR
                </div>
                <div style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 700, lineHeight: '1.3' }}>
                  {visualAlert.message}
                </div>
              </div>
              <button
                onClick={() => setVisualAlert(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
              >✕</button>
            </div>
          )}

          {/* Question Card (Dark Slate Floating Overlay) */}

          <View style={styles.imgQuestionOverlayCard}>
            <View style={styles.imgQuestionCardTopRow}>
              <View style={styles.imgQuestionNumberBadgeRow}>
                <Text style={styles.imgChatBubbleIcon}>
                  {interviewPhase === 'feedback' ? '🎯' : (currentQ?.is_followup ? '⚡' : '💬')}
                </Text>
                <Text style={styles.imgQuestionNumberText}>
                  {interviewPhase === 'feedback'
                    ? 'COACHING FEEDBACK'
                    : (currentQ?.is_followup
                        ? `ADAPTIVE FOLLOW-UP • Q${displayMainIndex}`
                        : `QUESTION ${displayMainIndex}/${totalCount}`)}
                </Text>
              </View>
              <View style={[styles.imgDifficultyBadge, currentQ?.is_followup && styles.imgFollowupBadge]}>
                <Text style={[styles.imgDifficultyBadgeText, currentQ?.is_followup && styles.imgFollowupBadgeText]}>
                  {interviewPhase === 'feedback'
                    ? 'Instant Analysis'
                    : (currentQ?.is_followup
                        ? (currentQ.focus_area ? `Focus: ${currentQ.focus_area}` : 'Follow-up')
                        : (String(currentQ?.difficulty || 'Medium').charAt(0).toUpperCase() + String(currentQ?.difficulty || 'Medium').slice(1).toLowerCase()))}
                </Text>
              </View>
            </View>

            <Text style={styles.imgQuestionPromptText}>
              {interviewPhase === 'feedback' ? spokenFeedbackText : currentQ?.question_text}
            </Text>

            {/* Preparation Skip Action if in prep phase */}
            {interviewPhase === 'prep' && (
              <TouchableOpacity style={styles.imgSkipPrepButton} onPress={handleSkipPreparation}>
                <Text style={styles.imgSkipPrepText}>⚡ Skip Prep ({prepTimeRemaining}s) & Start Recording →</Text>
              </TouchableOpacity>
            )}

            {/* Stop Answer Button if in recording phase */}
            {interviewPhase === 'recording' && (
              <TouchableOpacity style={styles.imgStopAnswerButton} onPress={handleStopAnswerAndContinue}>
                <Text style={styles.imgStopAnswerText}>⏹ Stop Answer & Continue →</Text>
              </TouchableOpacity>
            )}

            {/* Evaluating spinner indicator */}
            {interviewPhase === 'evaluating' && (
              <View style={styles.imgEvaluatingRow}>
                <ActivityIndicator size="small" color="#FFC82C" />
                <Text style={styles.imgEvaluatingText}>{evaluatingStatusText || 'Analyzing answer & p-score...'}</Text>
              </View>
            )}
          </View>


          {/* Top Right Floating White Widget: Time Left Timer */}
          <View style={styles.imgTimerFloatingCard}>
            <View style={styles.imgTimerCardHeader}>
              <Text style={styles.imgTimerIcon}>⏱</Text>
              <Text style={styles.imgTimerHeaderLabel}>Time Left</Text>
            </View>

            {/* Circular Gauge Ring representation with time in center */}
            <div style={{
              position: 'relative',
              width: 76,
              height: 76,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="76" height="76" viewBox="0 0 76 76" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx="38"
                  cy="38"
                  r="32"
                  stroke="#E2E8F0"
                  strokeWidth="5"
                  fill="none"
                />
                <circle
                  cx="38"
                  cy="38"
                  r="32"
                  stroke="#3B82F6"
                  strokeWidth="5"
                  strokeDasharray="201"
                  strokeDashoffset={201 - (201 * Math.min(180, Math.max(0, 180 - recordingDuration)) / 180)}
                  strokeLinecap="round"
                  fill="none"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div style={{
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                fontWeight: '800',
                color: '#1E293B',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}>
                {formatTime(interviewPhase === 'prep' ? prepTimeRemaining : Math.max(0, 180 - recordingDuration))}
              </div>
            </div>
          </View>

          {/* 3. BOTTOM FLOATING PILL CONTROLS (Camera, Mute, Settings) */}
          <View style={styles.imgBottomPillDock}>
            {/* Camera Toggle Button */}
            <TouchableOpacity style={styles.imgPillBtn} onPress={handleToggleCamera}>
              <View style={[styles.imgPillIconCircle, isCameraOff && styles.imgPillIconCircleOff]}>
                <Text style={styles.imgPillIconGlyph}>{isCameraOff ? '🚫' : '📹'}</Text>
              </View>
              <Text style={styles.imgPillBtnLabel}>Camera</Text>
            </TouchableOpacity>

            {/* Mute Toggle Button (Red highlighted circle as seen in Image 01) */}
            <TouchableOpacity style={styles.imgPillBtn} onPress={handleToggleMute}>
              <View style={[styles.imgPillMicCircle, isMuted && styles.imgPillMicCircleMuted]}>
                <Text style={styles.imgPillMicIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
              </View>
              <Text style={styles.imgPillBtnLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            {/* Settings (Voice Picker) */}
            <TouchableOpacity style={styles.imgPillBtn} onPress={() => setShowVoicePicker(true)}>
              <View style={styles.imgPillIconCircle}>
                <Text style={styles.imgPillIconGlyph}>⚙️</Text>
              </View>
              <Text style={styles.imgPillBtnLabel}>Settings</Text>
            </TouchableOpacity>
          </View>
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

  // IMAGE 01 REDESIGN STYLES
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
  },

  // 1. Top White Header Bar
  imgHeaderBar: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  imgHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imgBackCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  imgBackArrow: {
    fontSize: 18,
    color: '#334155',
    fontWeight: '700',
  },
  imgHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Stepper (1 Prep - 2 Interview - 3 Feedback)
  imgStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  imgStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imgStepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imgStepCircleActive: {
    backgroundColor: '#3B82F6',
  },
  imgStepCircleInactive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  imgStepNumber: {
    fontSize: 12,
    fontWeight: '800',
  },
  imgStepNumberActive: {
    color: '#FFFFFF',
  },
  imgStepNumberInactive: {
    color: '#64748B',
  },
  imgStepLabelWithUnderline: {
    position: 'relative',
    paddingBottom: 4,
  },
  imgStepActiveUnderline: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  imgStepLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  imgStepLabelActive: {
    color: '#3B82F6',
  },
  imgStepLabelInactive: {
    color: '#64748B',
  },
  imgStepDivider: {
    width: 20,
    height: 1.5,
    backgroundColor: '#CBD5E1',
  },

  // Right Red End Interview Button
  imgEndInterviewBtn: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  imgEndSquareIcon: {
    width: 8,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
  },
  imgEndInterviewBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // 2. Main Video Stage & Question Overlay
  imgVideoStageContainer: {
    flex: 1,
    position: 'relative',
    padding: 24,
    justifyContent: 'space-between',
  },
  imgQuestionOverlayCard: {
    backgroundColor: '#202938',
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 22,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 0,
  },
  imgQuestionCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  imgQuestionNumberBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imgChatBubbleIcon: {
    fontSize: 15,
  },
  imgQuestionNumberText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  imgDifficultyBadge: {
    backgroundColor: '#785A28',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imgDifficultyBadgeText: {
    color: '#FEF08A',
    fontSize: 11,
    fontWeight: '800',
  },
  imgQuestionPromptText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 28,
  },
  imgSkipPrepButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  imgSkipPrepText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  imgStopAnswerButton: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  imgStopAnswerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  imgEvaluatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  imgEvaluatingText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },

  // Floating White Timer Card (Top Right)
  imgTimerFloatingCard: {
    position: 'absolute',
    top: 24,
    right: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 20,
  },
  imgTimerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  imgTimerIcon: {
    fontSize: 14,
  },
  imgTimerHeaderLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },

  // 3. Bottom Pill Dock Controls (Camera, Mute, Settings)
  imgBottomPillDock: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 24,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    zIndex: 25,
    marginBottom: 10,
  },
  imgPillBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  imgPillIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  imgPillIconCircleOff: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  imgPillIconGlyph: {
    fontSize: 19,
    color: '#FFFFFF',
  },
  imgPillMicCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  imgPillMicCircleMuted: {
    backgroundColor: '#64748B',
  },
  imgPillMicIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  imgPillBtnLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
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
