import axios from 'axios';
import type { ApiResponse } from '@/types';
import { getBrowserApiBase } from '@/lib/browser-api-base';

const BASE_URL = getBrowserApiBase();

const apiClient = axios.create({ baseURL: BASE_URL });

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const envelope = response.data as ApiResponse<unknown>;
    if (envelope.error) {
      return Promise.reject(new Error(envelope.error.message));
    }
    response.data = envelope.data;
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    const message =
      (error.response?.data as ApiResponse<unknown>)?.error?.message ??
      error.message;
    return Promise.reject(new Error(message));
  },
);

export default apiClient;
