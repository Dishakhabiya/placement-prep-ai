import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useProfileStore } from '../store/profileStore';
import { useChatStore } from '../store/chatStore';
import ChatBubble from '../components/ChatBubble';
import SuggestedPromptChips from '../components/SuggestedPromptChips';

export default function ChatbotScreen({ navigation }) {
  const { currentProfile } = useProfileStore();
  const {
    messages,
    suggestedActions,
    isLoading,
    error,
    loadSession,
    sendMessage,
    clearSession,
    clearError,
  } = useChatStore();

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef(null);

  const profileId = currentProfile?.profile_id;
  const currentMessages = (profileId && messages[profileId]) || [];
  const currentActions = (profileId && suggestedActions[profileId]) || [];

  useEffect(() => {
    if (profileId) {
      loadSession(profileId);
    }
  }, [profileId]);

  useEffect(() => {
    if (currentMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [currentMessages.length]);

  const handleSend = () => {
    if (!inputText.trim() || isLoading || !profileId) return;
    const textToSend = inputText.trim();
    setInputText('');
    sendMessage(profileId, textToSend);
  };

  const handleSelectAction = (action) => {
    if (isLoading) return;

    if (action.action_type === 'mock_interview') {
      navigation.navigate('MockInterview');
    } else if (action.action_type === 'review_skills') {
      navigation.navigate('MatchSummary');
    } else if (action.action_type === 'practice_topic') {
      const topic = action.payload?.topic;
      if (topic) {
        sendMessage(profileId, `How should I prepare for interview questions on ${topic}?`);
      } else {
        navigation.navigate('Topics');
      }
    } else if (action.action_type === 'ask_more') {
      const prompt = action.payload?.prompt || action.title;
      sendMessage(profileId, prompt);
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      'Reset Chat Session',
      'Are you sure you want to clear your current conversation history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => clearSession(profileId) },
      ]
    );
  };

  if (!currentProfile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🤖</Text>
          <Text style={styles.emptyTitle}>No Active Profile Found</Text>
          <Text style={styles.emptySubtitle}>
            Please upload a resume or select a saved candidate profile to start practicing with your AI coach.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.primaryBtnText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const jobTitle = currentProfile.job?.title || 'Target Role';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>AI Placement Coach</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Context: {jobTitle}
            </Text>
          </View>
          {currentMessages.length > 0 && (
            <TouchableOpacity style={styles.resetBtn} onPress={handleClearChat}>
              <Text style={styles.resetBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText} numberOfLines={2}>
              ⚠️ {error}
            </Text>
            <TouchableOpacity onPress={clearError} style={styles.dismissBtn}>
              <Text style={styles.dismissBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Message List */}
        {currentMessages.length === 0 ? (
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeIcon}>💡</Text>
            <Text style={styles.welcomeTitle}>Welcome to Your AI Coach!</Text>
            <Text style={styles.welcomeDesc}>
              I have analyzed your resume against the {jobTitle} job description. Here are some things you can ask me:
            </Text>
            <View style={styles.promptSuggestions}>
              <TouchableOpacity
                style={styles.suggestionCard}
                onPress={() => sendMessage(profileId, 'What are my biggest skill gaps for this role?')}
              >
                <Text style={styles.suggestionCardText}>🔍 "What are my biggest skill gaps for this role?"</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestionCard}
                onPress={() => sendMessage(profileId, 'Can you ask me a challenging interview question?')}
              >
                <Text style={styles.suggestionCardText}>🎯 "Can you ask me a challenging interview question?"</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestionCard}
                onPress={() => sendMessage(profileId, 'How should I explain my top project in an interview?')}
              >
                <Text style={styles.suggestionCardText}>🚀 "How should I explain my top project in an interview?"</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={currentMessages}
            keyExtractor={(_, index) => `msg-${index}`}
            renderItem={({ item }) => <ChatBubble message={item} />}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={styles.loadingText}>AI Coach is analyzing and thinking...</Text>
          </View>
        )}

        {/* Suggested Action Chips */}
        {currentActions.length > 0 && !isLoading && (
          <SuggestedPromptChips
            actions={currentActions}
            onSelectAction={handleSelectAction}
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask about skill gaps, prep tips, questions..."
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || isLoading) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 12.5,
    color: '#B91C1C',
    flex: 1,
  },
  dismissBtn: {
    paddingLeft: 10,
  },
  dismissBtnText: {
    fontSize: 14,
    color: '#B91C1C',
    fontWeight: '700',
  },
  messageList: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  welcomeContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeDesc: {
    fontSize: 13.5,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  promptSuggestions: {
    width: '100%',
    gap: 10,
  },
  suggestionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  suggestionCardText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    fontSize: 12,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  sendBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 19,
  },
  primaryBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
