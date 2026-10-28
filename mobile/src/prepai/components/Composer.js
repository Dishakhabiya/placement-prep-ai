import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS } from '../theme';
import Icon from './Icon';
import HardShadowBox from './HardShadowBox';

export default function Composer({
  draft = '',
  onChangeDraft,
  onSend,
  onMicPress,
  isListening = false,
  isLoading = false,
  showHint = true,
}) {
  const inputRef = useRef(null);
  const isBlank = !draft || draft.trim().length === 0;

  const handleKeyPress = (e) => {
    if (Platform.OS === 'web') {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isBlank && !isLoading) {
          onSend();
        }
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Hint Text */}
      {showHint && (
        <Text style={styles.hintText}>
          {isListening
            ? 'Listening… Speak your question now'
            : 'Tap the mic to speak your question'}
        </Text>
      )}

      {/* Input Row */}
      <View style={styles.inputRow}>
        {/* Pill Text Input */}
        <View style={styles.inputPillWrapper}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Ask about interviews…"
            placeholderTextColor={COLORS.muted}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={() => {
              if (!isBlank && !isLoading) onSend();
            }}
            onKeyPress={handleKeyPress}
            accessibilityLabel="Ask about interviews"
            style={[
              styles.inputPill,
              { color: COLORS.ink },
              Platform.OS === 'web' ? { outlineStyle: 'none' } : {},
            ]}
          />
        </View>

        {/* 60x60 Round Mic Button */}
        <HardShadowBox
          offset={4}
          radius={30}
          borderWidth={3}
          borderColor={COLORS.ink}
          backgroundColor={isListening ? COLORS.accentYellow : COLORS.primary}
          onPress={onMicPress}
          accessibilityRole="button"
          accessibilityLabel="Speak your question"
          style={styles.roundBtnWrapper}
          contentStyle={[
            styles.roundBtn,
            { backgroundColor: isListening ? COLORS.accentYellow : COLORS.primary },
          ]}
        >
          <Icon
            name="mic"
            size={26}
            color={isListening ? COLORS.ink : COLORS.surface}
            strokeWidth={2.5}
          />
        </HardShadowBox>

        {/* 60x60 Round Send Button */}
        <HardShadowBox
          offset={4}
          radius={30}
          borderWidth={3}
          borderColor={COLORS.ink}
          backgroundColor={COLORS.danger}
          onPress={() => {
            if (!isBlank && !isLoading) onSend();
          }}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={[styles.roundBtnWrapper, isBlank && styles.btnDisabled]}
          contentStyle={[styles.roundBtn, { backgroundColor: COLORS.danger }]}
        >
          <Icon name="arrowUp" size={26} color={COLORS.surface} strokeWidth={3} />
        </HardShadowBox>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 16,
  },
  hintText: {
    textAlign: 'center',
    fontFamily: FONTS.nunito.medium,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.muted,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  inputPillWrapper: {
    flex: 1,
    minWidth: 0,
  },
  inputPill: {
    height: 60,
    borderRadius: RADII.pill,
    borderWidth: 3,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 26,
    fontFamily: FONTS.nunito.medium,
    fontSize: 18,
    fontWeight: '500',
    justifyContent: 'center',
  },
  roundBtnWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    flexShrink: 0,
  },
  roundBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
