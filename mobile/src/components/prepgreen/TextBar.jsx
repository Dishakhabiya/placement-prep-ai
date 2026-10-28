import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { FONTS } from '../../theme/prepGreen';
import { SendBtn } from './IconButton';

export default function TextBar({ onSubmit, colors }) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim()) return;
    const val = text.trim();
    setText('');
    onSubmit(val);
  };

  const isBlank = text.trim().length === 0;

  return (
    <View style={styles.container}>
      <View style={[styles.field, { backgroundColor: colors.card }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Or type your question…"
          placeholderTextColor={colors.mute}
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
          style={[styles.input, { color: colors.ink }]}
          autoCapitalize="sentences"
          autoCorrect={false}
          accessibilityLabel="Type your question"
        />
        <SendBtn onPress={handleSubmit} colors={colors} disabled={isBlank} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 'auto',
    paddingTop: 18,
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
});
