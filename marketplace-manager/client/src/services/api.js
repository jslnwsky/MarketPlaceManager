import axios from 'axios';

// Axios instance with base URL using Vite proxy in dev
const api = axios.create({
  baseURL: '/api',
});

// Attach token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const AuthAPI = {
  me: () => api.get('/auth/me').then(r => r.data),
  login: (email, password) => api.post('/auth/login', { email, password }).then(r => r.data),
  register: (payload) => api.post('/auth/register', payload).then(r => r.data),
};

export const ListingsAPI = {
  list: () => api.get('/listings').then(r => r.data),
  get: (id) => api.get(`/listings/${id}`).then(r => r.data),
  create: (payload, files) => {
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, v);
    });
    (files || []).forEach(f => form.append('images', f));
    return api.post('/listings', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  update: (id, payload, files) => {
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, v);
    });
    (files || []).forEach(f => form.append('images', f));
    return api.put(`/listings/${id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  remove: (id) => api.delete(`/listings/${id}`).then(r => r.data),
};

export default api;
