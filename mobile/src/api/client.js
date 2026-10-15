import { API_BASE_URL } from '../config/apiConfig';

const DEFAULT_TIMEOUT_MS = 25000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s. Please check backend server.`);
    }
    throw new Error(`Network request failed: ${err.message}. Is backend running on ${API_BASE_URL}?`);
  }
}

export const apiClient = {
  async checkHealth() {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/health`, { method: 'GET' }, 6000);
      if (!res.ok) throw new Error(`Health check returned status ${res.status}`);
      return await res.json();
    } catch (e) {
      return { status: 'offline', error: e.message };
    }
  },

  async createProfile({ file, jdText, jdFile, mode }) {
    const formData = new FormData();

    if (file) {
      if (typeof window !== 'undefined' && file instanceof Blob) {
        formData.append('resume', file, file.name || 'resume.pdf');
      } else if (file.uri) {
        try {
          const fileRes = await fetch(file.uri);
          const blob = await fileRes.blob();
          formData.append('resume', blob, file.name || 'resume.pdf');
        } catch {
          // Fallback if blob conversion is not supported
          formData.append('resume', {
            uri: file.uri,
            name: file.name || 'resume.pdf',
            type: file.mimeType || (file.name?.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf'),
          });
        }
      }
    }

    if (jdFile) {
      if (typeof window !== 'undefined' && jdFile instanceof Blob) {
        formData.append('jd_file', jdFile, jdFile.name || 'job_description.pdf');
      } else if (jdFile.uri) {
        try {
          const jdRes = await fetch(jdFile.uri);
          const jdBlob = await jdRes.blob();
          formData.append('jd_file', jdBlob, jdFile.name || 'job_description.pdf');
        } catch {
          formData.append('jd_file', {
            uri: jdFile.uri,
            name: jdFile.name || 'job_description.pdf',
            type: jdFile.mimeType || (jdFile.name?.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf'),
          });
        }
      }
    }

    if (jdText) {
      formData.append('jd_text', jdText);
    }
    formData.append('mode', mode || 'mixed');

    // Do NOT set Content-Type header manually for multipart FormData
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/profile`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.detail || `Server error (${res.status})`;
      throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }
    return data;
  },

  async getProfile(profileId) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/profile/${profileId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch profile');
    return data;
  },

  async updateProfile(profileId, updatePayload) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/profile/${profileId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to update profile');
    return data;
  },

  async getProfileTopics(profileId) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/profile/${profileId}/topics`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch interview topics');
    return data;
  },

  async listProfiles() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/profiles`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch saved profiles');
    return data;
  },

  async deleteProfile(profileId) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/profile/${profileId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to delete profile');
    return data;
  },

  async generateQuestions(profileId, numQuestions = 5) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/questions/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId, num_questions: numQuestions }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to generate interview questions');
    return data;
  },

  async generateFollowup({ questionId, originalQuestion, targetTopic, candidateAnswer, missingConcepts }) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/questions/followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_id: questionId,
        original_question: originalQuestion,
        target_topic: targetTopic || '',
        candidate_answer: candidateAnswer,
        missing_concepts: missingConcepts || [],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to generate follow-up question');
    return data;
  },

  async evaluateAnswerText({ profileId, sessionId, questionId, questionText, expectedKeyConcepts, answerText }) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/answers/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: profileId || null,
        session_id: sessionId || null,
        question_id: questionId,
        question_text: questionText,
        expected_key_concepts: expectedKeyConcepts || [],
        answer_text: answerText,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.detail || `Server error (${res.status})`;
      throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }
    return data;
  },

  async transcribeAudioAnswer({ audioFile, profileId, sessionId, questionId, questionText, expectedKeyConcepts }) {
    const formData = new FormData();
    if (audioFile) {
      if (typeof window !== 'undefined' && audioFile instanceof Blob) {
        let defaultName = 'recording.webm';
        if (audioFile.type && audioFile.type.includes('mp4')) defaultName = 'recording.mp4';
        else if (audioFile.type && audioFile.type.includes('ogg')) defaultName = 'recording.ogg';
        else if (audioFile.type && audioFile.type.includes('wav')) defaultName = 'recording.wav';
        formData.append('audio', audioFile, audioFile.name || defaultName);
      } else if (audioFile.uri) {

        try {
          const fileRes = await fetch(audioFile.uri);
          const blob = await fileRes.blob();
          formData.append('audio', blob, audioFile.name || 'answer.wav');
        } catch {
          formData.append('audio', {
            uri: audioFile.uri,
            name: audioFile.name || 'answer.wav',
            type: audioFile.mimeType || 'audio/wav',
          });
        }
      }
    }

    formData.append('question_id', questionId);
    formData.append('question_text', questionText);
    if (profileId) formData.append('profile_id', profileId);
    if (sessionId) formData.append('session_id', sessionId);
    formData.append('expected_key_concepts', JSON.stringify(expectedKeyConcepts || []));

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/answers/transcribe`, {
      method: 'POST',
      body: formData,
    }, 45000);

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.detail || `Server error (${res.status})`;
      throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }
    return data;
  },

  async generateSessionReport({ evaluations, totalQuestions, questions, profileId, sessionId, candidateName, targetRole }) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/answers/session-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId || null,
        profile_id: profileId || null,
        candidate_name: candidateName || null,
        target_role: targetRole || null,
        total_questions: totalQuestions || null,
        questions: questions || null,
        evaluations: evaluations || [],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.detail || `Server error (${res.status})`;
      throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }
    return data;
  },

  async getNeuralTtsAudio({ text, voice = 'en-IN-NeerjaNeural', rate = '-3%', pitch = '+0Hz' }) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/answers/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate, pitch }),
    }, 15000);
    if (!res.ok) {
      let detail = `TTS server error (${res.status})`;
      try {
        const errorJson = await res.json();
        if (errorJson && errorJson.detail) {
          detail = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
        }
      } catch (_) {}
      throw new Error(detail);
    }
    const blob = await res.blob();
    if (!blob || blob.size < 50) {
      throw new Error('TTS server returned empty or incomplete audio data');
    }
    return blob;
  },


  async evaluateSpeechAnswer(paramsOrFormData) {
    if (typeof FormData !== 'undefined' && paramsOrFormData instanceof FormData) {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/answers/transcribe`, {
        method: 'POST',
        body: paramsOrFormData,
      }, 45000);
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.detail || `Server error (${res.status})`;
        throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      }
      return data;
    }
    return this.transcribeAudioAnswer(paramsOrFormData);
  },

  async evaluateTextAnswer(params) {
    return this.evaluateAnswerText({
      profileId: params.profileId || params.profile_id,
      sessionId: params.sessionId || params.session_id,
      questionId: params.questionId || params.question_id,
      questionText: params.questionText || params.question_text,
      expectedKeyConcepts: params.expectedKeyConcepts || params.expected_key_concepts || [],
      answerText: params.answerText || params.answer_text,
    });
  },

  /**
   * Sends a base64 JPEG frame for AI visual analysis:
   * detects posture, attire, eye contact and background distractions.
   * @param {string} imageBase64 - raw base64 JPEG string (no data: prefix)
   * @returns {{ posture, attire, eye_contact, background, overall_alert, alert_message, confidence, error }}
   */
  async analyzeInterviewFrame(imageBase64) {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/answers/analyze-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64, mime_type: 'image/jpeg' }),
      }, 10000);
      const data = await res.json();
      if (!res.ok) return { overall_alert: false, alert_message: '', error: data.detail || 'Frame analysis failed' };
      return data;
    } catch (e) {
      return { overall_alert: false, alert_message: '', error: e.message };
    }
  },
};



