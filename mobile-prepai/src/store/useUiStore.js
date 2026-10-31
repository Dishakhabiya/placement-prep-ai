import { create } from 'zustand';

export const useUiStore = create((set) => ({
  // Mic listening state
  isListening: false,
  toggleListening: () => set((state) => ({ isListening: !state.isListening })),
  setListening: (isListening) => set({ isListening }),

  // Toast notification
  toast: null, // { message: string, id: number }
  showToast: (message) => {
    const id = Date.now();
    set({ toast: { message, id } });
  },
  hideToast: () => set({ toast: null }),

  // Selected question
  selectedQuestion: null,
  setSelectedQuestion: (selectedQuestion) => set({ selectedQuestion }),

  // TopBar tabs ('Practise' | 'History' | 'Saved')
  activeTab: 'Practise',
  setActiveTab: (activeTab) => set({ activeTab }),

  // Streak count
  streakCount: 3,
}));
