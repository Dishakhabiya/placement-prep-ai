import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  StatusBar,
  StyleSheet,
} from 'react-native';
import {
  useFonts,
  Nunito_500Medium,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import * as SplashScreen from 'expo-splash-screen';

import { COLORS, FONTS, RADII, BORDER } from './theme';
import { usePrepAIStore } from './store';
import { prepaiApi } from './api';
import Sidebar from './components/Sidebar';
import ToolkitPanel from './components/ToolkitPanel';
import HomeChat from './screens/HomeChat';
import Mascot from './components/Mascot';
import Icon from './components/Icon';
import HardShadowBox from './components/HardShadowBox';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function PrepAIApp() {
  const { width } = useWindowDimensions();

  // Breakpoints
  const isDesktop = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const isMobile = width < 768;

  const [mobileHistoryVisible, setMobileHistoryVisible] = useState(false);
  const speechRecRef = useRef(null);

  // Store bindings
  const {
    messages,
    history,
    activeHistoryId,
    draft,
    isListening,
    isLoading,
    initStorage,
    setDraft,
    setIsListening,
    startNewChat,
    loadChat,
    sendMessage,
  } = usePrepAIStore();

  const [fontsLoaded] = useFonts({
    Nunito_500Medium,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    initStorage();
  }, [initStorage]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Voice Speech Recognition toggle
  const handleToggleMic = () => {
    if (isListening) {
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const recognizer = prepaiApi.createSpeechRecognizer({
      onResult: (transcript) => {
        if (transcript) setDraft(transcript);
      },
      onError: () => {
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    if (recognizer) {
      speechRecRef.current = recognizer;
      try {
        recognizer.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    } else {
      // Fallback if browser doesn't support Web Speech API
      setDraft('How do I prepare for my upcoming technical interview?');
    }
  };

  const handleSelectQuestion = (qText) => {
    sendMessage(qText);
  };

  const handleSelectChip = async (chipId, label) => {
    if (chipId === 'resume') {
      const res = await prepaiApi.pickAndAnalyzeResume();
      if (res.message) {
        sendMessage(`Can you review my resume: ${res.message}`);
      }
    } else if (chipId === 'mock') {
      sendMessage('Can you give me a mock technical interview question?');
    } else if (chipId === 'body') {
      sendMessage('What are the best body language and eye contact tips for online video interviews?');
    } else {
      sendMessage(label);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View
      style={[
        styles.rootContainer,
        { backgroundColor: COLORS.bg },
        Platform.OS === 'web' ? { height: '100vh', maxHeight: '100vh' } : {},
      ]}
      onLayout={onLayoutRootView}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* MOBILE TOP BAR (< 768px) */}
      {isMobile && (
        <View style={styles.mobileHeader}>
          <View style={styles.mobileLogoRow}>
            <Mascot width={36} height={42} />
            <Text style={styles.mobileBrand}>PrepAI</Text>
            <View style={styles.mobileOnlineBadge}>
              <View style={styles.greenDot} />
              <Text style={styles.mobileOnlineText}>Online</Text>
            </View>
          </View>

          <HardShadowBox
            offset={3}
            radius={14}
            borderWidth={3}
            borderColor={COLORS.ink}
            backgroundColor={COLORS.surface}
            onPress={() => setMobileHistoryVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="View history"
            contentStyle={styles.mobileHistoryBtn}
          >
            <Icon name="history" size={22} color={COLORS.ink} strokeWidth={2.5} />
          </HardShadowBox>
        </View>
      )}

      {/* MAIN VIEWPORT LAYOUT */}
      <View style={styles.viewportRow}>
        {/* 1. LEFT SIDEBAR (Desktop & Tablet: >= 768px) */}
        {!isMobile && (
          <Sidebar
            history={history}
            activeHistoryId={activeHistoryId}
            onSelectChat={(id) => loadChat(id)}
            onNewChat={() => startNewChat()}
            onMicPromptPress={handleToggleMic}
          />
        )}

        {/* 2. CENTER MAIN (HomeChat Screen) */}
        <HomeChat
          messages={messages}
          isLoading={isLoading}
          draft={draft}
          onChangeDraft={setDraft}
          onSend={() => sendMessage(draft)}
          onMicPress={handleToggleMic}
          isListening={isListening}
          onSelectQuestion={handleSelectQuestion}
          onSelectChip={handleSelectChip}
          showChips={!isDesktop}
          isMobile={isMobile}
        />

        {/* 3. RIGHT TOOLKIT PANEL (Desktop only: >= 1200px) */}
        {isDesktop && (
          <ToolkitPanel
            onHistoryButtonPress={() => {
              if (history.length > 0) {
                loadChat(history[0].id);
              }
            }}
            onItemPress={(id, title) => handleSelectChip(id, title)}
          />
        )}
      </View>

      {/* MOBILE HISTORY MODAL (< 768px) */}
      {isMobile && (
        <Modal
          visible={mobileHistoryVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setMobileHistoryVisible(false)}
        >
          <View style={styles.mobileModalBackdrop}>
            <View style={styles.mobileModalCard}>
              <View style={styles.mobileModalHeader}>
                <Text style={styles.mobileModalTitle}>Chat History</Text>
                <TouchableOpacity
                  onPress={() => setMobileHistoryVisible(false)}
                  style={styles.mobileModalClose}
                >
                  <Text style={styles.mobileModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <HardShadowBox
                offset={4}
                radius={16}
                borderWidth={3}
                borderColor={COLORS.ink}
                backgroundColor={COLORS.primary}
                onPress={() => {
                  startNewChat();
                  setMobileHistoryVisible(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="New chat"
                contentStyle={styles.mobileNewChatBtn}
              >
                <Icon name="plus" size={20} color="#FFFFFF" strokeWidth={3} />
                <Text style={styles.mobileNewChatText}>New chat</Text>
              </HardShadowBox>

              <View style={styles.mobileHistoryList}>
                {history.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      loadChat(item.id);
                      setMobileHistoryVisible(false);
                    }}
                    style={[
                      styles.mobileHistoryItem,
                      item.id === activeHistoryId && styles.mobileHistoryItemActive,
                    ]}
                  >
                    <Text style={styles.mobileHistoryItemText} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  viewportRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  mobileHeader: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 3,
    borderColor: COLORS.ink,
    backgroundColor: COLORS.panel,
  },
  mobileLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileBrand: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
  },
  mobileOnlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.online,
  },
  mobileOnlineText: {
    fontFamily: FONTS.nunito.medium,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
  },
  mobileHistoryBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 15, 61, 0.65)',
    justifyContent: 'flex-end',
  },
  mobileModalCard: {
    backgroundColor: COLORS.panel,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 3,
    borderColor: COLORS.ink,
    padding: 24,
    maxHeight: '80%',
    gap: 16,
  },
  mobileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mobileModalTitle: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
  },
  mobileModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  mobileModalCloseText: {
    fontFamily: FONTS.nunito.bold,
    fontSize: 16,
    color: COLORS.ink,
  },
  mobileNewChatBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
  },
  mobileNewChatText: {
    fontFamily: FONTS.nunito.extraBold,
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mobileHistoryList: {
    maxHeight: 300,
  },
  mobileHistoryItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  mobileHistoryItemActive: {
    borderColor: COLORS.ink,
    backgroundColor: COLORS.surface,
  },
  mobileHistoryItemText: {
    fontFamily: FONTS.nunito.bold,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
  },
});
