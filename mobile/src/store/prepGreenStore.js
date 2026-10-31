import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getTodayKey = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const usePrepGreenStore = create(
  persist(
    (set, get) => ({
      dateKey: getTodayKey(),
      scores: [null, null, null, null],

      checkMidnightReset: () => {
        const today = getTodayKey();
        if (get().dateKey !== today) {
          set({
            dateKey: today,
            scores: [null, null, null, null],
          });
        }
      },

      setScore: (index, score) => {
        const today = getTodayKey();
        let currentScores = get().scores;
        if (get().dateKey !== today) {
          currentScores = [null, null, null, null];
        }
        const next = [...currentScores];
        next[index] = score;
        set({ dateKey: today, scores: next });
      },

      resetScores: () => {
        set({ dateKey: getTodayKey(), scores: [null, null, null, null] });
      },
    }),
    {
      name: 'prepai-green-scores-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const today = getTodayKey();
          if (state.dateKey !== today) {
            state.dateKey = today;
            state.scores = [null, null, null, null];
          }
        }
      },
    }
  )
);
