import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { USE_MOCK_COACH } from '../theme/prepGreen';

const FILLER_WORDS = ['um', 'uh', 'like', 'basically', 'you know', 'so', 'actually'];

export function usePaceCoach() {
  const [wpm, setWpm] = useState(140);
  const [fillerCount, setFillerCount] = useState(0);
  const [fillerPills, setFillerPills] = useState([]);

  // Historical data for Replay
  const fillersRef = useRef([]);
  const samplesRef = useRef([]);
  const wpmSamplesRef = useRef([]);
  const recognitionRef = useRef(null);
  const animFrameRef = useRef(0);
  const isRunningRef = useRef(false);
  const t0Ref = useRef(0);
  const nextFillerTimeRef = useRef(0);
  const lastSampleTimeRef = useRef(0);
  const lastPaceUpdateTimeRef = useRef(0);

  // Live words in sliding window: Array of { word, time }
  const wordTimestampsRef = useRef([]);
  const processedTranscriptLengthRef = useRef(0);

  const removeFillerPill = useCallback((id) => {
    setFillerPills((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const spawnFillerPill = useCallback((word, t) => {
    fillersRef.current.push({ t, w: word });
    setFillerCount(fillersRef.current.length);

    const leftPercent = 6 + Math.random() * 70;
    const newPill = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      word,
      leftPercent,
    };
    setFillerPills((prev) => [...prev, newPill]);
  }, []);

  // Metering sample collector
  const addLevelSample = useCallback((lvl) => {
    const now = Date.now();
    if (now - lastSampleTimeRef.current >= 250) {
      lastSampleTimeRef.current = now;
      samplesRef.current.push(Math.max(0.05, Math.min(1, lvl)));
    }
  }, []);

  const startCoach = useCallback(() => {
    isRunningRef.current = true;
    t0Ref.current = Date.now();
    lastSampleTimeRef.current = 0;
    lastPaceUpdateTimeRef.current = 0;
    nextFillerTimeRef.current = t0Ref.current + 2200 + Math.random() * 3500;
    fillersRef.current = [];
    samplesRef.current = [];
    wpmSamplesRef.current = [];
    wordTimestampsRef.current = [];
    processedTranscriptLengthRef.current = 0;

    setWpm(140);
    setFillerCount(0);
    setFillerPills([]);

    let recognitionStarted = false;

    // Check if Web Speech API is supported and not forced to mock
    if (
      !USE_MOCK_COACH &&
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
    ) {
      try {
        const SpeechRecognitionClass =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        const recog = new SpeechRecognitionClass();
        recog.continuous = true;
        recog.interimResults = true;
        recog.lang = 'en-US';

        recog.onresult = (event) => {
          if (!isRunningRef.current) return;
          const now = Date.now();
          const t = now - t0Ref.current;

          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + ' ';
          }
          fullTranscript = fullTranscript.trim().toLowerCase();

          // New words check
          const words = fullTranscript.split(/\s+/).filter(Boolean);

          // Update sliding window word timestamps
          const newWordsCount = words.length - wordTimestampsRef.current.length;
          if (newWordsCount > 0) {
            for (let i = 0; i < newWordsCount; i++) {
              wordTimestampsRef.current.push({
                word: words[wordTimestampsRef.current.length],
                time: now,
              });
            }
          }

          // Sliding 8s window WPM calculation
          const recentWords = wordTimestampsRef.current.filter(
            (w) => now - w.time <= 8000
          );
          const elapsedSecInWindow = Math.min(8, Math.max(1, (now - t0Ref.current) / 1000));
          const calculatedWpm = Math.round(
            (recentWords.length / (elapsedSecInWindow / 60))
          );
          const clampedWpm = Math.max(80, Math.min(220, calculatedWpm || 140));

          if (now - lastPaceUpdateTimeRef.current >= 400) {
            lastPaceUpdateTimeRef.current = now;
            setWpm(clampedWpm);
            wpmSamplesRef.current.push(clampedWpm);
          }

          // Filler detection in newly added transcript segments
          if (fullTranscript.length > processedTranscriptLengthRef.current) {
            const addedChunk = fullTranscript.substring(
              processedTranscriptLengthRef.current
            );
            processedTranscriptLengthRef.current = fullTranscript.length;

            const chunkTokens = addedChunk.split(/\s+/).filter(Boolean);
            for (let idx = 0; idx < chunkTokens.length; idx++) {
              const tok = chunkTokens[idx].replace(/[^a-z]/g, '');
              const nextTok =
                idx + 1 < chunkTokens.length
                  ? chunkTokens[idx + 1].replace(/[^a-z]/g, '')
                  : '';
              const prevTok =
                idx > 0 ? chunkTokens[idx - 1].replace(/[^a-z]/g, '') : '';

              // Check 2-word filler: "you know"
              if (tok === 'you' && nextTok === 'know') {
                spawnFillerPill('you know', t);
                idx++;
                continue;
              }

              // Check single-word fillers: [um, uh, like, basically, so, actually]
              if (tok === 'like') {
                if (prevTok !== 'i') {
                  spawnFillerPill('like', t);
                }
              } else if (tok === 'so') {
                if (nextTok !== 'that') {
                  spawnFillerPill('so', t);
                }
              } else if (['um', 'uh', 'basically', 'actually'].includes(tok)) {
                spawnFillerPill(tok, t);
              }
            }
          }
        };

        recog.onerror = () => {
          // Gracefully continue with simulated/metering estimation
        };

        recog.start();
        recognitionRef.current = recog;
        recognitionStarted = true;
      } catch {
        recognitionStarted = false;
      }
    }

    // Simulation / Metering loop (Runs in parallel or as fallback)
    const runSimulationLoop = () => {
      if (!isRunningRef.current) return;
      const now = Date.now();
      const t = now - t0Ref.current;

      // If Web Speech is NOT running, simulate pace and fillers
      if (!recognitionStarted || USE_MOCK_COACH) {
        const simulatedWpm = Math.round(
          142 +
            34 * Math.sin(t / 2800) +
            12 * Math.sin(t / 700) +
            (Math.random() - 0.5) * 6
        );

        if (now - lastPaceUpdateTimeRef.current >= 400) {
          lastPaceUpdateTimeRef.current = now;
          setWpm(simulatedWpm);
          wpmSamplesRef.current.push(simulatedWpm);
        }

        // Spawn periodic simulated filler word
        if (now >= nextFillerTimeRef.current) {
          const randomFiller =
            FILLER_WORDS[Math.floor(Math.random() * FILLER_WORDS.length)];
          spawnFillerPill(randomFiller, t);
          nextFillerTimeRef.current = now + 2200 + Math.random() * 3500;
        }
      }

      animFrameRef.current = requestAnimationFrame(runSimulationLoop);
    };

    animFrameRef.current = requestAnimationFrame(runSimulationLoop);
  }, [spawnFillerPill]);

  const stopCoach = useCallback(() => {
    isRunningRef.current = false;
    cancelAnimationFrame(animFrameRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    const totalMs = Date.now() - t0Ref.current;
    const avgWpm =
      wpmSamplesRef.current.length > 0
        ? Math.round(
            wpmSamplesRef.current.reduce((a, b) => a + b, 0) /
              wpmSamplesRef.current.length
          )
        : 140;

    return {
      fillers: [...fillersRef.current],
      samples: [...samplesRef.current],
      totalMs,
      avgWpm,
      fillerCount: fillersRef.current.length,
    };
  }, []);

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      cancelAnimationFrame(animFrameRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  return {
    wpm,
    fillerCount,
    fillerPills,
    removeFillerPill,
    addLevelSample,
    startCoach,
    stopCoach,
  };
}
