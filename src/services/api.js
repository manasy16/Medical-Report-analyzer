import axios from 'axios';

const BASE_URL = 'http://127.0.0.1:8000';

export const uploadReport = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  
  // This endpoint now waits for the full processing to finish
  const response = await axios.post(`${BASE_URL}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    // Adding a timeout just in case, but let it wait for processing
    timeout: 300000, // 5 minutes
  });
  
  return response.data;
};

export const getReportResult = async (jobId) => {
  const response = await axios.get(`${BASE_URL}/result/${jobId}`);
  return response.data;
};
