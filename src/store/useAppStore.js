import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAppStore = create(
  persist(
    (set) => ({
      // Auth
      user: null,
      token: null,
      
      // Data
      file: null,
      reportId: null,
      uploadStatus: 'idle', // idle, uploading, processing, completed, error
      processingStep: '', // extracting, analyzing, summarizing, done
      resultData: null,
      riskLevel: 'normal',
      language: 'en', // en, hi, hinglish
      error: null,
      
      // Family & History
      members: [],
      selectedMemberId: null,
      history: [],
      trends: {},

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setMembers: (members) => set({ members }),
      setSelectedMemberId: (id) => set({ selectedMemberId: id }),
      setHistory: (history) => set({ history }),
      setTrends: (param, data) => set((state) => ({ 
        trends: { ...state.trends, [param]: data } 
      })),

      setFile: (file) => set({ file, error: null }),
      setReportId: (reportId) => set({ reportId }),
      setUploadStatus: (uploadStatus) => set({ uploadStatus }),
      setProcessingStep: (processingStep) => set({ processingStep }),
      setResultData: (resultData) => set({ resultData, riskLevel: resultData?.risk_level || 'normal' }),
      setLanguage: (language) => set({ language }),
      setError: (error) => set(error ? { error, uploadStatus: 'error' } : { error: null }),
      
      logout: () => set({ 
        user: null, 
        token: null, 
        members: [], 
        selectedMemberId: null, 
        history: [] 
      }),

      reset: () => set({
        file: null,
        reportId: null,
        uploadStatus: 'idle',
        processingStep: '',
        resultData: null,
        riskLevel: 'normal',
        error: null
      })
    }),
    {
      name: 'blood-analyzer-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token,
        language: state.language 
      }),
    }
  )
);

export default useAppStore;

