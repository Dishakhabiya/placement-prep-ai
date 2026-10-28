import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { COLORS, FONTS } from '../../theme/prepHome';
import { MicIcon } from './Icons';
import { apiClient } from '../../api/client';

export default function VoiceButton({
  onTranscriptionSuccess,
  onError,
  isProcessing = false,
  setIsProcessing,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const haloScale = useRef(new Animated.Value(1)).current;
  const haloOpacity = useRef(new Animated.Value(0.55)).current;

  // Web MediaRecorder references
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Native expo-av reference
  const nativeRecordingRef = useRef(null);

  // Halo pulse animation
  useEffect(() => {
    let isCancelled = false;
    let haloLoop = null;

    const startHalo = (reduceMotion) => {
      if (reduceMotion || isCancelled) return;

      const useNative = Platform.OS !== 'web';

      haloLoop = Animated.loop(
        Animated.parallel([
          Animated.timing(haloScale, {
            toValue: 1.6,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: useNative,
          }),
          Animated.timing(haloOpacity, {
            toValue: 0,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: useNative,
          }),
        ])
      );
      haloLoop.start();
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (!isCancelled) startHalo(enabled);
        })
        .catch(() => {
          if (!isCancelled) startHalo(false);
        });
    } else {
      startHalo(false);
    }

    return () => {
      isCancelled = true;
      if (haloLoop) haloLoop.stop();
    };
  }, [haloOpacity, haloScale]);

  // Start recording
  const startRecording = async () => {
    if (onError) onError(null);

    if (Platform.OS === 'web') {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Microphone audio is not supported on this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];

        // Check supported mime type
        let mimeType = 'audio/webm';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        }

        const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          await handleSendAudio(audioBlob);
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        const msg =
          err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? 'Microphone permission was denied. Please allow microphone access in your browser.'
            : `Microphone error: ${err.message}`;
        if (onError) onError(msg);
      }
    } else {
      // Native iOS / Android with expo-av
      try {
        const { Audio } = require('expo-av');
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          if (onError) onError('Microphone permission denied. Please allow access in settings.');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recording.startAsync();
        nativeRecordingRef.current = recording;
        setIsRecording(true);
      } catch (err) {
        if (onError) onError(`Recording failed to start: ${err.message}`);
      }
    }
  };

  // Stop recording
  const stopRecording = async () => {
    setIsRecording(false);
    if (setIsProcessing) setIsProcessing(true);

    if (Platform.OS === 'web') {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } else {
      try {
        const recording = nativeRecordingRef.current;
        if (recording) {
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          nativeRecordingRef.current = null;
          await handleSendAudio({ uri, mimeType: 'audio/wav', name: 'voice_input.wav' });
        }
      } catch (err) {
        if (setIsProcessing) setIsProcessing(false);
        if (onError) onError(`Failed to save recording: ${err.message}`);
      }
    }
  };

  // Send audio to existing FastAPI transcribe endpoint
  const handleSendAudio = async (audioFile) => {
    try {
      const response = await apiClient.transcribeAudioAnswer({
        audioFile,
        questionId: 'prepai_voice_home',
        questionText: 'What shall we practise today?',
        expectedKeyConcepts: [],
      });

      const transcript =
        response?.transcript_metadata?.transcript ||
        response?.transcript ||
        '';

      if (setIsProcessing) setIsProcessing(false);

      if (transcript && transcript.trim()) {
        onTranscriptionSuccess(transcript.trim());
      } else {
        if (onError) onError("Couldn't catch that. Please tap the mic and speak clearly.");
      }
    } catch (err) {
      if (setIsProcessing) setIsProcessing(false);
      if (onError) onError(`Voice transcription error: ${err.message}`);
    }
  };

  const handlePress = () => {
    if (isProcessing) return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <View style={styles.container}>
      {/* Halo pulse behind button */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            transform: [{ scale: haloScale }],
            opacity: haloOpacity,
          },
        ]}
      />

      {/* Main Mic Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={
          isRecording
            ? 'Stop recording'
            : isProcessing
            ? 'Transcribing audio'
            : 'Speak your question'
        }
        style={[
          styles.button,
          isRecording && styles.buttonRecording,
        ]}
      >
        {isProcessing ? (
          <ActivityIndicator color={COLORS.ink} size="small" />
        ) : isRecording ? (
          <Text style={styles.listeningText}>Listening…</Text>
        ) : (
          <MicIcon size={32} color={COLORS.ink} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  halo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.orange,
  },
  button: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
      },
    }),
  },
  buttonRecording: {
    backgroundColor: '#FF6420',
  },
  listeningText: {
    fontFamily: FONTS.dmSans.bold,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.2,
  },
});
