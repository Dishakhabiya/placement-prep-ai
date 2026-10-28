import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import { FONTS, RADII } from '../../theme/prepGreen';
import {
  SurpriseBtn,
  MicAnswerBtn,
  SkipBtn,
  StopAnswerBtn,
  NextQuestionBtn,
  ShareResultBtn,
} from './IconButton';
import Waveform from './Waveform';
import ScoreRing from './ScoreRing';
import PaceCoach, { FillerPill } from './PaceCoach';
import ReplayWithHighlights from './ReplayWithHighlights';
import RadarBreakdown from './RadarBreakdown';

function HoppingDot({ delay = 0, color }) {
  const hopAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isCancelled = false;
    let loop = null;

    const startHop = (reduceMotion) => {
      if (reduceMotion || isCancelled) return;

      const useNative = Platform.OS !== 'web';
      loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(hopAnim, {
            toValue: -9,
            duration: 440,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: useNative,
          }),
          Animated.timing(hopAnim, {
            toValue: 0,
            duration: 440,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: useNative,
          }),
          Animated.delay(220),
        ])
      );
      loop.start();
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (!isCancelled) startHop(enabled);
        })
        .catch(() => {
          if (!isCancelled) startHop(false);
        });
    } else {
      startHop(false);
    }

    return () => {
      isCancelled = true;
      if (loop) loop.stop();
    };
  }, [delay, hopAnim]);

  return (
    <Animated.View
      style={[
        styles.hopDot,
        {
          backgroundColor: color,
          transform: [{ translateY: hopAnim }],
        },
      ]}
    />
  );
}

