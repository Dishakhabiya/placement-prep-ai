import { useState, useRef, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

export function usePrepRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [timerText, setTimerText] = useState('0:00');
  const [voiceLevel, setVoiceLevel] = useState(0); // 0 to 1
  const [barHeights, setBarHeights] = useState(() => Array.from({ length: 28 }, () => 6));
  const [permissionError, setPermissionError] = useState(null);

  // References
  const t0Ref = useRef(0);
  const rafRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const nativeRecordingRef = useRef(null);

  const formatTimer = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // Web metering loop
  const runMeteringLoop = useCallback(() => {
    const t = Date.now() - t0Ref.current;
    setTimerText(formatTimer(t));

    let lvl = 0.2;
    if (analyserRef.current) {
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
      }
      const avg = sum / (data.length * 255);
      lvl = Math.max(0.08, Math.min(1, avg * 3.5));
    } else {
      // Smooth simulated fallback
      lvl = Math.max(
        0.08,
        Math.min(
          1,
          0.35 + 0.4 * Math.sin(t / 260) + 0.25 * Math.sin(t / 97) + (Math.random() - 0.5) * 0.2
        )
      );
    }

    setVoiceLevel(lvl);

    const nextBars = [];
    for (let i = 0; i < 28; i++) {
      const k = 0.5 + 0.5 * Math.sin(t / 180 + i * 0.6);
      nextBars.push(6 + 44 * lvl * k);
    }
    setBarHeights(nextBars);

    rafRef.current = requestAnimationFrame(runMeteringLoop);
  }, []);

  const start = async () => {
    setPermissionError(null);
    t0Ref.current = Date.now();

    if (Platform.OS === 'web') {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Microphone not supported on this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        audioChunksRef.current = [];

        // Setup real web audio analyser for metering
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            const src = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            src.connect(analyser);
            audioCtxRef.current = ctx;
            analyserRef.current = analyser;
          }
        } catch {}

        let mimeType = 'audio/webm';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        }

        const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = mr;

        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mr.start(100);
        setIsRecording(true);
        rafRef.current = requestAnimationFrame(runMeteringLoop);
      } catch (err) {
        setPermissionError('Microphone access is off. Enable it in settings to answer out loud.');
        setIsRecording(false);
      }
    } else {
      // Native expo-av
      try {
        const { Audio } = require('expo-av');
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          setPermissionError('Microphone access is off. Enable it in settings to answer out loud.');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        });

        recording.setOnRecordingStatusUpdate((status) => {
          if (status.isRecording) {
            const t = status.durationMillis;
            setTimerText(formatTimer(t));
            let lvl = 0.2;
            if (status.metering != null) {
              // Convert dB (-160 to 0) to 0..1
              const db = Math.max(-60, status.metering);
              lvl = (db + 60) / 60;
            }
            setVoiceLevel(lvl);
            const nextBars = [];
            for (let i = 0; i < 28; i++) {
              const k = 0.5 + 0.5 * Math.sin(t / 180 + i * 0.6);
              nextBars.push(6 + 44 * lvl * k);
            }
            setBarHeights(nextBars);
          }
        });

        await recording.startAsync();
        nativeRecordingRef.current = recording;
        setIsRecording(true);
      } catch (err) {
        setPermissionError(`Microphone error: ${err.message}`);
        setIsRecording(false);
      }
    }
  };

  const stop = () => {
    return new Promise(async (resolve) => {
      cancelAnimationFrame(rafRef.current);
      setIsRecording(false);
      setVoiceLevel(0);
      setBarHeights(Array.from({ length: 28 }, () => 6));

      if (Platform.OS === 'web') {
        const mr = mediaRecorderRef.current;
        if (mr && mr.state !== 'inactive') {
          mr.onstop = () => {
            if (audioStreamRef.current) {
              audioStreamRef.current.getTracks().forEach((t) => t.stop());
            }
            if (audioCtxRef.current) {
              audioCtxRef.current.close().catch(() => {});
            }
            const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
            resolve(blob);
          };
          mr.stop();
        } else {
          resolve(null);
        }
      } else {
        const rec = nativeRecordingRef.current;
        if (rec) {
          try {
            await rec.stopAndUnloadAsync();
            const uri = rec.getURI();
            nativeRecordingRef.current = null;
            resolve({ uri, mimeType: 'audio/wav', name: 'answer.wav' });
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      }
    });
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    isRecording,
    timerText,
    voiceLevel,
    barHeights,
    permissionError,
    start,
    stop,
    clearError: () => setPermissionError(null),
  };
}
