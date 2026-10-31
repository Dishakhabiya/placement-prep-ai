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

  const renderFormattedContent = (content) => {
    if (!content) return null;
    const lines = content.split('\n');

    return lines.map((line, lineIdx) => {
      let cleanLine = line;
      // Convert list asterisks (* item or - item) into clean bullet (• item)
      if (/^\s*[\*\-]\s+/.test(cleanLine)) {
        cleanLine = cleanLine.replace(/^\s*[\*\-]\s+/, '• ');
      }

      // Split by double asterisks **bold**
      const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);

      return (
        <Text key={`line-${lineIdx}`} style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
              const inner = part.slice(2, -2);
              return (
                <Text key={`bold-${partIdx}`} style={[styles.boldText, isUser ? styles.userBoldText : styles.assistantBoldText]}>
                  {inner}
                </Text>
              );
            }
            // Remove any leftover stray asterisks
            return part.replace(/\*/g, '');
          })}
          {lineIdx < lines.length - 1 ? '\n' : ''}
        </Text>
      );
    });
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

        <View style={styles.messageContentBox}>
          {renderFormattedContent(message.content)}
        </View>

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
    backgroundColor: '#0F172A',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#1E293B',
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
    fontWeight: '800',
    color: '#0F172A',
  },
  modelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nemotronBadge: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
    borderWidth: 0.5,
  },
  nemotronBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#854D0E',
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
    fontSize: 14,
    lineHeight: 20.5,
  },
  boldText: {
    fontWeight: '700',
  },
  userBoldText: {
    color: '#FDE047',
    fontWeight: '700',
  },
  assistantBoldText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  messageContentBox: {
    width: '100%',
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#111827',
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  userTimeText: {
    color: '#FACC15',
  },
  assistantTimeText: {
    color: '#9CA3AF',
  },
});
