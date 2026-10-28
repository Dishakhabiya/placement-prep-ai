import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import { FONTS } from '../../theme/prepGreen';
import { PlayTriangleIcon } from './Icons';

export default function ReplayWithHighlights({
  samples = [],
  fillers = [],
  totalMs = 4000,
  avgWpm = 140,
  audioSource = null, // Blob (web) or { uri } (native)
  colors,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0); // 0 to 1
  const [activeTip, setActiveTip] = useState(
    'Tap a marked bar to see the tip for that moment.'
  );

  const audioRef = useRef(null);
  const soundRef = useRef(null);
  const animFrameRef = useRef(0);
  const playStartRef = useRef(0);
  const realDurationRef = useRef(Math.max(totalMs, 3000));

  const N = 36;
  const duration = Math.max(totalMs || 3000, 3000);
  realDurationRef.current = duration;

  // Format time mm:ss
  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // Build the 36 bars
  const effectiveSamples =
    samples.length > 0 ? samples : [0.5, 0.6, 0.4, 0.7, 0.3, 0.8, 0.5, 0.4];
  const sampleCount = effectiveSamples.length;

  const fillerMap = {};
  fillers.forEach((f) => {
    const barIdx = Math.min(N - 1, Math.floor((f.t / duration) * N));
    fillerMap[barIdx] = f;
  });

  const bars = [];
  for (let b = 0; b < N; b++) {
    const sampleIdx = Math.min(
      sampleCount - 1,
      Math.floor((b * sampleCount) / N)
    );
    const lv = effectiveSamples[sampleIdx] ?? 0.5;
    const height = 8 + lv * 54;
    const at = fmt(Math.round((b / N) * (duration / 1000)) * 1000);

    let type = 'normal'; // 'normal' | 'low' | 'filler'
    let tip = null;

    if (fillerMap[b]) {
      type = 'filler';
      tip = `Filler word "${fillerMap[b].w}" at ${at}. Try a silent pause instead.`;
    } else if (lv < 0.2) {
      type = 'low';
      tip = `Long pause at ${at}. A short breath is fine, keep it under two seconds.`;
    }

    bars.push({
      index: b,
      height,
      type,
      tip,
      timeText: at,
    });
  }

  // Handle Playback
  const handlePlay = async () => {
    if (isPlaying) return;

    setIsPlaying(true);
    setPlayProgress(0);
    playStartRef.current = Date.now();

    const playbackDuration =
      Platform.OS === 'web' && !audioSource
        ? Math.min(6000, Math.max(3000, totalMs))
        : Math.max(2000, totalMs);

    // Audio Playback
    let soundObj = null;
    let webAudio = null;

    try {
      if (Platform.OS === 'web' && audioSource) {
        let url = '';
        if (typeof audioSource === 'string') {
          url = audioSource;
        } else if (audioSource instanceof Blob) {
          url = URL.createObjectURL(audioSource);
        }
        if (url) {
          webAudio = new window.Audio(url);
          audioRef.current = webAudio;
          webAudio.play().catch(() => {});
        }
      } else if (Platform.OS !== 'web' && audioSource?.uri) {
        const { Audio } = require('expo-av');
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioSource.uri },
          { shouldPlay: true }
        );
        soundRef.current = sound;
        soundObj = sound;
      }
    } catch {}

    // Sweeping Playhead Animation Loop
    const tick = () => {
      const elapsed = Date.now() - playStartRef.current;
      const k = Math.min(1, elapsed / playbackDuration);
      setPlayProgress(k);

      if (k < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          setIsPlaying(false);
          setPlayProgress(0);
          if (webAudio) {
            webAudio.pause();
          }
          if (soundObj) {
            soundObj.unloadAsync().catch(() => {});
          }
        }, 500);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const fillerCount = fillers.length;
  const fillerText =
    fillerCount === 1 ? '1 filler word' : `${fillerCount} filler words`;

  return (
    <View style={[styles.card, { backgroundColor: colors.soft }]}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>
          Replay with highlights
        </Text>
        <TouchableOpacity
          onPress={handlePlay}
          disabled={isPlaying}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Replay your answer"
          style={[styles.playBtn, { backgroundColor: colors.ink }]}
        >
          <PlayTriangleIcon size={14} color={colors.card} />
        </TouchableOpacity>
      </View>

      {/* 36 Waveform Bars */}
      <View style={styles.waveformContainer}>
        {bars.map((bar, i) => {
          const isPassed = !isPlaying || i <= playProgress * N;
          const barOpacity = isPassed ? 1 : 0.3;

          let barColor = colors.good;
          if (bar.type === 'low') barColor = colors.tomato;
          if (bar.type === 'filler') barColor = colors.ink;

          const isClickable = bar.type !== 'normal';

          const content = (
            <View
              key={`bar-${i}`}
              style={[
                styles.barWrapper,
                {
                  height: 68,
                  opacity: barOpacity,
                },
              ]}
            >
              {/* Dot above filler bar */}
              {bar.type === 'filler' && (
                <View
                  style={[
                    styles.fillerDot,
                    {
                      backgroundColor: colors.ink,
                      bottom: bar.height + 9,
                    },
                  ]}
                  aria-hidden={true}
                />
              )}

              {/* Bar line */}
              <View
                style={[
                  styles.barLine,
                  {
                    height: bar.height,
                    backgroundColor: barColor,
                  },
                ]}
              />
            </View>
          );

          if (isClickable) {
            return (
              <TouchableOpacity
                key={`btn-bar-${i}`}
                activeOpacity={0.7}
                onPress={() => bar.tip && setActiveTip(bar.tip)}
                accessibilityRole="button"
                accessibilityLabel={bar.tip || `Audio bar at ${bar.timeText}`}
                style={styles.touchableBar}
              >
                {content}
              </TouchableOpacity>
            );
          }

          return content;
        })}

        {/* 2px Sweeping Playhead */}
        {isPlaying && (
          <View
            pointerEvents="none"
            style={[
              styles.playhead,
              {
                backgroundColor: colors.ink,
                left: `${playProgress * 100}%`,
              },
            ]}
          />
        )}
      </View>

      {/* Legend */}
      <Text style={[styles.legendText, { color: colors.mute }]}>
        Green is strong delivery, red is a long pause, dark is a filler word.
      </Text>

      {/* Details & Tip */}
      <Text style={[styles.detailsText, { color: colors.ink }]}>
        {fillerText}, about {Math.round(avgWpm)} words a minute.
      </Text>
      <Text style={[styles.tipText, { color: colors.mute }]}>{activeTip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  waveformContainer: {
    position: 'relative',
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    marginBottom: 8,
  },
  touchableBar: {
    flex: 1,
    height: 68,
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  barWrapper: {
    flex: 1,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  barLine: {
    width: '100%',
    minWidth: 3,
    borderRadius: 2,
  },
  fillerDot: {
    position: 'absolute',
    left: '50%',
    marginLeft: -3.5,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  playhead: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 2,
    zIndex: 5,
  },
  legendText: {
    fontFamily: FONTS.outfit.medium,
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 6,
  },
  detailsText: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  tipText: {
    fontFamily: FONTS.outfit.medium,
    fontSize: 14,
    lineHeight: 18,
    marginTop: 6,
    fontWeight: '500',
  },
});
