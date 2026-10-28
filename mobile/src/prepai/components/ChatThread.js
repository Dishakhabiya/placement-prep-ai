import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  Easing,
  Platform,
  StyleSheet,
} from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS } from '../theme';
import HardShadowBox from './HardShadowBox';
import Mascot from './Mascot';

function TypingDots() {
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(dotAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dotAnim]);

  return (
    <View style={styles.typingContainer}>
      <Text style={styles.typingText}>PrepAI is thinking…</Text>
    </View>
  );
}

export default function ChatThread({ messages = [], isLoading = false }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 80);
    }
  }, [messages, isLoading]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
    >
      {messages.map((item, idx) => {
        const isUser = item.sender === 'user';

        if (isUser) {
          return (
            <View key={item.id || `msg-${idx}`} style={styles.userRow}>
              <HardShadowBox
                offset={4}
                radius={RADII.bubble}
                borderWidth={3}
                borderColor={COLORS.ink}
                backgroundColor={COLORS.primary}
                style={styles.bubbleWrapper}
                contentStyle={styles.userBubble}
              >
                <Text style={styles.userText}>{item.content}</Text>
              </HardShadowBox>
            </View>
          );
        }

        return (
          <View key={item.id || `msg-${idx}`} style={styles.assistantRow}>
            <Mascot size={40} style={styles.assistantMascot} />
            <HardShadowBox
              offset={5}
              radius={RADII.bubble}
              borderWidth={3}
              borderColor={COLORS.ink}
              backgroundColor={COLORS.surface}
              style={styles.bubbleWrapper}
              contentStyle={styles.assistantBubble}
            >
              <Text style={styles.assistantText}>{item.content}</Text>
            </HardShadowBox>
          </View>
        );
      })}

      {/* Typing Indicator */}
      {isLoading && (
        <View style={styles.assistantRow}>
          <Mascot size={40} style={styles.assistantMascot} />
          <HardShadowBox
            offset={4}
            radius={RADII.bubble}
            borderWidth={3}
            borderColor={COLORS.ink}
            backgroundColor={COLORS.surface}
            contentStyle={styles.assistantBubble}
          >
            <TypingDots />
          </HardShadowBox>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    paddingVertical: 16,
    gap: 18,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    paddingLeft: 48,
  },
  userBubble: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: RADII.bubble,
    backgroundColor: COLORS.primary,
  },
  userText: {
    fontFamily: FONTS.nunito.bold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
    paddingRight: 48,
  },
  assistantMascot: {
    flexShrink: 0,
    marginTop: 4,
  },
  bubbleWrapper: {
    maxWidth: '85%',
  },
  assistantBubble: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: RADII.bubble,
    backgroundColor: COLORS.surface,
  },
  assistantText: {
    fontFamily: FONTS.nunito.medium,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
    color: COLORS.ink,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontFamily: FONTS.nunito.bold,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.muted,
  },
});
