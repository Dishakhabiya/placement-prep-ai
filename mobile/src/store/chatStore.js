import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';

const CHAT_STORAGE_PREFIX = '@placement_prep_chat_';

export const useChatStore = create((set, get) => ({
  sessions: {},          // { [profileId]: sessionId }
  messages: {},          // { [profileId]: [ { sender, content, created_at, model, suggested_actions } ] }
  suggestedActions: {},  // { [profileId]: [ { title, action_type, payload } ] }
  isLoading: false,
  error: null,

  setError: (msg) => set({ error: msg }),
  clearError: () => set({ error: null }),

  async loadSession(profileId) {
    if (!profileId) return;
    try {
      const stored = await AsyncStorage.getItem(`${CHAT_STORAGE_PREFIX}${profileId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        set((state) => ({
          sessions: { ...state.sessions, [profileId]: parsed.sessionId || null },
          messages: { ...state.messages, [profileId]: parsed.messages || [] },
          suggestedActions: { ...state.suggestedActions, [profileId]: parsed.suggestedActions || [] },
        }));
        return;
      }

      // If no local storage, initialize empty
      set((state) => ({
        sessions: { ...state.sessions, [profileId]: null },
        messages: { ...state.messages, [profileId]: [] },
        suggestedActions: { ...state.suggestedActions, [profileId]: [] },
      }));
    } catch (e) {
      console.warn('Failed to load chat session from storage:', e);
    }
  },

  async sendMessage(profileId, userMessageText, currentScreen) {
    if (!profileId || !userMessageText || !userMessageText.trim()) return;

    const trimmedMsg = userMessageText.trim();
    const currentSessionId = get().sessions[profileId] || null;
    const existingMessages = get().messages[profileId] || [];

    const optimisticUserMessage = {
      sender: 'user',
      content: trimmedMsg,
      created_at: new Date().toISOString(),
    };

    const updatedMessagesWithUser = [...existingMessages, optimisticUserMessage];

    // Optimistically update store
    set((state) => ({
      messages: { ...state.messages, [profileId]: updatedMessagesWithUser },
      isLoading: true,
      error: null,
    }));

    try {
      const response = await apiClient.sendChatMessage({
        sessionId: currentSessionId,
        profileId,
        userMessage: trimmedMsg,
        currentScreen: currentScreen || null,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const assistantMessage = {
        sender: 'assistant',
        content: response.reply,
        created_at: response.created_at || new Date().toISOString(),
        model: response.model,
        intent: response.intent,
      };

      const finalMessages = [...updatedMessagesWithUser, assistantMessage];
      const newSessionId = response.session_id || currentSessionId;
      const newActions = response.suggested_actions || [];

      set((state) => ({
        sessions: { ...state.sessions, [profileId]: newSessionId },
        messages: { ...state.messages, [profileId]: finalMessages },
        suggestedActions: { ...state.suggestedActions, [profileId]: newActions },
        isLoading: false,
        error: null,
      }));

      // Persist to AsyncStorage
      await AsyncStorage.setItem(
        `${CHAT_STORAGE_PREFIX}${profileId}`,
        JSON.stringify({
          sessionId: newSessionId,
          messages: finalMessages,
          suggestedActions: newActions,
        })
      );
    } catch (err) {
      set({
        isLoading: false,
        error: err.message || 'Failed to send chat message.',
      });
    }
  },

  async clearSession(profileId) {
    if (!profileId) return;
    const sessionId = get().sessions[profileId];

    if (sessionId) {
      try {
        await apiClient.deleteChatSession(sessionId);
      } catch (e) {
        console.warn('Failed to delete chat session on server:', e);
      }
    }

    set((state) => ({
      sessions: { ...state.sessions, [profileId]: null },
      messages: { ...state.messages, [profileId]: [] },
      suggestedActions: { ...state.suggestedActions, [profileId]: [] },
      error: null,
    }));

    try {
      await AsyncStorage.removeItem(`${CHAT_STORAGE_PREFIX}${profileId}`);
    } catch (e) {
      console.warn('Failed to remove chat session from storage:', e);
    }
  },
}));
