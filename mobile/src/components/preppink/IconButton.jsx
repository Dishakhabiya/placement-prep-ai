import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { COLORS } from '../../theme/prepPink';
import HardShadow from './HardShadow';
import { HistoryIcon, MicIcon, ArrowUpIcon } from './Icons';
import { apiClient } from '../../api/client';

export function HeaderHistoryButton({ onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Chat history"
      style={styles.historyBtn}
    >
      <HistoryIcon size={20} color={COLORS.ink} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

export function MicVoiceButton({
  onTranscriptionSuccess,
  onError,
  isRecording,
  setIsRecording,
  isProcessing,
  setIsProcessing,
}) {
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.55)).current;

  // Web MediaRecorder
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Native expo-av
  const nativeRecordingRef = useRef(null);

  // Pulse ring animation
  useEffect(() => {
    let isCancelled = false;
    let ringAnim = null;

    const startRing = (reduceMotion) => {
      if (reduceMotion || isCancelled) return;

      const useNative = Platform.OS !== 'web';

      ringAnim = Animated.loop(
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.7,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: useNative,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: useNative,
          }),
        ])
      );
      ringAnim.start();
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (!isCancelled) startRing(enabled);
        })
        .catch(() => {
          if (!isCancelled) startRing(false);
        });
    } else {
      startRing(false);
    }

    return () => {
      isCancelled = true;
      if (ringAnim) ringAnim.stop();
    };
  }, [ringOpacity, ringScale]);

  const startRecording = async () => {
    if (onError) onError(null);

    if (Platform.OS === 'web') {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Microphone not supported on this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];

        let mimeType = 'audio/webm';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        }

        const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          await handleSendAudio(blob);
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        const msg =
          err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? 'Microphone permission denied. Please allow microphone access.'
            : `Microphone error: ${err.message}`;
        if (onError) onError(msg);
      }
    } else {
      try {
        const { Audio } = require('expo-av');
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          if (onError) onError('Microphone permission denied.');
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
        if (onError) onError(`Recording error: ${err.message}`);
      }
    }
  };

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
        if (onError) onError(`Audio save error: ${err.message}`);
      }
    }
  };

  const handleSendAudio = async (audioFile) => {
    try {
      const response = await apiClient.transcribeAudioAnswer({
        audioFile,
        questionId: 'prepai_pink_voice',
        questionText: 'Tell me about yourself?',
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
        if (onError) onError("Couldn't hear audio clearly. Tap the mic and try again.");
      }
    } catch (err) {
      if (setIsProcessing) setIsProcessing(false);
      if (onError) onError(`Transcription failed: ${err.message}`);
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

  const btnBg = isRecording ? COLORS.rose : COLORS.violet;

  return (
    <View style={styles.micWrapper}>
      {/* Absolute pulsing ring */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.micPulseRing,
          {
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          },
        ]}
      />

      <HardShadow offset={{ x: 3, y: 3 }} borderRadius={26} shadowColor={COLORS.ink}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={
            isRecording
              ? 'Stop recording'
              : isProcessing
              ? 'Processing speech'
              : 'Speak your question'
          }
          style={[styles.roundBtn52, { backgroundColor: btnBg }]}
        >
          {isProcessing ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <MicIcon size={24} color={COLORS.white} strokeWidth={2.5} />
          )}
        </TouchableOpacity>
      </HardShadow>
    </View>
  );
}

export function SendButton({ onPress, disabled = false }) {
  return (
    <HardShadow offset={{ x: 3, y: 3 }} borderRadius={26} shadowColor={COLORS.ink}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Send"
        style={[
          styles.roundBtn52,
          { backgroundColor: COLORS.rose },
          disabled && styles.btnDisabled,
        ]}
      >
        <ArrowUpIcon size={22} color={COLORS.white} strokeWidth={2.5} />
      </TouchableOpacity>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  historyBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  micWrapper: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  micPulseRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.micRing,
  },
  roundBtn52: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  btnDisabled: {
    opacity: 0.5,
    ...Platform.select({
      web: { cursor: 'default' },
    }),
  },
});
