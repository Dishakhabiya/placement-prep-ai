import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const usePrepGreenStore = create(
  persist(
    (set, get) => ({
      scores: [null, null, null, null],

      setScore: (index, score) => {
        const next = [...get().scores];
        next[index] = score;
        set({ scores: next });
      },

      resetScores: () => {
        set({ scores: [null, null, null, null] });
      },
    }),
    {
      name: 'prepai-green-scores-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
