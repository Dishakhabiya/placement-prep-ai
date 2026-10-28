import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

import { COLORS, FONTS, SPACING } from '../theme/prepPink';
import HardShadow from '../components/preppink/HardShadow';
import Mascot from '../components/preppink/Mascot';
import QuestionRow from '../components/preppink/QuestionRow';
import TopicChip from '../components/preppink/TopicChip';
import {
  HeaderHistoryButton,
  MicVoiceButton,
  SendButton,
} from '../components/preppink/IconButton';

// Keep splash screen visible until fonts are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

const QUESTIONS_DATA = [
  {
    id: 'p_1',
    emoji: '🙋',
    tileColor: COLORS.tiles.mint,
    question: 'How do I answer “Tell me about yourself”?',
  },
  {
    id: 'p_2',
    emoji: '💪',
    tileColor: COLORS.tiles.yellow,
    question: 'What are my strengths and weaknesses?',
  },
  {
    id: 'p_3',
    emoji: '💰',
    tileColor: COLORS.tiles.sky,
    question: 'How do I bring up salary without sounding greedy?',
  },
  {
    id: 'p_4',
    emoji: '❓',
    tileColor: COLORS.tiles.peach,
    question: 'What questions should I ask the interviewer?',
  },
];

const TOPIC_CHIPS = [
  { label: '📄 Resume tips', clean: 'Resume tips' },
  { label: '🎤 Mock Q&A', clean: 'Mock Q&A' },
  { label: '🧍 Body language', clean: 'Body language' },
];