export default function QuestionCard({
  state, // 'idle' | 'rec' | 'think' | 'result'
  questionLabel, // 'Q1' | 'Q2' | 'Q3' | 'Q' | 'You'
  questionText,
  timerText,
  barHeights,
  score,
  verdict,
  feedback1,
  feedback2,
  onStartRec,
  onStopRec,
  onRollSurprise,
  onSkip,
  onNextQuestion,
  onSharePress,
  isRolling = false,
  isWeb = false,
  // Feature 1: Coach
  wpm = 140,
  fillerCount = 0,
  fillerPills = [],
  onRemoveFillerPill,
  // Feature 2: Replay
  samples = [],
  fillers = [],
  totalMs = 4000,
  avgWpm = 140,
  audioSource = null,
  // Feature 3: Radar
  rubricScores = {
    clarity: 80,
    structure: 75,
    confidence: 82,
    relevance: 85,
  },
  colors,
}) {
  const dotBlinkAnim = useRef(new Animated.Value(1)).current;
  const qSlideAnim = useRef(new Animated.Value(0)).current;
  const qOpacityAnim = useRef(new Animated.Value(1)).current;
  const qScaleAnim = useRef(new Animated.Value(1)).current;
  const [displayedQuestion, setDisplayedQuestion] = useState(questionText);
  const [displayedLabel, setDisplayedLabel] = useState(questionLabel);

  // Blinking 8px dot in tag pill during recording
  useEffect(() => {
    let isCancelled = false;
    let blinkLoop = null;

    if (state === 'rec') {
      const useNative = Platform.OS !== 'web';
      blinkLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(dotBlinkAnim, {
            toValue: 0.2,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: useNative,
          }),
          Animated.timing(dotBlinkAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: useNative,
          }),
        ])
      );
      blinkLoop.start();
    } else {
      dotBlinkAnim.setValue(1);
    }

    return () => {
      isCancelled = true;
      if (blinkLoop) blinkLoop.stop();
    };
  }, [state, dotBlinkAnim]);

  // Question change slide animation
  useEffect(() => {
    if (questionText === displayedQuestion && questionLabel === displayedLabel)
      return;

    const useNative = Platform.OS !== 'web';
    // Slide out
    Animated.parallel([
      Animated.timing(qSlideAnim, {
        toValue: -36,
        duration: 170,
        easing: Easing.in(Easing.ease),
        useNativeDriver: useNative,
      }),
      Animated.timing(qOpacityAnim, {
        toValue: 0,
        duration: 170,
        useNativeDriver: useNative,
      }),
    ]).start(() => {
      setDisplayedQuestion(questionText);
      setDisplayedLabel(questionLabel);
      qSlideAnim.setValue(36);

      // Slide in
      Animated.parallel([
        Animated.timing(qSlideAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.ease),
          useNativeDriver: useNative,
        }),
        Animated.timing(qOpacityAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: useNative,
        }),
      ]).start();
    });
  }, [
    questionText,
    questionLabel,
    displayedQuestion,
    displayedLabel,
    qSlideAnim,
    qOpacityAnim,
  ]);

  // Tag title mapping
  const tagTitle =
    state === 'rec'
      ? 'Recording'
      : state === 'think'
      ? 'Thinking'
      : state === 'result'
      ? 'Done'
      : 'Up next';

  return (
    <View
      style={[
        styles.card,
        isWeb && styles.cardWeb,
        { backgroundColor: colors.card },
      ]}
      accessibilityRole="region"
      accessibilityLabel="Current question card"
    >
      {/* Status Row */}
      <View style={styles.statusRow}>
        <View style={[styles.chip, { backgroundColor: colors.tomato }]}>
          {state === 'rec' && (
            <Animated.View
              style={[
                styles.blinkingDot,
                {
                  backgroundColor: colors.tomatoInk,
                  opacity: dotBlinkAnim,
                },
              ]}
              aria-hidden={true}
            />
          )}
          <Text style={[styles.chipText, { color: colors.tomatoInk }]}>
            {tagTitle}
          </Text>
        </View>

        <Text style={[styles.qNum, { color: colors.mute }]}>
          {displayedLabel}
        </Text>

        {state === 'rec' && (
          <Text style={[styles.timer, { color: colors.mute }]}>
            {timerText}
          </Text>
        )}
      </View>

      {/* Question Text Window */}
      <View style={styles.qWindow}>
        <Animated.View
          style={{
            opacity: isRolling ? 0.6 : qOpacityAnim,
            transform: [
              { translateX: qSlideAnim },
              { scale: qScaleAnim },
            ],
          }}
        >
          <Text
            style={[
              styles.qText,
              isWeb && styles.qTextWeb,
              { color: colors.ink },
            ]}
            numberOfLines={isWeb ? 3 : 2}
          >
            {displayedQuestion}
          </Text>
        </Animated.View>
      </View>

      {/* Panels (Exactly one visible at a time) */}
      <View style={styles.panelContainer}>
        {/* 1. IDLE PANEL */}
        {state === 'idle' && (
          <View
            style={[
              styles.idlePanel,
              isWeb && styles.idlePanelWeb,
            ]}
          >
            <SurpriseBtn
              onPress={onRollSurprise}
              colors={colors}
              isRolling={isRolling}
            />
            <MicAnswerBtn
              onPress={onStartRec}
              colors={colors}
            />
            <SkipBtn
              onPress={onSkip}
              colors={colors}
            />
          </View>
        )}

        {/* 2. RECORDING PANEL (with Feature 1: PaceCoach & floating filler tags) */}
        {state === 'rec' && (
          <View style={styles.recPanel}>
            {/* Floating Filler Tags */}
            {fillerPills.map((pill) => (
              <FillerPill
                key={pill.id}
                word={pill.word}
                leftPercent={pill.leftPercent}
                onFinished={() =>
                  onRemoveFillerPill && onRemoveFillerPill(pill.id)
                }
                colors={colors}
              />
            ))}

            <Waveform barHeights={barHeights} color={colors.tomato} />

            {/* Feature 1: Live Pace and Filler Word Coach */}
            <PaceCoach
              wpm={wpm}
              fillerCount={fillerCount}
              colors={colors}
            />

            <StopAnswerBtn onPress={onStopRec} colors={colors} />
          </View>
        )}

        {/* 3. THINKING PANEL */}
        {state === 'think' && (
          <View style={styles.thinkPanel}>
            <View style={styles.hopRow}>
              <HoppingDot delay={0} color={colors.tomato} />
              <HoppingDot delay={150} color={colors.tomato} />
              <HoppingDot delay={300} color={colors.tomato} />
            </View>
            <Text style={[styles.thinkText, { color: colors.mute }]}>
              Reviewing your answer…
            </Text>
          </View>
        )}

        {/* 4. RESULT PANEL (with ScoreRing, Extras Grid: Replay + Radar, Action Buttons) */}
        {state === 'result' && (
          <View style={styles.resultPanel}>
            {/* Top Score & Verdict Row */}
            <View style={styles.resTopRow}>
              <ScoreRing score={score} colors={colors} />
              <View style={styles.verdictCol}>
                <Text style={[styles.verdictText, { color: colors.ink }]}>
                  {verdict}
                </Text>
                <Text style={[styles.feedbackText, { color: colors.mute }]}>
                  {feedback1}
                </Text>
                <Text style={[styles.feedbackText, { color: colors.mute }]}>
                  {feedback2}
                </Text>
              </View>
            </View>

            {/* Extras Grid: Left: Replay with Highlights, Right: Radar Breakdown */}
            <View
              style={[
                styles.extrasGrid,
                isWeb ? styles.extrasGridWeb : styles.extrasGridMobile,
              ]}
            >
              <ReplayWithHighlights
                samples={samples}
                fillers={fillers}
                totalMs={totalMs}
                avgWpm={avgWpm}
                audioSource={audioSource}
                colors={colors}
              />
              <RadarBreakdown
                clarity={rubricScores.clarity}
                structure={rubricScores.structure}
                confidence={rubricScores.confidence}
                relevance={rubricScores.relevance}
                colors={colors}
              />
            </View>

            {/* Action Buttons: Next Question & Share Result */}
            <View style={styles.actionsRow}>
              <NextQuestionBtn
                onPress={onNextQuestion}
                colors={colors}
                isWeb={isWeb}
              />
              <ShareResultBtn
                onPress={onSharePress}
                colors={colors}
                isWeb={isWeb}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderRadius: RADII.card,
    padding: 16,
  },
  cardWeb: {
    marginTop: 22,
    borderRadius: 32,
    paddingTop: 28,
    paddingHorizontal: 32,
    paddingBottom: 30,
  },
  statusRow: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blinkingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 13,
    fontWeight: '800',
  },
  qNum: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  timer: {
    marginLeft: 'auto',
    fontFamily: FONTS.outfit.bold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  qWindow: {
    overflow: 'hidden',
    marginTop: 8,
  },
  qText: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    minHeight: 53,
    fontWeight: '700',
  },
  qTextWeb: {
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.6,
  },
  panelContainer: {
    marginTop: 14,
  },
  idlePanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  idlePanelWeb: {
    justifyContent: 'center',
    gap: 56,
  },
  recPanel: {
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  thinkPanel: {
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  hopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  thinkText: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 16,
    fontWeight: '600',
  },
  resultPanel: {
    flexDirection: 'column',
  },
  resTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  verdictCol: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  verdictText: {
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  feedbackText: {
    fontFamily: FONTS.outfit.medium,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  extrasGrid: {
    marginTop: 20,
    gap: 16,
  },
  extrasGridWeb: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  extrasGridMobile: {
    flexDirection: 'column',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    flexWrap: 'wrap',
  },
});
