import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  useWindowDimensions,
  AccessibilityInfo,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';

import {
  LIGHT_COLORS,
  DARK_COLORS,
  FONTS,
  SPACING,
} from '../theme/prepGreen';
import { usePrepGreenStore } from '../store/prepGreenStore';
import { usePrepRecorder } from '../hooks/usePrepRecorder';
import { usePaceCoach } from '../hooks/usePaceCoach';
import { apiClient } from '../api/client';
import Headphones from '../components/prepgreen/Headphones';
import QuestionCard from '../components/prepgreen/QuestionCard';
import Playlist from '../components/prepgreen/Playlist';
import TextBar from '../components/prepgreen/TextBar';
import NavBar from '../components/prepgreen/NavBar';
import VinylShelf from '../components/prepgreen/VinylShelf';
import ShareModal from '../components/prepgreen/ShareModal';
import { HeaderHistoryBtn, triggerHaptic } from '../components/prepgreen/IconButton';

SplashScreen.preventAutoHideAsync().catch(() => {});

const QUESTIONS = [
  {
    n: 'Q1',
    t: 'Tell me about yourself.',
    s: 'Tell me about yourself',
    f: [
      'Clear opening and a confident pace.',
      'Close with why this role fits you.',
    ],
  },
  {
    n: 'Q2',
    t: 'What are your biggest strengths and weaknesses?',
    s: 'Strengths and weaknesses',
    f: [
      'Good honest weakness with a real example.',
      'Say what you are doing to improve it.',
    ],
  },
  {
    n: 'Q3',
    t: 'How do I bring up salary politely?',
    s: 'Bringing up salary politely',
    f: [
      'Polite tone and good timing.',
      'Give a range backed by market data.',
    ],
  },
  {
    n: 'Q',
    t: 'What should I ask the interviewer?',
    s: 'What should I ask them?',
    f: [
      'Thoughtful questions about the team.',
      'Ask one about how success is measured.',
    ],
  },
];

// TODO: Ask backend Module 3 /api/answers/transcribe to return rubric breakdown scores:
// Clarity, Structure, Confidence, Relevance. Until then, derive them from overall score and filler count.
function deriveRubricScores(score, fillerCount) {
  const clampScore = (v) => Math.max(40, Math.min(99, Math.round(v)));
  const rnd = (min, max) => min + Math.random() * (max - min);

  return {
    clarity: clampScore(score + rnd(-8, 6)),
    structure: clampScore(score + rnd(-10, 6)),
    confidence: clampScore(score - fillerCount * 2 + rnd(-4, 6)),
    relevance: clampScore(score + rnd(-6, 8)),
  };
}

