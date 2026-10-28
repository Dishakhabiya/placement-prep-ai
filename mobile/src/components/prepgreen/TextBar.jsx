import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { FONTS } from '../../theme/prepGreen';
import { SendBtn } from './IconButton';

export default function TextBar({ onSubmit, isWeb = false, colors }) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim()) return;
    const val = text.trim();
    setText('');
    onSubmit(val);
  };

  const isBlank = text.trim().length === 0;

  return (
    <View style={[styles.container, isWeb && styles.containerWeb]}>
      <View
        style={[
          styles.field,
          isWeb && styles.fieldWeb,
          { backgroundColor: colors.card },
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Or type your own question…"
          placeholderTextColor={colors.mute}
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
          style={[
            styles.input,
            isWeb && styles.inputWeb,
            { color: colors.ink },
          ]}
          autoCapitalize="sentences"
          autoCorrect={false}
          accessibilityLabel="Type your own question"
        />
        <SendBtn onPress={handleSubmit} colors={colors} disabled={isBlank} />
      </View>

      {/* Web Keyboard Shortcuts Hint Line */}
      {isWeb ? (
        <View style={styles.hintLine}>
          <Text style={[styles.hintText, { color: colors.mute }]}>
            Press{' '}
          </Text>
          <View style={[styles.kbdChip, { borderColor: colors.mute }]}>
            <Text style={[styles.kbdText, { color: colors.mute }]}>Space</Text>
          </View>
          <Text style={[styles.hintText, { color: colors.mute }]}>
            {' '}to start or finish your answer,{' '}
          </Text>
          <View style={[styles.kbdChip, { borderColor: colors.mute }]}>
            <Text style={[styles.kbdText, { color: colors.mute }]}>S</Text>
          </View>
          <Text style={[styles.hintText, { color: colors.mute }]}>
            {' '}to skip.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 'auto',
    paddingTop: 18,
  },
  containerWeb: {
    marginTop: 16,
    paddingTop: 0,
  },
  field: {
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 5,
    gap: 8,
  },
  fieldWeb: {
    height: 60,
    borderRadius: 30,
    paddingLeft: 24,
    paddingRight: 7,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.outfit.medium,
    fontSize: 14.5,
    paddingVertical: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' },
    }),
  },
  inputWeb: {
    fontSize: 16,
  },
  hintLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginHorizontal: 6,
    flexWrap: 'wrap',
  },
  hintText: {
    fontFamily: FONTS.outfit.medium,
    fontSize: 14,
    fontWeight: '500',
  },
  kbdChip: {
    borderWidth: 1.5,
    borderRadius: 7,
    paddingVertical: 2,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kbdText: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 13,
    fontWeight: '600',
  },
});
