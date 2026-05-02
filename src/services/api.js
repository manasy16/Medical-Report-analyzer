import axios from 'axios';
import useAppStore from '../store/useAppStore';

const BASE_URL = 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: BASE_URL,
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
  (config) => {
    const token = useAppStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const signup = async (email, password) => {
  const response = await api.post('/auth/signup', { email, password });
  return response.data;
};

export const getMembers = async () => {
  const response = await api.get('/members/');
  return response.data;
};

export const addMember = async (memberData) => {
  const response = await api.post('/members/', memberData);
  return response.data;
};

export const getReports = async (memberId) => {
  const response = await api.get('/reports/', { params: { member_id: memberId } });
  return response.data;
};

export const getTrends = async (memberId, param) => {
  const response = await api.get('/trends/', { params: { member_id: memberId, param } });
  return response.data;
};

export const uploadReport = async (file, language, memberId = null) => {
  const formData = new FormData();
  formData.append("file", file);
  if (language) {
    formData.append("language", language);
  }
  if (memberId) {
    formData.append("member_id", memberId);
  }

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 300000,
  });

  return response.data;
};

export const getReportResult = async (jobId) => {
  const response = await api.get(`/result/${jobId}`);
  return response.data;
};
