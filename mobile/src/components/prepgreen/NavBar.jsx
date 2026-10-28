import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from 'react-native';
import { FONTS } from '../../theme/prepGreen';

export default function NavBar({
  onHistoryPress,
  onProgressPress,
  colors,
}) {
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (label) => {
    setToastMessage(`${label}: Coming soon`);
    setTimeout(() => setToastMessage(''), 2200);
  };

  return (
    <View style={styles.navContainer}>
      <View style={styles.navRow}>
        {/* Logo */}
        <Text style={[styles.logo, { color: colors.ink }]}>PrepAI</Text>

        {/* Links */}
        <View style={styles.linksRow}>
          {/* Active Link: Practice */}
          <View
            style={[
              styles.activeLink,
              {
                backgroundColor: colors.ink,
              },
            ]}
          >
            <Text style={[styles.activeLinkText, { color: colors.card }]}>
              Practice
            </Text>
          </View>

          {/* History Stub */}
          <TouchableOpacity
            onPress={() => {
              if (onHistoryPress) onHistoryPress();
              showToast('History');
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="History"
            style={styles.linkBtn}
          >
            <Text style={[styles.linkText, { color: colors.mute }]}>
              History
            </Text>
          </TouchableOpacity>

          {/* Progress Stub */}
          <TouchableOpacity
            onPress={() => {
              if (onProgressPress) onProgressPress();
              showToast('Progress');
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Progress"
            style={styles.linkBtn}
          >
            <Text style={[styles.linkText, { color: colors.mute }]}>
              Progress
            </Text>
          </TouchableOpacity>
        </View>

        {/* Flexible Space */}
        <View style={styles.spacer} />

        {/* 42px Circle Avatar with "D" */}
        <View
          style={[
            styles.avatar,
            {
              borderColor: colors.ink,
            },
          ]}
          accessibilityRole="image"
          accessibilityLabel="Signed in as D"
        >
          <Text style={[styles.avatarText, { color: colors.ink }]}>D</Text>
        </View>
      </View>

      {/* Floating Toast notification if active */}
      {toastMessage ? (
        <View
          style={[styles.toast, { backgroundColor: colors.ink }]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.toastText, { color: colors.card }]}>
            {toastMessage}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    height: 76,
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 100,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 36,
    width: '100%',
  },
  logo: {
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  activeLinkText: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 15,
    fontWeight: '600',
  },
  linkBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  linkText: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 15,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 16,
    fontWeight: '800',
  },
  toast: {
    position: 'absolute',
    top: 76,
    left: '50%',
    transform: [{ translateX: -100 }],
    width: 200,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    zIndex: 200,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      },
    }),
  },
  toastText: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 13.5,
    fontWeight: '600',
  },
});
