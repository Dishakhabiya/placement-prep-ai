import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SectionCard({
  title,
  subtitle,
  children,
  badge,
  badgeColor = '#FFC82C',
  actionButton,
  style,
}) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.headerRight}>
          {badge && (
            <View
              style={[
                styles.badge,
                badgeColor === '#FFC82C'
                  ? styles.yellowBadge
                  : { backgroundColor: `${badgeColor}15`, borderColor: badgeColor },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  badgeColor === '#FFC82C'
                    ? styles.yellowBadgeText
                    : { color: badgeColor },
                ]}
              >
                {badge}
              </Text>
            </View>
          )}
          {actionButton}
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginLeft: 8,
  },
  yellowBadge: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
  },
  yellowBadgeText: {
    color: '#854D0E',
    fontWeight: '700',
    fontSize: 11,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  body: {
    marginTop: 2,
  },
});
