import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS, FONTS } from '../../theme/prepHome';
import { ArrowUpIcon } from './Icons';

export default function TextBar({ onSubmit }) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim()) return;
    const submitted = text.trim();
    setText('');
    onSubmit(submitted);
  };

  const isEnabled = text.trim().length > 0;

  return (
    <View style={styles.outerContainer}>
      <View style={styles.pillContainer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Or type your question…"
          placeholderTextColor={COLORS.muted}
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
          style={styles.input}
          autoCapitalize="sentences"
          autoCorrect={false}
          accessibilityLabel="Type your question"
        />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={!isEnabled}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={[
            styles.sendButton,
            !isEnabled && styles.sendButtonDisabled,
          ]}
        >
          <ArrowUpIcon
            size={20}
            color={isEnabled ? COLORS.ink : 'rgba(11, 47, 58, 0.4)'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  pillContainer: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 5,
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.dmSans.regular,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  sendButtonDisabled: {
    opacity: 0.5,
    ...Platform.select({
      web: {
        cursor: 'default',
      },
    }),
  },
});
