import axios from 'axios';

const TOKEN_KEY = 'auth_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL 
    ? `${import.meta.env.VITE_SERVER_URL}/api` 
    : '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('auth_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

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

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PapersResponse {
  papers: Paper[];
  pagination: PaginationInfo;
}

export interface PapersQueryParams {
  search?: string;
  sort?: 'newest' | 'oldest' | 'title-asc' | 'title-desc';
  page?: number;
  limit?: number;
}

export const papersApi = {
  getAll: (params?: PapersQueryParams) => 
    api.get<PapersResponse>('/papers', { params }).then((res) => res.data),
  getOne: (id: string) => api.get<Paper>(`/papers/${id}`).then((res) => res.data),
  upload: (data: { title: string; fileName: string; fileBase64: string }) =>
    api.post<Paper>('/papers/upload', data).then((res) => res.data),
  delete: (id: string) => api.delete(`/papers/${id}`).then((res) => res.data),
};

export default api;
