import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Paper {
  _id: string;
  userId: string;
  title: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  summary?: string;
  uploadedAt: string;
}

export interface Note {
  _id: string;
  userId: string;
  paperId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export const papersApi = {
  getAll: () => api.get<Paper[]>('/papers').then((res) => res.data),
  getOne: (id: string) => api.get<Paper>(`/papers/${id}`).then((res) => res.data),
  upload: (data: { title: string; fileName: string; fileBase64: string }) =>
    api.post<Paper>('/papers/upload', data).then((res) => res.data),
  delete: (id: string) => api.delete(`/papers/${id}`).then((res) => res.data),
};

export const aiApi = {
  generateSummary: (paperId: string) =>
    api.post<{ summary: string }>(`/ai/summary/${paperId}`).then((res) => res.data),
  chat: (paperId: string, message: string, chatHistory: { role: string; content: string }[]) =>
    api.post<{ response: string }>(`/ai/chat/${paperId}`, { message, chatHistory }).then((res) => res.data),
};

export const notesApi = {
  get: (paperId: string) => api.get<Note>(`/notes/${paperId}`).then((res) => res.data),
  update: (paperId: string, content: string) =>
    api.put<Note>(`/notes/${paperId}`, { content }).then((res) => res.data),
};

export default api;
