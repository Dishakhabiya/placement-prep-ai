import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
  StyleSheet,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { FONTS } from '../../theme/prepGreen';

export default function ShareModal({
  visible,
  onClose,
  score,
  questionText,
  fillerCount = 0,
  wpm = 140,
  colors,
}) {
  const [noteText, setNoteText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const cardRef = useRef(null);
  const shareBtnRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setNoteText('');
    }
  }, [visible]);

  // Handle Escape key on web
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  const shareTextContent = `I scored ${score} on "${questionText}" with PrepAI. Practise out loud.`;

  const copyToClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareTextContent);
        setNoteText('Copied. Paste it anywhere.');
      } else {
        setNoteText('Sharing is blocked here. Take a screenshot of the card instead.');
      }
    } catch {
      setNoteText('Sharing is blocked here. Take a screenshot of the card instead.');
    }
  };

  const handleShare = async () => {
    setIsProcessing(true);
    setNoteText('');

    try {
      if (Platform.OS === 'web') {
        // Try web capture and sharing
        let capturedBlob = null;
        try {
          const html2canvas = require('html2canvas');
          const element = document.getElementById('share-card-element') || cardRef.current;
          if (element) {
            const canvas = await html2canvas(element, {
              backgroundColor: '#1B2E1F',
              scale: 2,
            });
            capturedBlob = await new Promise((resolve) =>
              canvas.toBlob(resolve, 'image/png')
            );
          }
        } catch {}

        if (capturedBlob && navigator.canShare && navigator.canShare({ files: [new File([capturedBlob], 'prepai-result.png', { type: 'image/png' })] })) {
          const file = new File([capturedBlob], 'prepai-result.png', { type: 'image/png' });
          await navigator.share({
            files: [file],
            title: 'PrepAI Result',
            text: shareTextContent,
          });
          setNoteText('Shared successfully.');
        } else if (capturedBlob) {
          // Download PNG on web
          const link = document.createElement('a');
          link.download = `prepai-score-${score}.png`;
          link.href = URL.createObjectURL(capturedBlob);
          link.click();
          setNoteText('Downloaded image. Card saved to your device.');
        } else if (navigator.share) {
          await navigator.share({
            text: shareTextContent,
          });
          setNoteText('Shared text successfully.');
        } else {
          await copyToClipboard();
        }
      } else {
        // Native platform
        try {
          const { captureRef } = require('react-native-view-shot');
          const uri = await captureRef(cardRef, {
            format: 'png',
            quality: 1.0,
          });
          const Sharing = require('expo-sharing');
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri);
            setNoteText('Shared successfully.');
          } else {
            await copyToClipboard();
          }
        } catch {
          await copyToClipboard();
        }
      }
    } catch (err) {
      await copyToClipboard();
    } finally {
      setIsProcessing(false);
    }
  };

  const fillerLabel =
    fillerCount === 1 ? '1 filler word' : `${fillerCount} filler words`;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close share dialog backdrop"
      >
        <Pressable
          style={[styles.dialogCard, { backgroundColor: colors.card }]}
          onPress={(e) => e.stopPropagation()}
          accessibilityRole="dialog"
          aria-modal={true}
          accessibilityLabel="Share your result"
        >
          {/* Fixed-color Card (NEVER THEMED) */}
          <View
            ref={cardRef}
            nativeID="share-card-element"
            id="share-card-element"
            style={styles.shareCard}
          >
            {/* Brand Row with Small Headphone Glyph */}
            <View style={styles.brandRow}>
              <Text style={styles.brandText}>PrepAI</Text>
              <Svg
                width={34}
                height={22}
                viewBox="0 0 34 22"
                aria-hidden={true}
              >
                <Path
                  d="M5 18C5 -2 29 -2 29 18"
                  fill="none"
                  stroke="#FF5B3A"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
                <Rect x={1} y={12} width={8} height={10} rx={3.5} fill="#E9F1E5" />
                <Rect x={25} y={12} width={8} height={10} rx={3.5} fill="#E9F1E5" />
              </Svg>
            </View>

            {/* Score Number */}
            <Text style={styles.scoreText}>{score}</Text>

            {/* Question */}
            <Text style={styles.questionText} numberOfLines={3}>
              {questionText}
            </Text>

            {/* Meta Row */}
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{fillerLabel}</Text>
              <Text style={styles.metaText}>{Math.round(wpm)} words a minute</Text>
            </View>

            {/* Footer */}
            <Text style={styles.footerTag}>Practise out loud.</Text>
          </View>

          {/* Note Line */}
          <Text
            style={[styles.noteLine, { color: colors.mute }]}
            accessibilityLiveRegion="polite"
          >
            {noteText}
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              ref={shareBtnRef}
              onPress={handleShare}
              disabled={isProcessing}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Share your result"
              style={[styles.btnShare, { backgroundColor: colors.ink }]}
            >
              <Text style={[styles.btnShareText, { color: colors.card }]}>
                {isProcessing ? 'Sharing…' : 'Share'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Close share dialog"
              style={[styles.btnClose, { borderColor: colors.ink }]}
            >
              <Text style={[styles.btnCloseText, { color: colors.ink }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 20, 14, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 30,
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  shareCard: {
    backgroundColor: '#1B2E1F',
    borderRadius: 22,
    padding: 22,
    flexDirection: 'column',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandText: {
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: '#E9F1E5',
  },
  scoreText: {
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 88,
    lineHeight: 88,
    letterSpacing: -3,
    color: '#FF5B3A',
    fontWeight: '800',
    marginTop: 14,
  },
  questionText: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 20,
    lineHeight: 24,
    color: '#E9F1E5',
    fontWeight: '700',
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 14,
  },
  metaText: {
    fontFamily: FONTS.outfit.semiBold,
    fontSize: 14,
    color: '#B7CBB9',
    fontWeight: '600',
  },
  footerTag: {
    fontFamily: FONTS.outfit.extraBold,
    fontSize: 15,
    color: '#E9F1E5',
    fontWeight: '800',
    marginTop: 16,
  },
  noteLine: {
    fontFamily: FONTS.outfit.medium,
    fontSize: 13.5,
    minHeight: 20,
    marginTop: 10,
    marginLeft: 2,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  btnShare: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  btnShareText: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  btnClose: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  btnCloseText: {
    fontFamily: FONTS.outfit.bold,
    fontSize: 15,
    fontWeight: '700',
  },
});
