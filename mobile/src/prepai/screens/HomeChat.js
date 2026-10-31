import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS } from '../theme';
import Mascot from '../components/Mascot';
import QuestionCard from '../components/QuestionCard';
import Chip from '../components/Chip';
import Composer from '../components/Composer';
import ChatThread from '../components/ChatThread';
import HardShadowBox from '../components/HardShadowBox';

const POPULAR_QUESTIONS = [
  {
    id: 'q1',
    iconName: 'user',
    tileColor: COLORS.accentMint,
    question: 'How do I answer “Tell me about yourself”?',
  },
  {
    id: 'q2',
    iconName: 'bolt',
    tileColor: COLORS.accentYellow,
    question: 'What are my strengths and weaknesses?',
  },
  {
    id: 'q3',
    iconChar: '$',
    tileColor: COLORS.accentBlue,
    question: 'How do I bring up salary without sounding greedy?',
  },
  {
    id: 'q4',
    iconChar: '?',
    charColor: '#B3261E',
    tileColor: COLORS.accentSalmon,
    question: 'What questions should I ask the interviewer?',
  },
];

export default function HomeChat({
  messages = [],
  isLoading = false,
  draft = '',
  onChangeDraft,
  onSend,
  onMicPress,
  isListening = false,
  onSelectQuestion,
  onSelectChip,
  showChips = true,
  isMobile = false,
}) {
  const hasMessages = messages.length > 0;

  return (
    <View style={styles.mainContainer}>
      <View style={styles.centerColumn}>
        {hasMessages ? (
          /* Show active conversation thread once messages exist */
          <ChatThread messages={messages} isLoading={isLoading} />
        ) : (
          /* Initial Welcome + Popular Questions State */
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Greeting Row */}
            <View style={styles.greetingRow}>
              <Mascot width={120} height={144} style={styles.greetingMascot} />
              <HardShadowBox
                offset={6}
                radius={RADII.bubble}
                borderWidth={3}
                borderColor={COLORS.ink}
                backgroundColor={COLORS.surface}
                style={styles.greetingBubbleWrapper}
                contentStyle={styles.greetingBubbleContent}
              >
                <Text style={styles.greetingH1}>
                  Hey there! Ready to ace it?
                </Text>
                <Text style={styles.greetingSub}>
                  Pick a question or ask your own.
                </Text>
              </HardShadowBox>
            </View>

            {/* 2. Popular Questions Header */}
            <View style={styles.questionsHeaderRow}>
              <Text style={styles.questionsHeaderTitle}>
                Popular questions
              </Text>
              <TouchableOpacity
                onPress={() => onSelectQuestion && onSelectQuestion('Tell me about yourself')}
                accessibilityRole="button"
                accessibilityLabel="See all popular questions"
              >
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>

            {/* 3. Popular Questions Grid (2x2 on desktop/tablet, 1-col on mobile) */}
            <View
              style={[
                styles.grid,
                isMobile ? styles.gridSingleCol : styles.gridTwoCol,
              ]}
            >
              {POPULAR_QUESTIONS.map((item) => (
                <QuestionCard
                  key={item.id}
                  iconName={item.iconName}
                  iconChar={item.iconChar}
                  charColor={item.charColor}
                  tileColor={item.tileColor}
                  question={item.question}
                  onPress={() => onSelectQuestion && onSelectQuestion(item.question)}
                />
              ))}
            </View>

            {/* 4. Chip Row (shown on < 1200px or when showChips is true) */}
            {showChips ? (
              <View style={styles.chipRow}>
                <Chip
                  iconName="doc"
                  label="Resume tips"
                  onPress={() => onSelectChip && onSelectChip('resume', 'Resume tips')}
                />
                <Chip
                  iconName="mic"
                  label="Mock Q&A"
                  onPress={() => onSelectChip && onSelectChip('mock', 'Mock Q&A')}
                />
                <Chip
                  iconName="figure"
                  label="Body language"
                  onPress={() => onSelectChip && onSelectChip('body', 'Body language')}
                />
              </View>
            ) : null}
          </ScrollView>
        )}

        {/* 5. Fixed Composer at the bottom */}
        <Composer
          draft={draft}
          onChangeDraft={onChangeDraft}
          onSend={onSend}
          onMicPress={onMicPress}
          isListening={isListening}
          isLoading={isLoading}
          showHint={!hasMessages}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    height: '100%',
    boxSizing: 'border-box',
  },
  centerColumn: {
    width: '100%',
    maxWidth: 820,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  scrollArea: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 8,
  },
  greetingMascot: {
    flexShrink: 0,
  },
  greetingBubbleWrapper: {
    flex: 1,
  },
  greetingBubbleContent: {
    paddingVertical: 24,
    paddingHorizontal: 30,
    backgroundColor: COLORS.surface,
  },
  greetingH1: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 6,
  },
  greetingSub: {
    fontFamily: FONTS.nunito.medium,
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.muted,
  },
  questionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 32,
    marginBottom: 14,
  },
  questionsHeaderTitle: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
  },
  seeAllText: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
    textDecorationLine: 'underline',
  },
  grid: {
    width: '100%',
  },
  gridTwoCol: {
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 18,
        width: '100%',
      },
      default: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 18,
        width: '100%',
      },
    }),
  },
  gridSingleCol: {
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 16,
        width: '100%',
      },
      default: {
        flexDirection: 'column',
        gap: 16,
        width: '100%',
      },
    }),
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    flexWrap: 'wrap',
  },
});