export default function PrepPinkHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Online dot animation (opacity 1 -> 0.3 -> 1, 1.6s loop)
  const dotOpacity = useRef(new Animated.Value(1)).current;

  const [fontsLoaded] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    let isCancelled = false;
    let dotAnim = null;

    const startDotLoop = (reduceMotion) => {
      if (reduceMotion || isCancelled) return;

      const useNative = Platform.OS !== 'web';
      dotAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, {
            toValue: 0.3,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: useNative,
          }),
          Animated.timing(dotOpacity, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: useNative,
          }),
        ])
      );
      dotAnim.start();
    };

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (!isCancelled) startDotLoop(enabled);
        })
        .catch(() => {
          if (!isCancelled) startDotLoop(false);
        });
    } else {
      startDotLoop(false);
    }

    return () => {
      isCancelled = true;
      if (dotAnim) dotAnim.stop();
    };
  }, [dotOpacity]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // Navigation Handlers
  const handleSelectQuestion = (question, source = 'card') => {
    setErrorMessage(null);
    navigation.navigate('Chatbot', { question, source });
  };

  const handleSelectChip = (cleanTopic) => {
    setErrorMessage(null);
    navigation.navigate('Chatbot', { question: cleanTopic, source: 'chip' });
  };

  const handleVoiceTranscription = (transcript) => {
    setErrorMessage(null);
    navigation.navigate('Chatbot', { question: transcript, source: 'voice' });
  };

  const handleTextSubmit = () => {
    if (!inputText.trim()) return;
    const textToSend = inputText.trim();
    setInputText('');
    setErrorMessage(null);
    navigation.navigate('Chatbot', { question: textToSend, source: 'text' });
  };

  const handleHistoryPress = () => {
    setErrorMessage(null);
    navigation.navigate('History');
  };

  const handleSeeAll = () => {
    // TODO: See all popular questions gallery
    if (Platform.OS === 'web') {
      console.log('[PrepPink] See all popular questions tapped');
    } else {
      Alert.alert('Popular Questions', 'More interview questions coming soon!');
    }
  };

  const isSendDisabled = inputText.trim().length === 0;

  return (
    <View style={styles.outerBackground} onLayout={onLayoutRootView}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <View
        style={[
          styles.deviceFrame,
          {
            paddingTop: Math.max(insets.top, 0),
            paddingBottom: Math.max(insets.bottom, 0),
          },
        ]}
      >
        {/* 1. Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Mascot size={40} animated={false} />
            <View style={styles.headerTitleCol}>
              <Text style={styles.headerTitle}>PrepAI</Text>
              <View style={styles.onlineRow}>
                <Animated.View
                  style={[styles.onlineDot, { opacity: dotOpacity }]}
                  aria-hidden={true}
                />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            </View>
          </View>
          <HeaderHistoryButton onPress={handleHistoryPress} />
        </View>

        {/* 2. Hero Section */}
        <View style={styles.hero}>
          <View style={styles.heroMascot}>
            <Mascot size={96} animated={true} />
          </View>

          <View style={styles.speechBubbleWrapper}>
            <HardShadow
              offset={{ x: 4, y: 4 }}
              borderTopLeftRadius={20}
              borderTopRightRadius={20}
              borderBottomRightRadius={20}
              borderBottomLeftRadius={6}
              shadowColor={COLORS.ink}
            >
              <View style={styles.speechBubbleContent}>
                <Text style={styles.bubbleTitle}>
                  Hey there! 👋 Ready to ace it?
                </Text>
                <Text style={styles.bubbleSubtitle}>
                  Pick a question or ask your own.
                </Text>
              </View>
            </HardShadow>
          </View>
        </View>

        {/* 3. Section Row */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Popular questions</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleSeeAll}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Question List */}
        <View style={styles.questionsList}>
          {QUESTIONS_DATA.map((item, index) => (
            <QuestionRow
              key={item.id}
              item={item}
              index={index}
              onPress={(q) => handleSelectQuestion(q, 'card')}
            />
          ))}
        </View>

        {/* 5. Topic Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {TOPIC_CHIPS.map((chip, idx) => (
            <TopicChip
              key={`chip-${idx}`}
              label={chip.label}
              cleanTopic={chip.clean}
              onPress={handleSelectChip}
            />
          ))}
        </ScrollView>

        {/* 6. Flexible Spacer */}
        <View style={styles.flexSpacer} />

        {/* 7 & 8. Mic Hint & Bottom Bar with KeyboardAvoidance */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {/* Error Line if any */}
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* 7. Mic Hint */}
          <Text style={styles.micHint}>
            {isRecording
              ? 'Listening… tap to stop'
              : '🎙️ Tap the mic to speak your question'}
          </Text>

          {/* 8. Bottom Bar */}
          <View style={styles.bottomBar}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about interviews…"
              placeholderTextColor="#6B6B6B"
              returnKeyType="send"
              onSubmitEditing={handleTextSubmit}
              style={styles.textInput}
              accessibilityLabel="Ask a question"
            />

            <MicVoiceButton
              onTranscriptionSuccess={handleVoiceTranscription}
              onError={setErrorMessage}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
            />

            <SendButton
              onPress={handleTextSubmit}
              disabled={isSendDisabled}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerBackground: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  deviceFrame: {
    width: '100%',
    maxWidth: SPACING.maxWebWidth,
    height: '100%',
    backgroundColor: COLORS.bg,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  // 1. Header
  header: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitleCol: {
    flexDirection: 'column',
  },
  headerTitle: {
    fontFamily: FONTS.poppins.bold,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '700',
    color: COLORS.ink,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.online,
  },
  onlineText: {
    fontFamily: FONTS.poppins.medium,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
  },
  // 2. Hero
  hero: {
    paddingTop: 4,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroMascot: {
    flexShrink: 0,
  },
  speechBubbleWrapper: {
    flex: 1,
  },
  speechBubbleContent: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.ink,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bubbleTitle: {
    fontFamily: FONTS.poppins.bold,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    color: COLORS.ink,
  },
  bubbleSubtitle: {
    fontFamily: FONTS.poppins.medium,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: COLORS.muted,
    marginTop: 6,
  },
  // 3. Section Row
  sectionRow: {
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontFamily: FONTS.poppins.bold,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
  },
  seeAllBtn: {
    paddingVertical: 8,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  seeAllText: {
    fontFamily: FONTS.poppins.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    textDecorationLine: 'underline',
  },
  // 4. Questions
  questionsList: {
    paddingHorizontal: 20,
    flexDirection: 'column',
    gap: 12,
  },
  // 5. Chips
  chipsScroll: {
    paddingTop: 18,
    paddingHorizontal: 20,
    gap: 8,
  },
  // 6. Spacer
  flexSpacer: {
    flex: 1,
  },
  // Error Banner
  errorContainer: {
    marginHorizontal: 20,
    marginBottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(232, 50, 107, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232, 50, 107, 0.4)',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: FONTS.poppins.medium,
    fontSize: 12,
    color: COLORS.rose,
    textAlign: 'center',
  },
  // 7. Mic Hint
  micHint: {
    textAlign: 'center',
    fontFamily: FONTS.poppins.medium,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    paddingBottom: 8,
  },
  // 8. Bottom Bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.white,
    paddingHorizontal: 18,
    fontFamily: FONTS.poppins.medium,
    fontSize: 14,
    color: COLORS.ink,
    ...Platform.select({
      web: { outlineStyle: 'none' },
    }),
  },
});