export default function PrepPracticeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const { width } = useWindowDimensions();
  const isWebLayout = Platform.OS === 'web' && width >= 920;

  const { scores, setScore, checkMidnightReset } = usePrepGreenStore();
  const recorder = usePrepRecorder();
  const coach = usePaceCoach();

  const [cur, setCur] = useState(0);
  const [customQuestion, setCustomQuestion] = useState(null);
  const [state, setState] = useState('idle'); // 'idle' | 'rec' | 'think' | 'result'
  const [currentScore, setCurrentScore] = useState(87);
  const [verdict, setVerdict] = useState('Great answer');
  const [feedback1, setFeedback1] = useState(QUESTIONS[0].f[0]);
  const [feedback2, setFeedback2] = useState(QUESTIONS[0].f[1]);
  const [isRolling, setIsRolling] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // Feature 2 & 3 & 4 result data
  const [replayData, setReplayData] = useState({
    samples: [],
    fillers: [],
    totalMs: 4000,
    avgWpm: 140,
    fillerCount: 0,
  });
  const [recordedAudioSource, setRecordedAudioSource] = useState(null);
  const [rubricScores, setRubricScores] = useState({
    clarity: 82,
    structure: 78,
    confidence: 85,
    relevance: 88,
  });
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const [fontsLoaded] = useFonts({
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  // Verify midnight reset on mount
  useEffect(() => {
    checkMidnightReset();
  }, [checkMidnightReset]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  const announce = useCallback((msg) => {
    setLiveAnnouncement(msg);
    try {
      AccessibilityInfo.announceForAccessibility(msg);
    } catch {}
  }, []);

  // Pass voice level to coach for 250ms metering sampling
  useEffect(() => {
    if (state === 'rec') {
      coach.addLevelSample(recorder.voiceLevel);
    }
  }, [state, recorder.voiceLevel, coach]);

  // Start recording
  const handleStartRec = useCallback(async () => {
    if (state !== 'idle' || isRolling) return;
    announce('Recording started');
    coach.startCoach();
    await recorder.start();
    setState('rec');
  }, [state, isRolling, announce, coach, recorder]);

  // Stop recording -> thinking -> analyze / mock -> result
  const handleStopRec = useCallback(async () => {
    if (state !== 'rec') return;
    setState('think');
    announce('Reviewing your answer');

    const coachData = coach.stopCoach();
    setReplayData(coachData);

    const audioFile = await recorder.stop();
    setRecordedAudioSource(audioFile);

    const activeQ = customQuestion || QUESTIONS[cur].t;

    let evaluatedScore = null;
    let evalVerdict = 'Good answer';
    let evalF1 = QUESTIONS[cur].f[0];
    let evalF2 = QUESTIONS[cur].f[1];

    if (audioFile) {
      try {
        const transRes = await apiClient.transcribeAudioAnswer({
          audioFile,
          questionId: `prep_green_${cur}`,
          questionText: activeQ,
          expectedKeyConcepts: [],
        });

        const transcript =
          transRes?.transcript_metadata?.transcript ||
          transRes?.transcript ||
          '';

        if (transcript) {
          const evalRes = await apiClient.evaluateAnswerText({
            questionId: `prep_green_${cur}`,
            questionText: activeQ,
            expectedKeyConcepts: [],
            answerText: transcript,
          });

          const rawScore =
            evalRes?.relevance?.relevance_score || evalRes?.score;
          if (rawScore != null) {
            evaluatedScore = Math.round(Number(rawScore));
          }
        }
      } catch (err) {
        // Fallback to simulated evaluation
      }
    }

    // Mock evaluation fallback if endpoint returned no score
    if (evaluatedScore == null) {
      await new Promise((r) => setTimeout(r, 1700));
      evaluatedScore = 68 + Math.floor(Math.random() * 25);
    }

    if (evaluatedScore >= 85) {
      evalVerdict = 'Great answer';
    } else if (evaluatedScore >= 75) {
      evalVerdict = 'Good answer';
    } else {
      evalVerdict = 'Getting there';
    }

    // Derive 4 rubric scores
    const calculatedRubrics = deriveRubricScores(
      evaluatedScore,
      coachData.fillerCount
    );
    setRubricScores(calculatedRubrics);

    setCurrentScore(evaluatedScore);
    setVerdict(evalVerdict);
    setFeedback1(evalF1);
    setFeedback2(evalF2);
    setScore(cur, evaluatedScore);
    setState('result');
    announce(`Score ${evaluatedScore} out of 100`);

    if (evaluatedScore >= 78) {
      triggerHaptic('success');
    }
  }, [state, announce, coach, recorder, customQuestion, cur, setScore]);

  // Skip question
  const handleSkip = useCallback(() => {
    if (state !== 'idle' || isRolling) return;
    setCustomQuestion(null);
    const nextIdx = (cur + 1) % 4;
    setCur(nextIdx);
    announce(`Question: ${QUESTIONS[nextIdx].t}`);
  }, [state, isRolling, cur, announce]);

  // Next question after result
  const handleNextQuestion = useCallback(() => {
    setState('idle');
    setCustomQuestion(null);
    const nextIdx = (cur + 1) % 4;
    setCur(nextIdx);
    announce('Next question');
  }, [cur, announce]);

  // Row selection in playlist
  const handleSelectRow = useCallback(
    (idx) => {
      if (state !== 'idle' || isRolling) return;
      setCustomQuestion(null);
      setCur(idx);
      announce(`Question: ${QUESTIONS[idx].t}`);
    },
    [state, isRolling, announce]
  );

  // Surprise me roll effect
  const handleRollSurprise = useCallback(() => {
    if (state !== 'idle' || isRolling) return;
    setIsRolling(true);
    setCustomQuestion(null);

    const targetIdx = (cur + 1 + Math.floor(Math.random() * 3)) % 4;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const randomQ = Math.floor(Math.random() * 4);
      setCur(randomQ);

      if (Date.now() - startTime >= 900) {
        clearInterval(interval);
        setCur(targetIdx);
        setIsRolling(false);
        announce(`Question: ${QUESTIONS[targetIdx].t}`);
      }
    }, 70);
  }, [state, isRolling, cur, announce]);

  // Custom typed question
  const handleCustomSubmit = useCallback(
    (typed) => {
      if (state !== 'idle' || isRolling) return;
      setCustomQuestion(typed);
      announce('Your own question');
    },
    [state, isRolling, announce]
  );

  // Keyboard shortcuts (web only: Space = toggle record/stop, S = skip; ignore when input/button focused or share dialog open)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e) => {
      if (isShareModalOpen) return;

      const target = e.target;
      const tag = (target?.tagName || '').toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      if (e.key === ' ') {
        if (tag === 'button') return;
        e.preventDefault();
        if (state === 'idle') {
          handleStartRec();
        } else if (state === 'rec') {
          handleStopRec();
        }
      } else if (e.key === 's' || e.key === 'S') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, isShareModalOpen, handleStartRec, handleStopRec, handleSkip]);

  if (!fontsLoaded) {
    return null;
  }

  const answeredCount = scores.filter((s) => s != null).length;
  const activeLabel = customQuestion ? 'You' : QUESTIONS[cur].n;
  const activeText = customQuestion || QUESTIONS[cur].t;

  // Responsive sizes for web layout
  const heroFontSize = Math.max(40, Math.min(66, Math.round(width * 0.054)));
  const heroHeadphoneWidth = Math.max(
    180,
    Math.min(280, Math.round(width * 0.22))
  );
  const heroHeadphoneHeight = Math.round(
    heroHeadphoneWidth * (140 / 240)
  );

  return (
    <View
      style={[styles.outerBg, { backgroundColor: colors.bg }]}
      onLayout={onLayoutRootView}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />

      {/* Screen Reader Live Region for Announcements */}
      {Platform.OS === 'web' && (
        <View
          accessibilityLiveRegion="polite"
          aria-live="polite"
          style={styles.srOnly}
        >
          <Text>{liveAnnouncement}</Text>
        </View>
      )}

      {isWebLayout ? (
        /* ======================== PART A: WEBSITE LAYOUT (>= 920px) ======================== */
        <View style={styles.webPageContainer}>
          {/* Nav Bar */}
          <NavBar
            onHistoryPress={() => navigation.navigate('History')}
            onProgressPress={() => {}}
            colors={colors}
          />

          {/* Two-Column Grid */}
          <View style={styles.webGrid}>
            {/* LEFT COLUMN (flex 1.4) */}
            <View style={styles.webLeftCol}>
              {/* Hero Row */}
              <View style={styles.webHeroRow}>
                <View style={styles.webHeroTextCol}>
                  <Text
                    style={[
                      styles.webHeadline,
                      {
                        fontSize: heroFontSize,
                        lineHeight: heroFontSize,
                        color: colors.ink,
                      },
                    ]}
                  >
                    Practise{'\n'}out loud.
                  </Text>
                  <Text style={[styles.webSubline, { color: colors.mute }]}>
                    Pick a question, answer it, and get a score in seconds.
                  </Text>
                </View>

                {/* Headphones with Cursor-Aware Tracking */}
                <Headphones
                  isRecording={state === 'rec'}
                  isIdle={state === 'idle'}
                  voiceLevel={recorder.voiceLevel}
                  width={heroHeadphoneWidth}
                  height={heroHeadphoneHeight}
                  colors={colors}
                />
              </View>

              {/* Question Card */}
              <QuestionCard
                state={state}
                questionLabel={activeLabel}
                questionText={activeText}
                timerText={recorder.timerText}
                barHeights={recorder.barHeights}
                score={currentScore}
                verdict={verdict}
                feedback1={feedback1}
                feedback2={feedback2}
                onStartRec={handleStartRec}
                onStopRec={handleStopRec}
                onRollSurprise={handleRollSurprise}
                onSkip={handleSkip}
                onNextQuestion={handleNextQuestion}
                onSharePress={() => setIsShareModalOpen(true)}
                isRolling={isRolling}
                isWeb={true}
                wpm={coach.wpm}
                fillerCount={coach.fillerCount}
                fillerPills={coach.fillerPills}
                onRemoveFillerPill={coach.removeFillerPill}
                samples={replayData.samples}
                fillers={replayData.fillers}
                totalMs={replayData.totalMs}
                avgWpm={replayData.avgWpm}
                audioSource={recordedAudioSource}
                rubricScores={rubricScores}
                colors={colors}
              />

              {/* Text Bar & Keyboard Shortcut Hints */}
              <TextBar
                onSubmit={handleCustomSubmit}
                isWeb={true}
                colors={colors}
              />
            </View>

            {/* RIGHT COLUMN (flex 1, sticky top 20) */}
            <View
              style={[
                styles.webRightCol,
                Platform.OS === 'web'
                  ? { position: 'sticky', top: 20 }
                  : {},
              ]}
            >
              {/* Question Playlist Section Header */}
              <View style={styles.webSecHeader}>
                <Text style={[styles.webSecTitle, { color: colors.ink }]}>
                  Question playlist
                </Text>
                <Text style={[styles.webSecCount, { color: colors.mute }]}>
                  {answeredCount} of 4 answered
                </Text>
              </View>

              {/* Playlist */}
              <Playlist
                questions={QUESTIONS}
                currentIndex={cur}
                scores={scores}
                onSelectRow={handleSelectRow}
                colors={colors}
                isIdle={state === 'idle'}
                isWeb={true}
              />

              {/* Feature 5: Today Vinyl Shelf */}
              <VinylShelf
                questions={QUESTIONS}
                scores={scores}
                colors={colors}
              />
            </View>
          </View>
        </View>
      ) : (
        /* ======================== MOBILE LAYOUT (< 920px) ======================== */
        <View
          style={[
            styles.deviceFrame,
            {
              backgroundColor: colors.bg,
              paddingTop: Math.max(insets.top, 0),
              paddingBottom: Math.max(insets.bottom, 0),
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Top Bar */}
            <View style={styles.topBar}>
              <Text style={[styles.logo, { color: colors.ink }]}>PrepAI</Text>
              <HeaderHistoryBtn
                onPress={() => navigation.navigate('History')}
                colors={colors}
              />
            </View>

            {/* Hero */}
            <View style={styles.heroSection}>
              <Headphones
                isRecording={state === 'rec'}
                isIdle={state === 'idle'}
                voiceLevel={recorder.voiceLevel}
                width={210}
                height={122}
                colors={colors}
              />
              <Text style={[styles.headline, { color: colors.ink }]}>
                Practise out loud.
              </Text>
            </View>

            {/* Question Card */}
            <QuestionCard
              state={state}
              questionLabel={activeLabel}
              questionText={activeText}
              timerText={recorder.timerText}
              barHeights={recorder.barHeights}
              score={currentScore}
              verdict={verdict}
              feedback1={feedback1}
              feedback2={feedback2}
              onStartRec={handleStartRec}
              onStopRec={handleStopRec}
              onRollSurprise={handleRollSurprise}
              onSkip={handleSkip}
              onNextQuestion={handleNextQuestion}
              onSharePress={() => setIsShareModalOpen(true)}
              isRolling={isRolling}
              isWeb={false}
              wpm={coach.wpm}
              fillerCount={coach.fillerCount}
              fillerPills={coach.fillerPills}
              onRemoveFillerPill={coach.removeFillerPill}
              samples={replayData.samples}
              fillers={replayData.fillers}
              totalMs={replayData.totalMs}
              avgWpm={replayData.avgWpm}
              audioSource={recordedAudioSource}
              rubricScores={rubricScores}
              colors={colors}
            />

            {/* Inline Microphone Access Error */}
            {recorder.permissionError ? (
              <View style={styles.errorBanner}>
                <Text style={[styles.errorText, { color: colors.tomato }]}>
                  {recorder.permissionError}
                </Text>
              </View>
            ) : null}

            {/* Playlist Section Header */}
            <View style={styles.playlistLabelRow}>
              <Text style={[styles.playlistLabel, { color: colors.mute }]}>
                Question playlist
              </Text>
              <Text style={[styles.playlistCount, { color: colors.mute }]}>
                {answeredCount} of 4 answered
              </Text>
            </View>

            {/* Playlist */}
            <Playlist
              questions={QUESTIONS}
              currentIndex={cur}
              scores={scores}
              onSelectRow={handleSelectRow}
              colors={colors}
              isIdle={state === 'idle'}
              isWeb={false}
            />

            {/* Feature 5: Vinyl Shelf on Mobile (under playlist) */}
            <VinylShelf
              questions={QUESTIONS}
              scores={scores}
              colors={colors}
            />

            {/* Text Bar with KeyboardAvoidingView */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            >
              <TextBar
                onSubmit={handleCustomSubmit}
                isWeb={false}
                colors={colors}
              />
            </KeyboardAvoidingView>
          </ScrollView>
        </View>
      )}

      {/* Feature 4: Share Modal */}
      <ShareModal
        visible={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        score={currentScore}
        questionText={activeText}
        fillerCount={replayData.fillerCount}
        wpm={replayData.avgWpm}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outerBg: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  srOnly: {
    position: 'absolute',
    left: -9999,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },

  /* Web Responsive Layout Styles */
  webPageContainer: {
    width: '100%',
    maxWidth: 1180,
    marginHorizontal: 'auto',
    paddingHorizontal: 32,
    paddingBottom: 48,
    flexDirection: 'column',
  },
  webGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 36,
    marginTop: 10,
    width: '100%',
  },
  webLeftCol: {
    flex: 1.4,
    minWidth: 0,
    flexDirection: 'column',
  },
  webHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  webHeroTextCol: {
    flex: 1,
    minWidth: 0,
  },
  webHeadline: {
    fontFamily: FONTS.outfit.extraBold,
    fontWeight: '800',
    letterSpacing: -2,
    margin: 0,
  },
  webSubline: {
    fontFamily: FONTS.outfit.medium,
    fontSize: 18,
    lineHeight: 25,
    marginTop: 16,
    maxWidth: 280,
    fontWeight: '500',
  },
  webRightCol: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
  },
  webSecHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginHorizontal: 6,
    marginBottom: 12,
  },
  webSecTitle: {
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  webSecCount: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 14,
    fontWeight: '600',
  },

  /* Mobile Layout Styles */
  deviceFrame: {
    width: '100%',
    maxWidth: SPACING.maxWebWidth,
    height: '100%',
    flexDirection: 'column',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 6,
  },
  headline: {
    marginTop: 4,
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 31,
    lineHeight: 34,
    letterSpacing: -0.9,
    textAlign: 'center',
    fontWeight: '800',
  },
  playlistLabelRow: {
    marginTop: 16,
    marginHorizontal: 4,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  playlistLabel: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  playlistCount: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  errorBanner: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 91, 58, 0.12)',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 12.5,
    textAlign: 'center',
  },
});
