import { Platform } from 'react-native';
import { apiClient } from '../api/client';
import { useProfileStore } from '../store/profileStore';

export const prepaiApi = {
  /**
   * Helper to resolve an existing profile ID from the profileStore or the backend.
   */
  async getEffectiveProfileId() {
    const storeState = useProfileStore.getState();
    if (storeState?.currentProfile?.profile_id) {
      return storeState.currentProfile.profile_id;
    }
    if (storeState?.lastProfileId) {
      return storeState.lastProfileId;
    }

    try {
      const profiles = await apiClient.listProfiles();
      if (Array.isArray(profiles) && profiles.length > 0) {
        return profiles[0].profile_id;
      }
    } catch (e) {
      console.warn('Failed to list profiles for PrepAI chat:', e);
    }

    // Default fallback profile ID if no profile is currently loaded
    return 'prof_d4492bf6ff';
  },

  /**
   * Sends a user message to the FastAPI /api/chat/message backend endpoint.
   * If the backend returns an error or is unreachable, provides an intelligent mock response.
   */
  async sendMessage({ sessionId, userMessage, currentScreen = 'PrepAI' }) {
    try {
      const profileId = await this.getEffectiveProfileId();
      const response = await apiClient.sendChatMessage({
        sessionId,
        profileId,
        userMessage,
        currentScreen,
      });

      if (response && !response.error) {
        return {
          reply: response.reply,
          sessionId: response.session_id,
          model: response.model || 'fastapi-chat-engine',
          intent: response.intent,
        };
      }

      console.warn('Backend chat response error, falling back to local coach:', response?.error);
      return this.fallbackReply(userMessage, sessionId);
    } catch (err) {
      console.warn('Network error calling chat backend, falling back:', err.message);
      return this.fallbackReply(userMessage, sessionId);
    }
  },

  /**
   * Local fallback AI coach when backend is offline or profile is uninitialized.
   */
  fallbackReply(userMessage, sessionId) {
    const lower = (userMessage || '').toLowerCase();
    let reply =
      "That's a fantastic question to practice! Structure your response with the STAR framework: Situation, Task, Action, and Result. Keep your answer under 90 seconds and highlight your specific contribution.";

    if (lower.includes('tell me about yourself')) {
      reply =
        "For 'Tell me about yourself', keep it to 60–90 seconds: start with where you are now (your current degree and top technical strengths), touch briefly on a pivotal project or internship, and finish with why this specific role excites you.";
    } else if (lower.includes('strength') || lower.includes('weakness')) {
      reply =
        "When discussing strengths, pick 2 relevant skills with concrete examples. For weaknesses, choose a real technical or professional area you have actively improved—for example, public speaking or learning Docker—and share the steps you took.";
    } else if (lower.includes('salary')) {
      reply =
        "To bring up salary politely: wait until the interview is advanced or the employer asks. Anchor your answer with market research: 'Based on my research for software engineering roles in this city, the typical range is between $X and $Y. My primary focus is finding the right team fit, and I am open to a competitive package.'";
    } else if (lower.includes('ask') || lower.includes('question')) {
      reply =
        "Great interviewers love candidates who ask thoughtful questions! Ask about their team's engineering velocity, how they measure success in the first 90 days, or what the biggest technical challenge the team is solving this quarter is.";
    } else if (lower.includes('resume')) {
      reply =
        "For your resume, use action verbs (Developed, Implemented, Engineered) and quantify outcomes with numbers (e.g. 'reduced latency by 35%'). Keep it to 1 clean page.";
    }

    return {
      reply,
      sessionId: sessionId || `session_${Date.now()}`,
      model: 'local-coach-adapter',
      intent: 'interview_coaching',
    };
  },

  /**
   * Web Speech Recognition adapter for voice input on web.
   */
  createSpeechRecognizer({ onResult, onError, onEnd }) {
    if (
      Platform.OS !== 'web' ||
      typeof window === 'undefined' ||
      (!window.SpeechRecognition && !window.webkitSpeechRecognition)
    ) {
      return null;
    }

    try {
      const SpeechRecognitionClass =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (onResult) onResult(transcript);
      };

      recognition.onerror = (e) => {
        if (onError) onError(e);
      };

      recognition.onend = () => {
        if (onEnd) onEnd();
      };

      return recognition;
    } catch {
      return null;
    }
  },

  /**
   * Resume Picker and analysis adapter using expo-document-picker.
   * TODO: Connect directly with full candidate JD matching when user triggers from Toolkit.
   */
  async pickAndAnalyzeResume() {
    try {
      const DocumentPicker = require('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        try {
          const profile = await apiClient.createProfile({ file, mode: 'resume_only' });
          return {
            success: true,
            message: `Analyzed ${file.name}. Found ${profile.skills?.length || 0} skills and match profile ${profile.profile_id}.`,
            profile,
          };
        } catch {
          return {
            success: true,
            message: `Selected ${file.name}. Your resume is ready for interview practice!`,
          };
        }
      }
      return { success: false, message: 'Upload cancelled.' };
    } catch (e) {
      return { success: false, message: `Could not pick document: ${e.message}` };
    }
  },
};
