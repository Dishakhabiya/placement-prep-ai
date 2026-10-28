import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { COLORS, FONTS, RADII } from '../theme';
import Icon from './Icon';
import HardShadowBox from './HardShadowBox';

const TOOLKIT_ITEMS = [
  {
    id: 'resume',
    title: 'Resume tips',
    desc: 'Sharpen your resume before you apply.',
  },
  {
    id: 'mock',
    title: 'Mock Q&A',
    desc: 'Practice out loud and get feedback.',
  },
  {
    id: 'body',
    title: 'Body language',
    desc: 'Posture, eye contact and first impressions.',
  },
];

export default function ToolkitPanel({ onHistoryButtonPress, onItemPress }) {
  return (
    <View style={styles.panel}>
      {/* 1. Top-Right History Icon Button 56x56 */}
      <View style={styles.topRow}>
        <HardShadowBox
          offset={0}
          radius={16}
          borderWidth={3}
          borderColor={COLORS.ink}
          backgroundColor={COLORS.surface}
          onPress={onHistoryButtonPress}
          accessibilityRole="button"
          accessibilityLabel="Chat history"
          contentStyle={styles.historyBtn}
        >
          <Icon name="history" size={28} color={COLORS.ink} strokeWidth={2.5} />
        </HardShadowBox>
      </View>

      {/* 2. Title */}
      <Text style={styles.title}>Interview toolkit</Text>

      {/* 3. Three Toolkit Cards */}
      <View style={styles.cardsCol}>
        {TOOLKIT_ITEMS.map((item) => (
          <HardShadowBox
            key={item.id}
            offset={5}
            radius={20}
            borderWidth={3}
            borderColor={COLORS.ink}
            backgroundColor={COLORS.surface}
            enableHover={true}
            onPress={() => onItemPress && onItemPress(item.id, item.title)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}: ${item.desc}`}
            contentStyle={styles.cardContent}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
          </HardShadowBox>
        ))}
      </View>

      {/* 4. Bottom Mint Quick Tip Card */}
      <View style={styles.quickTipCard}>
        <Text style={styles.quickTipTitle}>Quick tip</Text>
        <Text style={styles.quickTipDesc}>
          Keep “Tell me about yourself” to about a minute: present, past, then
          why this role.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 300,
    flexShrink: 0,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderLeftWidth: 3,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.panel,
    flexDirection: 'column',
    gap: 18,
    height: '100%',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  historyBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
    marginTop: 6,
  },
  cardsCol: {
    flexDirection: 'column',
    gap: 16,
  },
  cardContent: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: COLORS.surface,
    minHeight: 88,
    ...Platform.select({
      web: { boxSizing: 'border-box' },
    }),
  },
  cardTitle: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 6,
    lineHeight: 22,
  },
  cardDesc: {
    fontFamily: FONTS.nunito.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: COLORS.muted,
  },
  quickTipCard: {
    marginTop: 'auto',
    borderWidth: 3,
    borderColor: COLORS.ink,
    borderRadius: 20,
    backgroundColor: COLORS.accentMint,
    padding: 16,
  },
  quickTipTitle: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 4,
  },
  quickTipDesc: {
    fontFamily: FONTS.nunito.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: COLORS.ink,
  },
});
