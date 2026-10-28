import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import BackgroundBlobs from '../components/BackgroundBlobs';
import TopBar from '../components/TopBar';
import HeroPanel from '../components/HeroPanel';
import QuestionCard from '../components/QuestionCard';
import RandomCard from '../components/RandomCard';
import QuestionMarquee from '../components/QuestionMarquee';
import Toast from '../components/Toast';
import { PRACTICE_CARDS } from '../data/questions';

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isWide = width >= 940;
  const isMedium = width >= 520 && width < 940;
  const horizontalPadding = width >= 1200 ? 44 : width >= 768 ? 32 : 18;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Background drifting radial gradient glows */}
      <BackgroundBlobs />

      {/* Main Scrollable View */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: 8,
            paddingBottom: Math.max(36, insets.bottom + 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.maxContainer}>
          {/* Top Bar with brand, tabs, and streak badge */}
          <TopBar navigation={navigation} />

          {/* Full-Width Hero Panel */}
          <View style={styles.heroSection}>
            <HeroPanel entranceDelay={120} />
          </View>

          {/* Cards Grid: 2x2 on desktop/tablet, stacked on mobile */}
          <View style={styles.cardsSection}>
            {width >= 640 ? (
              <View style={styles.cardsGridTwoByTwo}>
                <View style={styles.cardRow}>
                  <View style={styles.cardCell}>
                    <QuestionCard
                      num={PRACTICE_CARDS[0].num}
                      tag={PRACTICE_CARDS[0].tag}
                      question={PRACTICE_CARDS[0].question}
                      index={0}
                      entranceDelay={240}
                    />
                  </View>
                  <View style={styles.cardCell}>
                    <QuestionCard
                      num={PRACTICE_CARDS[1].num}
                      tag={PRACTICE_CARDS[1].tag}
                      question={PRACTICE_CARDS[1].question}
                      index={1}
                      entranceDelay={360}
                    />
                  </View>
                </View>

                <View style={styles.cardRow}>
                  <View style={styles.cardCell}>
                    <QuestionCard
                      num={PRACTICE_CARDS[2].num}
                      tag={PRACTICE_CARDS[2].tag}
                      question={PRACTICE_CARDS[2].question}
                      index={2}
                      entranceDelay={480}
                    />
                  </View>
                  <View style={styles.cardCell}>
                    <RandomCard entranceDelay={600} />
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.cardsStacked}>
                <QuestionCard
                  num={PRACTICE_CARDS[0].num}
                  tag={PRACTICE_CARDS[0].tag}
                  question={PRACTICE_CARDS[0].question}
                  index={0}
                  entranceDelay={240}
                />
                <QuestionCard
                  num={PRACTICE_CARDS[1].num}
                  tag={PRACTICE_CARDS[1].tag}
                  question={PRACTICE_CARDS[1].question}
                  index={1}
                  entranceDelay={360}
                />
                <QuestionCard
                  num={PRACTICE_CARDS[2].num}
                  tag={PRACTICE_CARDS[2].tag}
                  question={PRACTICE_CARDS[2].question}
                  index={2}
                  entranceDelay={480}
                />
                <RandomCard entranceDelay={600} />
              </View>
            )}
          </View>

          {/* Bottom Question Marquee Strip */}
          <QuestionMarquee entranceDelay={720} />
        </View>
      </ScrollView>

      {/* Floating Bottom Toast */}
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
    height: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
  },
  maxContainer: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  heroSection: {
    width: '100%',
    marginBottom: 28,
  },
  cardsSection: {
    width: '100%',
    marginBottom: 32,
  },
  cardsGridTwoByTwo: {
    flexDirection: 'column',
    gap: 20,
    width: '100%',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 20,
    width: '100%',
  },
  cardCell: {
    flex: 1,
    minWidth: 0,
  },
  cardsStacked: {
    flexDirection: 'column',
    gap: 18,
    width: '100%',
  },
});
