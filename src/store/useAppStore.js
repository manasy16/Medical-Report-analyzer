import { create } from 'zustand';

const useAppStore = create((set) => ({
  file: null,
  reportId: null,
  uploadStatus: 'idle', // idle, uploading, processing, completed, error
  processingStep: '', // extracting, analyzing, summarizing, done
  resultData: null,
  riskLevel: 'normal',
  language: 'en', // en, hi, hinglish
  error: null,

  setFile: (file) => set({ file, error: null }),
  setReportId: (reportId) => set({ reportId }),
  setUploadStatus: (uploadStatus) => set({ uploadStatus }),
  setProcessingStep: (processingStep) => set({ processingStep }),
  setResultData: (resultData) => set({ resultData, riskLevel: resultData?.risk_level || 'normal' }),
  setLanguage: (language) => set({ language }),
  setError: (error) => set({ error, uploadStatus: 'error' }),
  reset: () => set({
    file: null,
    reportId: null,
    uploadStatus: 'idle',
    processingStep: '',
    resultData: null,
    riskLevel: 'normal',
    error: null
  })
}));

export default useAppStore;
