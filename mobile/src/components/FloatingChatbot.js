import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import { useChatStore } from '../store/chatStore';
import ChatBubble from './ChatBubble';
import SuggestedPromptChips from './SuggestedPromptChips';
import Caricatures from '../assets/caricatures';

export default function FloatingChatbot({ navigationRef, currentRoute }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { currentProfile, profilesList, fetchProfile } = useProfileStore();
  const {
    messages,
    suggestedActions,
    isLoading,
    error,
    loadSession,
    sendMessage,
    clearError,
  } = useChatStore();

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef(null);

  // If already on the fullscreen Chatbot screen, hide the floating launcher to prevent duplicate UI
  if (currentRoute === 'Chatbot') {
    return null;
  }

  // Active profile: use currentProfile or fallback to the latest saved profile in the database
  const activeProfile = currentProfile || (profilesList && profilesList.length > 0 ? profilesList[0] : null);
  const profileId = activeProfile?.profile_id;
  const jobTitle = activeProfile?.job?.title || 'Placement Interview';

  const currentMessages = (profileId && messages[profileId]) || [];
  const currentActions = (profileId && suggestedActions[profileId]) || [];

  // Load session whenever opened or profileId changes
  useEffect(() => {
    if (profileId && isOpen) {
      loadSession(profileId);
    }
  }, [profileId, isOpen]);

  // Autoscroll to bottom on new messages
  useEffect(() => {
    if (isOpen && currentMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [currentMessages.length, isOpen]);

  const handleToggle = () => {
    if (!isOpen && !currentProfile && profilesList && profilesList.length > 0) {
      fetchProfile(profilesList[0].profile_id).catch(() => {});
    }
    setIsOpen((prev) => !prev);
  };

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    const textToSend = inputText.trim();

    if (!profileId) {
      alert('Please upload a resume or select a profile first to chat with the AI coach.');
      return;
    }

    setInputText('');
    sendMessage(profileId, textToSend);
  };

  const handleSelectAction = (action) => {
    if (isLoading) return;

    if (action.action_type === 'mock_interview') {
      setIsOpen(false);
      navigationRef?.navigate('MockInterview');
    } else if (action.action_type === 'review_skills') {
      setIsOpen(false);
      navigationRef?.navigate('MatchSummary');
    } else if (action.action_type === 'practice_topic') {
      const topic = action.payload?.topic;
      if (topic && profileId) {
        sendMessage(profileId, `How should I prepare for interview questions on ${topic}?`);
      } else {
        setIsOpen(false);
        navigationRef?.navigate('Topics');
      }
    } else if (action.action_type === 'ask_more') {
      const prompt = action.payload?.prompt || action.title;
      if (profileId) {
        sendMessage(profileId, prompt);
      }
    }
  };

  const handleExpandFullscreen = () => {
    setIsOpen(false);
    navigationRef?.navigate('Chatbot');
  };

  const coachIllustration = Caricatures.homeMockCallout || Caricatures.aiInterviewer;

  const chatWidth = Math.min(390, (windowWidth || 1000) - 32);
  const chatHeight = Math.min(540, (windowHeight || 800) - 100);

  return (
    <View style={styles.floatingContainer} pointerEvents="box-none">
      {/* 1. EXPANDED CHAT PANEL (Docked in the Right Corner) */}
      {isOpen && (
        <View style={[styles.chatWindow, { width: chatWidth, height: chatHeight }]}>
          {/* Browser Window Header - Matching the Caricature Theme */}
          <View style={styles.chatHeader}>
            <View style={styles.windowDotsRow}>
              <View style={[styles.windowDot, { backgroundColor: '#EF4444' }]} />
              <View style={[styles.windowDot, { backgroundColor: '#FACC15' }]} />
              <View style={[styles.windowDot, { backgroundColor: '#10B981' }]} />
            </View>

            <View style={styles.headerTitleRow}>
              <View style={styles.coachAvatarBox}>
                <Image
                  source={coachIllustration}
                  style={styles.coachAvatarImg}
                  resizeMode="contain"
                />
                <View style={styles.onlineDot} />
              </View>
              <View style={styles.headerTextGroup}>
                <Text style={styles.chatHeaderTitle} numberOfLines={1}>
                  Placement AI Coach
                </Text>
                <Text style={styles.chatHeaderSubtitle} numberOfLines={1}>
                  {activeProfile ? `${jobTitle}` : 'Interview Preparation'}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {/* Fullscreen Expand */}
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={handleExpandFullscreen}
                title="Open fullscreen"
                activeOpacity={0.7}
              >
                <Text style={styles.headerIconText}>⤢</Text>
              </TouchableOpacity>

              {/* Minimize / Close */}
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setIsOpen(false)}
                title="Minimize chat"
                activeOpacity={0.7}
              >
                <Text style={styles.headerIconText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText} numberOfLines={2}>
                ⚠️ {error}
              </Text>
              <TouchableOpacity onPress={clearError}>
                <Text style={styles.dismissBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Messages Body */}
          <View style={styles.chatBody}>
            {!profileId ? (
              <View style={styles.emptyState}>
                <Image
                  source={coachIllustration}
                  style={styles.emptyIllustration}
                  resizeMode="contain"
                />
                <Text style={styles.emptyTitle}>Welcome to Placement AI</Text>
                <Text style={styles.emptySubtitle}>
                  Select a candidate profile or upload a resume to get tailored mock interview coaching and skill gap guidance!
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => {
                    setIsOpen(false);
                    navigationRef?.navigate('Upload');
                  }}
                >
                  <Text style={styles.emptyBtnText}>Upload Resume & JD →</Text>
                </TouchableOpacity>
              </View>
            ) : currentMessages.length === 0 ? (
              <View style={styles.welcomeContainer}>
                <View style={styles.welcomeIllustrationBox}>
                  <Image
                    source={coachIllustration}
                    style={styles.welcomeIllustration}
                    resizeMode="contain"
                  />
                  <View style={styles.welcomeSpeechBubble}>
                    <Text style={styles.welcomeSpeechText}>Hi! How can I help you prepare today?</Text>
                  </View>
                </View>

                <Text style={styles.welcomeTitle}>Your AI Placement Coach</Text>
                <Text style={styles.welcomeDesc}>
                  Tailored specifically for <Text style={styles.highlightText}>{jobTitle}</Text>. Tap a quick question to start:
                </Text>

                <View style={styles.quickPromptsContainer}>
                  <TouchableOpacity
                    style={styles.quickPromptChip}
                    onPress={() => sendMessage(profileId, 'What are my biggest skill gaps for this job?')}
                  >
                    <Text style={styles.quickPromptIcon}>⚡</Text>
                    <Text style={styles.quickPromptText}>What are my top skill gaps?</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPromptChip}
                    onPress={() => sendMessage(profileId, 'Give me top interview preparation tips')}
                  >
                    <Text style={styles.quickPromptIcon}>🎯</Text>
                    <Text style={styles.quickPromptText}>Top interview prep tips</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPromptChip}
                    onPress={() => sendMessage(profileId, 'How is my resume match score?')}
                  >
                    <Text style={styles.quickPromptIcon}>📊</Text>
                    <Text style={styles.quickPromptText}>Review my resume match score</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={currentMessages}
                keyExtractor={(_, index) => `floating-msg-${index}`}
                renderItem={({ item }) => <ChatBubble message={item} />}
                contentContainerStyle={styles.messageList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              />
            )}

            {/* Thinking / Loading Indicator */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FACC15" />
                <Text style={styles.loadingText}>AI Coach is analyzing and thinking...</Text>
              </View>
            )}
          </View>

          {/* Action Chips */}
          {currentActions.length > 0 && !isLoading && (
            <View style={styles.actionChipsWrapper}>
              <SuggestedPromptChips
                actions={currentActions}
                onSelectAction={handleSelectAction}
              />
            </View>
          )}

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              placeholder={profileId ? 'Ask about skill gaps, prep tips, questions...' : 'Select a profile to start...'}
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={800}
              editable={!isLoading && !!profileId}
              onSubmitEditing={(e) => {
                if (Platform.OS === 'web' && !e.nativeEvent.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading || !profileId) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading || !profileId}
            >
              <Text style={styles.sendButtonArrow}>➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 2. FLOATING LAUNCHER (CIRCULAR CHATBOT ICON LIKE iMESSAGE SYMBOL) */}
      <TouchableOpacity
        style={[styles.floatingLauncher, isOpen && styles.floatingLauncherActive]}
        onPress={handleToggle}
        activeOpacity={0.85}
        id="floating-coach-launcher"
      >
        {isOpen ? (
          <Text style={styles.closeIconText}>✕</Text>
        ) : (
          <View style={styles.launcherCaricatureFrame}>
            <Image
              source={coachIllustration}
              style={styles.launcherCaricatureImg}
              resizeMode="contain"
            />
            <View style={styles.launcherLiveDot} />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 99999,
  },

  // Floating Circular Launcher Button (iMessage style)
  floatingLauncher: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FACC15',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  floatingLauncherActive: {
    backgroundColor: '#1E293B',
    borderColor: '#FACC15',
  },
  closeIconText: {
    color: '#FACC15',
    fontSize: 20,
    fontWeight: '800',
  },
  launcherCaricatureFrame: {
    position: 'relative',
    width: 48,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  launcherCaricatureImg: {
    width: 46,
    height: 36,
  },
  launcherLiveDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0B0F19',
  },

  // Floating Chat Window (Docked on Right Side)
  chatWindow: {
    position: 'absolute',
    bottom: 60,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
    elevation: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    flexDirection: 'column',
  },

  // Browser Window Header
  chatHeader: {
    backgroundColor: '#0B0F19',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  windowDotsRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 8,
  },
  windowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coachAvatarBox: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#FACC15',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachAvatarImg: {
    width: 38,
    height: 38,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#0B0F19',
  },
  headerTextGroup: {
    flex: 1,
  },
  chatHeaderTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  chatHeaderSubtitle: {
    fontSize: 11,
    color: '#FACC15',
    fontWeight: '600',
    marginTop: 1,
  },
  headerActions: {
    position: 'absolute',
    top: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  errorText: {
    fontSize: 11.5,
    color: '#DC2626',
    flex: 1,
  },
  dismissBtnText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
    paddingLeft: 6,
  },

  // Chat Body
  chatBody: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  messageList: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIllustration: {
    width: 140,
    height: 75,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0B0F19',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyBtn: {
    backgroundColor: '#FACC15',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#000000',
    fontSize: 12.5,
    fontWeight: '700',
  },

  // Welcome State with Reference Caricature
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  welcomeIllustrationBox: {
    alignItems: 'center',
    marginBottom: 10,
  },
  welcomeIllustration: {
    width: 130,
    height: 65,
  },
  welcomeSpeechBubble: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE047',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: -4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  welcomeSpeechText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  welcomeTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0B0F19',
    marginBottom: 2,
  },
  welcomeDesc: {
    fontSize: 11.5,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
  },
  highlightText: {
    color: '#B45309',
    fontWeight: '700',
  },
  quickPromptsContainer: {
    width: '100%',
    gap: 7,
  },
  quickPromptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  quickPromptIcon: {
    fontSize: 13,
  },
  quickPromptText: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
  },

  // Action chips wrapper
  actionChipsWrapper: {
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

  // Thinking loading
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },

  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#111827',
    maxHeight: 70,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FACC15', // Matches yellow button from theme
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FACC15',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
  },
  sendButtonArrow: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
});
