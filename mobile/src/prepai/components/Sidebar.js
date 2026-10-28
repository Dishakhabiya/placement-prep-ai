import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS } from '../theme';
import Mascot from './Mascot';
import Icon from './Icon';
import HardShadowBox from './HardShadowBox';

export default function Sidebar({
  history = [],
  activeHistoryId,
  onSelectChat,
  onNewChat,
  onMicPromptPress,
}) {
  return (
    <View style={styles.sidebar}>
      {/* 1. Logo Row */}
      <View style={styles.logoRow}>
        <Mascot width={44} height={52} />
        <View style={styles.logoTextCol}>
          <Text style={styles.brandTitle}>PrepAI</Text>
          <View style={styles.onlineBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        </View>
      </View>

      {/* 2. New Chat Button */}
      <HardShadowBox
        offset={4}
        radius={16}
        borderWidth={3}
        borderColor={COLORS.ink}
        backgroundColor={COLORS.primary}
        onPress={onNewChat}
        accessibilityRole="button"
        accessibilityLabel="New chat"
        contentStyle={styles.newChatBtn}
      >
        <Icon name="plus" size={20} color="#FFFFFF" strokeWidth={3} />
        <Text style={styles.newChatText}>New chat</Text>
      </HardShadowBox>

      {/* 3. History Section */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Icon name="history" size={16} color={COLORS.muted} strokeWidth={2.5} />
          <Text style={styles.historyLabel}>History</Text>
        </View>

        <ScrollView
          style={styles.historyList}
          showsVerticalScrollIndicator={false}
        >
          {history.map((item) => {
            const isActive = item.id === activeHistoryId;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => onSelectChat(item.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Chat history: ${item.title}`}
                style={[
                  styles.historyItem,
                  isActive ? styles.historyItemActive : styles.historyItemInactive,
                ]}
              >
                <Text
                  style={[
                    styles.historyItemText,
                    isActive && styles.historyItemTextActive,
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Bottom Prefer Talking Card */}
      <HardShadowBox
        offset={4}
        radius={18}
        borderWidth={3}
        borderColor={COLORS.ink}
        backgroundColor={COLORS.accentYellow}
        onPress={onMicPromptPress}
        style={styles.bottomCardWrapper}
        contentStyle={styles.bottomCardContent}
      >
        <Text style={styles.bottomCardTitle}>Prefer talking?</Text>
        <Text style={styles.bottomCardSubtitle}>
          Tap the mic and speak your question out loud.
        </Text>
      </HardShadowBox>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 280,
    flexShrink: 0,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderRightWidth: 3,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.panel,
    flexDirection: 'column',
    gap: 22,
    height: '100%',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoTextCol: {
    flexDirection: 'column',
  },
  brandTitle: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.ink,
    lineHeight: 28,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  greenDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.online,
  },
  onlineText: {
    fontFamily: FONTS.nunito.medium,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.muted,
  },
  newChatBtn: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
  },
  newChatText: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  historySection: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  historyLabel: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    color: COLORS.muted,
  },
  historyList: {
    flex: 1,
  },
  historyItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 6,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  historyItemActive: {
    borderWidth: 2,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.surface,
  },
  historyItemInactive: {
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  historyItemText: {
    fontFamily: FONTS.nunito.bold,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
  },
  historyItemTextActive: {
    color: COLORS.ink,
  },
  bottomCardWrapper: {
    marginTop: 'auto',
  },
  bottomCardContent: {
    padding: 16,
    backgroundColor: COLORS.accentYellow,
  },
  bottomCardTitle: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 4,
  },
  bottomCardSubtitle: {
    fontFamily: FONTS.nunito.medium,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    color: COLORS.ink,
  },
});
