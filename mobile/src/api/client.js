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

  async createProfile({ file, jdText, mode }) {
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

    formData.append('jd_text', jdText || '');
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
};
