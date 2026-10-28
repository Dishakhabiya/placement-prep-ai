import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { useUiStore } from '../store/useUiStore';
import { INPUT_PLACEHOLDERS } from '../data/questions';

export default function InputBar() {
  const { colors, fonts } = useTheme();
  const showToast = useUiStore((s) => s.showToast);

  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(2); // Starts with "Try: Explain a project you led..." matching screenshot!

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % INPUT_PLACEHOLDERS.length);
    }, 3200);

    return () => clearInterval(timer);
  }, []);

  const handleSend = () => {
    const query = text.trim() || INPUT_PLACEHOLDERS[placeholderIndex].replace('Try: ', '');
    showToast(`Starting: “${query}”`);
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      if (Platform.OS === 'web' && e.preventDefault) {
        e.preventDefault();
      }
      handleSend();
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: isFocused ? colors.orange : 'rgba(255, 255, 255, 0.18)',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
        },
      ]}
    >
      <TextInput
        style={[
          styles.input,
          {
            color: colors.bg,
            fontFamily: fonts.bodyRegular,
          },
        ]}
        value={text}
        onChangeText={setText}
        placeholder={INPUT_PLACEHOLDERS[placeholderIndex]}
        placeholderTextColor="rgba(251, 243, 228, 0.65)"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onSubmitEditing={handleSend}
        onKeyPress={handleKeyDown}
        returnKeyType="send"
        accessibilityLabel="Type your interview question"
      />

      <TouchableOpacity
        onPress={handleSend}
        accessibilityRole="button"
        accessibilityLabel="Send question"
        style={[styles.sendBtn, { backgroundColor: colors.bg }]}
        activeOpacity={0.85}
      >
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 19V5M5 12l7-7 7 7"
            stroke={colors.ink}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingLeft: 22,
    paddingRight: 7,
    marginTop: 18,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    ...Platform.select({
      web: {
        transition: 'border-color 0.2s ease',
      },
    }),
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
