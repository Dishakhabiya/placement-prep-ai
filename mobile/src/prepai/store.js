import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { prepaiApi } from './api';

const PREPAI_STORAGE_KEY = '@prepai_desktop_chat_history_v1';

export const usePrepAIStore = create((set, get) => ({
  messages: [],
  history: [
    {
      id: 'hist_1',
      title: 'Tell me about yourself',
      messages: [
        {
          id: 'm_h1',
          sender: 'user',
          content: 'How do I answer “Tell me about yourself”?',
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'm_h2',
          sender: 'assistant',
          content:
            "Start with the present: your current education and top skills. Next, talk about 1-2 impactful projects or internships. Finally, explain why you're excited about this specific role.",
          created_at: new Date(Date.now() - 3600000 * 2 + 1000).toISOString(),
        },
      ],
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'hist_2',
      title: 'Salary negotiation',
      messages: [
        {
          id: 'm_h3',
          sender: 'user',
          content: 'How do I bring up salary without sounding greedy?',
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
        {
          id: 'm_h4',
          sender: 'assistant',
          content:
            'Anchor your answer with market research: "Based on market benchmarks for this role in our location, the typical range is between $X and $Y. My priority is finding the right team fit, and I am confident we can agree on a fair number."',
          created_at: new Date(Date.now() - 3600000 * 24 + 1000).toISOString(),
        },
      ],
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
    {
      id: 'hist_3',
      title: 'Questions for the interviewer',
      messages: [],
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    },
    {
      id: 'hist_4',
      title: 'Behavioral answers (STAR)',
      messages: [],
      created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    },
  ],
  activeHistoryId: 'hist_1',
  sessionId: null,
  draft: '',
  isListening: false,
  isLoading: false,
  error: null,

  async initStorage() {
    try {
      const data = await AsyncStorage.getItem(PREPAI_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({ history: parsed });
        }
      }
    } catch (e) {
      console.warn('PrepAI storage load error:', e);
    }
  },

  async persistHistory(historyList) {
    try {
      await AsyncStorage.setItem(PREPAI_STORAGE_KEY, JSON.stringify(historyList));
    } catch (e) {
      console.warn('PrepAI storage save error:', e);
    }
  },

  setDraft(draft) {
    set({ draft });
  },

  setIsListening(isListening) {
    set({ isListening });
  },

  startNewChat() {
    set({
      messages: [],
      sessionId: null,
      activeHistoryId: null,
      draft: '',
      error: null,
    });
  },

  loadChat(historyId) {
    const chat = get().history.find((h) => h.id === historyId);
    if (chat) {
      set({
        activeHistoryId: historyId,
        messages: chat.messages || [],
        sessionId: chat.sessionId || null,
        draft: '',
        error: null,
      });
    }
  },

  async sendMessage(userText) {
    const text = (userText || get().draft || '').trim();
    if (!text) return;

    set({ draft: '', error: null, isLoading: true });

    const userMessage = {
      id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    const currentMessages = [...get().messages, userMessage];
    set({ messages: currentMessages });

    try {
      const result = await prepaiApi.sendMessage({
        sessionId: get().sessionId,
        userMessage: text,
      });

      const assistantMessage = {
        id: `a_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sender: 'assistant',
        content: result.reply,
        created_at: new Date().toISOString(),
        model: result.model,
      };

      const finalMessages = [...currentMessages, assistantMessage];
      const newSessionId = result.sessionId || get().sessionId;

      let currentHistId = get().activeHistoryId;
      let historyList = [...get().history];

      if (currentHistId) {
        historyList = historyList.map((h) =>
          h.id === currentHistId
            ? { ...h, messages: finalMessages, sessionId: newSessionId }
            : h
        );
      } else {
        // Create a new history session named after the first question
        const titleSnippet =
          text.length > 32 ? text.substring(0, 32) + '…' : text;
        const newHistItem = {
          id: `hist_${Date.now()}`,
          title: titleSnippet,
          messages: finalMessages,
          sessionId: newSessionId,
          created_at: new Date().toISOString(),
        };
        historyList = [newHistItem, ...historyList];
        currentHistId = newHistItem.id;
      }

      set({
        messages: finalMessages,
        sessionId: newSessionId,
        activeHistoryId: currentHistId,
        history: historyList,
        isLoading: false,
      });

      get().persistHistory(historyList);
    } catch (err) {
      set({
        isLoading: false,
        error: err.message || 'Failed to receive reply',
      });
    }
  },
}));
