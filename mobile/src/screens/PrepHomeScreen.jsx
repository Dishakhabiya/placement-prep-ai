import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

import { COLORS, FONTS, SPACING } from '../theme/prepHome';
import { HistoryIcon } from '../components/prephome/Icons';
import Mascot from '../components/prephome/Mascot';
import QuestionCard from '../components/prephome/QuestionCard';
import SurpriseCard from '../components/prephome/SurpriseCard';
import SoundBars from '../components/prephome/SoundBars';
import VoiceButton from '../components/prephome/VoiceButton';
import TextBar from '../components/prephome/TextBar';

// Keep splash screen visible until fonts are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

const QUESTION_CARDS = [
  {
    id: 'Q1',
    tag: 'Intro',
    tagColor: COLORS.tags.mint,
    question: 'Tell me about yourself.',
  },
  {
    id: 'Q2',
    tag: 'Self-awareness',
    tagColor: COLORS.tags.yellow,
    question: 'What are your biggest strengths and weaknesses?',
  },
  {
    id: 'Q3',
    tag: 'Money talk',
    tagColor: COLORS.tags.sky,
    question: 'How do I bring up salary politely?',
  },
  {
    id: 'Q',
    tag: 'Your turn',
    tagColor: COLORS.tags.pink,
    question: 'What should I ask the interviewer?',
  },
];

export default function PrepHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [errorMessage, setErrorMessage] = useState(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // Navigation handlers
  const handleSelectQuestion = (question, source = 'card') => {
    setErrorMessage(null);
    navigation.navigate('Chatbot', { question, source });
  };

  const handleSurpriseMe = () => {
    setErrorMessage(null);
    const randomIndex = Math.floor(Math.random() * QUESTION_CARDS.length);
    const randomQ = QUESTION_CARDS[randomIndex].question;
    navigation.navigate('Chatbot', { question: randomQ, source: 'surprise' });
  };

  const handleVoiceTranscription = (transcript) => {
    setErrorMessage(null);
    navigation.navigate('Chatbot', { question: transcript, source: 'voice' });
  };

  const handleTextSubmit = (typedQuestion) => {
    setErrorMessage(null);
    navigation.navigate('Chatbot', { question: typedQuestion, source: 'text' });
  };

  const handleHistoryPress = () => {
    setErrorMessage(null);
    navigation.navigate('History');
  };

  return (
    <View style={styles.outerBackground} onLayout={onLayoutRootView}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

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
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>
              PrepAI<Text style={styles.logoDot}>.</Text>
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={handleHistoryPress}
            accessibilityRole="button"
            accessibilityLabel="Chat history"
            style={styles.historyButton}
          >
            <HistoryIcon size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* 2. Hero Section */}
        <View style={styles.hero}>
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroLabel}>YOUR INTERVIEW COACH</Text>
            <Text style={styles.heroHeadline}>
              What shall we{'\n'}practise today?
            </Text>
          </View>
          <View style={styles.heroMascot}>
            <Mascot size={96} />
          </View>
        </View>

        {/* 3. Section Row */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionRowLabel}>PICK A CARD</Text>
          <Text style={styles.sectionRowLabel}>SWIPE</Text>
        </View>

        {/* 4. Card Carousel */}
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={SPACING.cardWidth + SPACING.cardGap}
            snapToAlignment="start"
            contentContainerStyle={styles.carouselContent}
          >
            {QUESTION_CARDS.map((item, index) => (
              <QuestionCard
                key={item.id}
                item={item}
                index={index}
                onPress={(q) => handleSelectQuestion(q, 'card')}
              />
            ))}

            {/* 5th Card: Surprise me */}
            <SurpriseCard
              index={QUESTION_CARDS.length}
              onPress={handleSurpriseMe}
            />

            {/* Trailing spacer to preserve 24px right gutter */}
            <View style={{ width: 12 }} />
          </ScrollView>
        </View>

        {/* 5. Flexible Spacer */}
        <View style={styles.flexSpacer} />

        {/* Bottom Area wrapped in KeyboardAvoidingView */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {/* 6. Voice Area */}
          <View style={styles.voiceArea}>
            <View style={styles.voiceRow}>
              <SoundBars side="left" />
              <VoiceButton
                onTranscriptionSuccess={handleVoiceTranscription}
                onError={setErrorMessage}
                isProcessing={isProcessingVoice}
                setIsProcessing={setIsProcessingVoice}
              />
              <SoundBars side="right" />
            </View>
            <Text style={styles.voiceCaption}>Tap and ask out loud</Text>
          </View>

          {/* Inline Error Message */}
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* 7. Text Bar */}
          <TextBar onSubmit={handleTextSubmit} />
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontFamily: FONTS.fraunces.bold,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  logoDot: {
    color: COLORS.orange,
  },
  historyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  // 2. Hero
  hero: {
    paddingTop: 14,
    paddingRight: 20,
    paddingLeft: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroLabel: {
    fontFamily: FONTS.dmSans.bold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLORS.muted,
  },
  heroHeadline: {
    fontFamily: FONTS.fraunces.bold,
    fontSize: 31,
    lineHeight: 33,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
  },
  heroMascot: {
    flexShrink: 0,
  },
  // 3. Section Row
  sectionRow: {
    paddingTop: 22,
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionRowLabel: {
    fontFamily: FONTS.dmSans.bold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLORS.muted,
  },
  // 4. Carousel
  carouselContainer: {
    height: SPACING.cardHeight,
  },
  carouselContent: {
    paddingHorizontal: 24,
    gap: SPACING.cardGap,
    alignItems: 'center',
  },
  // 5. Spacer
  flexSpacer: {
    flex: 1,
  },
  // 6. Voice Area
  voiceArea: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  voiceCaption: {
    fontFamily: FONTS.dmSans.regular,
    fontSize: 13,
    color: COLORS.muted,
  },
  // Error Message
  errorContainer: {
    marginHorizontal: 24,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 122, 61, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 61, 0.4)',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: FONTS.dmSans.medium,
    fontSize: 12,
    color: '#FFA07A',
    textAlign: 'center',
  },
});
