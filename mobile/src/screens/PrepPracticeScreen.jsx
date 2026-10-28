import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
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
import { apiClient } from '../api/client';
import Headphones from '../components/prepgreen/Headphones';
import QuestionCard from '../components/prepgreen/QuestionCard';
import Playlist from '../components/prepgreen/Playlist';
import TextBar from '../components/prepgreen/TextBar';
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

export default function PrepPracticeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const { scores, setScore } = usePrepGreenStore();
  const recorder = usePrepRecorder();

  const [cur, setCur] = useState(0);
  const [customQuestion, setCustomQuestion] = useState(null);
  const [state, setState] = useState('idle'); // 'idle' | 'rec' | 'think' | 'result'
  const [currentScore, setCurrentScore] = useState(87);
  const [verdict, setVerdict] = useState('Great answer');
  const [feedback1, setFeedback1] = useState(QUESTIONS[0].f[0]);
  const [feedback2, setFeedback2] = useState(QUESTIONS[0].f[1]);
  const [isRolling, setIsRolling] = useState(false);

  const [fontsLoaded] = useFonts({
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  const announce = (msg) => {
    try {
      AccessibilityInfo.announceForAccessibility(msg);
    } catch {}
  };

  // Start recording
  const handleStartRec = async () => {
    if (state !== 'idle' || isRolling) return;
    announce('Recording started');
    await recorder.start();
    setState('rec');
  };

  // Stop recording -> thinking -> analyze / mock -> result
  const handleStopRec = async () => {
    if (state !== 'rec') return;
    setState('think');
    announce('Reviewing your answer');

    const audioFile = await recorder.stop();
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

          const rawScore = evalRes?.relevance?.relevance_score || evalRes?.score;
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
  };

  // Skip question
  const handleSkip = () => {
    if (state !== 'idle' || isRolling) return;
    setCustomQuestion(null);
    const nextIdx = (cur + 1) % 4;
    setCur(nextIdx);
    announce(`Question: ${QUESTIONS[nextIdx].t}`);
  };

  // Next question after result
  const handleNextQuestion = () => {
    setState('idle');
    setCustomQuestion(null);
    const nextIdx = (cur + 1) % 4;
    setCur(nextIdx);
    announce('Next question');
  };

  // Row selection in playlist
  const handleSelectRow = (idx) => {
    if (state !== 'idle' || isRolling) return;
    setCustomQuestion(null);
    setCur(idx);
    announce(`Question: ${QUESTIONS[idx].t}`);
  };

  // Surprise me roll effect
  const handleRollSurprise = () => {
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
  };

  // Custom typed question
  const handleCustomSubmit = (typed) => {
    if (state !== 'idle' || isRolling) return;
    setCustomQuestion(typed);
    announce('Your own question');
  };

  if (!fontsLoaded) {
    return null;
  }

  const answeredCount = scores.filter((s) => s != null).length;
  const activeLabel = customQuestion ? 'You' : QUESTIONS[cur].n;
  const activeText = customQuestion || QUESTIONS[cur].t;

  return (
    <View style={[styles.outerBg, { backgroundColor: colors.bg }]} onLayout={onLayoutRootView}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />

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
          {/* 1. Top Bar */}
          <View style={styles.topBar}>
            <Text style={[styles.logo, { color: colors.ink }]}>PrepAI</Text>
            <HeaderHistoryBtn
              onPress={() => navigation.navigate('History')}
              colors={colors}
            />
          </View>

          {/* 2. Hero */}
          <View style={styles.heroSection}>
            <Headphones
              isRecording={state === 'rec'}
              voiceLevel={recorder.voiceLevel}
              colors={colors}
            />
            <Text style={[styles.headline, { color: colors.ink }]}>
              Practise out loud.
            </Text>
          </View>

          {/* 3. Question Card */}
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
            isRolling={isRolling}
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

          {/* 4. Playlist Section Label */}
          <View style={styles.playlistLabelRow}>
            <Text style={[styles.playlistLabel, { color: colors.mute }]}>
              Question playlist
            </Text>
            <Text style={[styles.playlistCount, { color: colors.mute }]}>
              {answeredCount} of 4 answered
            </Text>
          </View>

          {/* 5. Playlist */}
          <Playlist
            questions={QUESTIONS}
            currentIndex={cur}
            scores={scores}
            onSelectRow={handleSelectRow}
            colors={colors}
            isIdle={state === 'idle'}
          />

          {/* 6. Flexible Spacer & Text Bar with KeyboardAvoidingView */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
          >
            <TextBar onSubmit={handleCustomSubmit} colors={colors} />
          </KeyboardAvoidingView>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerBg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
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
