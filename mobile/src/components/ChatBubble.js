import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ChatBubble({ message }) {
  const isUser = message.sender === 'user';
  const isFallback = message.model === 'nlp_fallback';
  const isQuotaExceeded = message.model === 'quota_exceeded';

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getModelLabel = () => {
    if (isQuotaExceeded) return '⚡ Quota Limit';
    if (isFallback) return 'AI Fallback';
    if (message.model && message.model.toLowerCase().includes('nemotron')) return 'Nemotron';
    return message.model || 'AI Coach';
  };

  return (
    <View style={[styles.bubbleContainer, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {!isUser && (
          <View style={styles.assistantHeader}>
            <View style={styles.badgeContainer}>
              <Text style={styles.avatarLabel}>AI Coach</Text>
              <View style={[
                styles.modelBadge,
                isQuotaExceeded ? styles.quotaBadge
                  : isFallback ? styles.fallbackBadge
                  : styles.nemotronBadge,
              ]}>
                <Text style={[
                  styles.modelBadgeText,
                  isQuotaExceeded ? styles.quotaBadgeText
                    : isFallback ? styles.fallbackBadgeText
                    : styles.nemotronBadgeText,
                ]}>
                  {getModelLabel()}
                </Text>
              </View>
            </View>
          </View>
        )}

        <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
          {message.content}
        </Text>

        <Text style={[styles.timeText, isUser ? styles.userTimeText : styles.assistantTimeText]}>
          {formatTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleContainer: {
    marginVertical: 6,
    paddingHorizontal: 12,
    width: '100%',
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  assistantHeader: {
    marginBottom: 6,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  modelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nemotronBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 0.5,
  },
  nemotronBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  fallbackBadge: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 0.5,
  },
  fallbackBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  quotaBadge: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 0.5,
  },
  quotaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C2410C',
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#1F2937',
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTimeText: {
    color: '#DBEAFE',
  },
  assistantTimeText: {
    color: '#9CA3AF',
  },
});
