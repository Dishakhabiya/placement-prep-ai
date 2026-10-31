import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';

const LAST_PROFILE_KEY = '@placement_prep_last_profile_id';

export const useProfileStore = create((set, get) => ({
  currentProfile: null,
  profilesList: [],
  isLoading: false,
  loadingStage: '',
  error: null,
  backendHealthy: null,
  lastProfileId: null,

  setError: (msg) => set({ error: msg }),
  clearError: () => set({ error: null }),
  setLoadingStage: (stage) => set({ loadingStage: stage }),

  async checkBackendHealth() {
    const res = await apiClient.checkHealth();
    const isHealthy = res.status === 'healthy';
    set({ backendHealthy: isHealthy });
    return isHealthy;
  },

  async loadInitialData() {
    try {
      const lastId = await AsyncStorage.getItem(LAST_PROFILE_KEY);
      if (lastId) {
        set({ lastProfileId: lastId });
      }
      await get().loadHistory();
      await get().checkBackendHealth();
    } catch (e) {
      console.warn('Initial storage load error:', e);
    }
  },

  async submitResumeAndJD({ file, jdText, jdFile, mode }) {
    set({ isLoading: true, error: null, loadingStage: 'Uploading documents & parsing content...' });
    try {
      setTimeout(() => set({ loadingStage: 'Analyzing NLP entities & technical skills...' }), 1200);
      setTimeout(() => set({ loadingStage: 'Parsing Job Description requirements...' }), 2400);
      setTimeout(() => set({ loadingStage: 'Evaluating match gap & building interview topics...' }), 3600);

      const profile = await apiClient.createProfile({ file, jdText, jdFile, mode });
      
      set({ currentProfile: profile, isLoading: false, loadingStage: '', lastProfileId: profile.profile_id });
      await AsyncStorage.setItem(LAST_PROFILE_KEY, profile.profile_id);
      await get().loadHistory();
      return profile;
    } catch (err) {
      set({ isLoading: false, loadingStage: '', error: err.message });
      throw err;
    }
  },

  async fetchProfile(profileId) {
    set({ isLoading: true, error: null });
    try {
      const profile = await apiClient.getProfile(profileId);
      set({ currentProfile: profile, isLoading: false, lastProfileId: profile.profile_id });
      await AsyncStorage.setItem(LAST_PROFILE_KEY, profile.profile_id);
      return profile;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  async saveCorrections(updatedCandidate, updatedJob, updatedMode) {
    const profile = get().currentProfile;
    if (!profile) return;

    set({ isLoading: true, error: null });
    try {
      const payload = {
        mode: updatedMode || profile.mode,
        candidate: updatedCandidate || profile.candidate,
        job: updatedJob || profile.job,
      };
      const updated = await apiClient.updateProfile(profile.profile_id, payload);
      set({ currentProfile: updated, isLoading: false });
      await get().loadHistory();
      return updated;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  async loadHistory() {
    try {
      const list = await apiClient.listProfiles();
      set({ profilesList: list });
      return list;
    } catch (e) {
      console.warn('Failed to load profile history:', e);
    }
  },

  async deleteProfile(profileId) {
    try {
      await apiClient.deleteProfile(profileId);
      const remaining = get().profilesList.filter((p) => p.profile_id !== profileId);
      set({ profilesList: remaining });

      if (get().currentProfile?.profile_id === profileId) {
        set({ currentProfile: null });
      }
      if (get().lastProfileId === profileId) {
        await AsyncStorage.removeItem(LAST_PROFILE_KEY);
        set({ lastProfileId: null });
      }
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // State mutations for candidate corrections
  addCandidateSkill(newSkill) {
    const profile = get().currentProfile;
    if (!profile || !newSkill.trim()) return;
    const cleanSkill = newSkill.trim();
    if (!profile.candidate.skills.includes(cleanSkill)) {
      const updatedCandidate = {
        ...profile.candidate,
        skills: [...profile.candidate.skills, cleanSkill],
      };
      set({ currentProfile: { ...profile, candidate: updatedCandidate } });
    }
  },

  removeCandidateSkill(skillToRemove) {
    const profile = get().currentProfile;
    if (!profile) return;
    const updatedCandidate = {
      ...profile.candidate,
      skills: profile.candidate.skills.filter((s) => s.toLowerCase() !== skillToRemove.toLowerCase()),
    };
    set({ currentProfile: { ...profile, candidate: updatedCandidate } });
  },

  updateCandidateProject(index, updatedProject) {
    const profile = get().currentProfile;
    if (!profile) return;
    const projects = [...profile.candidate.projects];
    projects[index] = updatedProject;
    set({
      currentProfile: {
        ...profile,
        candidate: { ...profile.candidate, projects },
      },
    });
  },

  updateJobProfile(updatedJob) {
    const profile = get().currentProfile;
    if (!profile) return;
    set({
      currentProfile: {
        ...profile,
        job: { ...profile.job, ...updatedJob },
      },
    });
  },
}));
