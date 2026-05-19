import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function adminLogin(payload) {
  return api.post('/admin/login', payload).then((res) => res.data);
}

export function getSummary() {
  return api.get('/summary').then((res) => res.data).catch(() => ({ total: 0, active: 0, repeat: 0, dormant: 0, churn: 0, total_collection: 0, avg_order_value: 0, donation_count: 0 }));
}

export function getCustomers(params = {}) {
  return api.get('/customers', { params }).then((res) => res.data).catch(() => ({ customers: [], total: 0, page: 1, per_page: 50, total_pages: 0 }));
}

export function getCustomerDetail(id) {
  return api.get(`/customers/${id}`).then((res) => res.data).catch(() => null);
}

export function updateCustomer(id, payload) {
  return api.put(`/customers/${id}`, payload).then((res) => res.data);
}

export function getOrders() {
  return api.get('/orders').then((res) => res.data).catch(() => []);
}

export function createOrder(order) {
  return api.post('/orders', order).then((res) => res.data);
}

export function getStaff() {
  return api.get('/staff').then((res) => res.data).catch(() => []);
}

export function createStaff(payload) {
  return api.post('/staff', payload).then((res) => res.data);
}

export function bulkUploadOrders(csvContent) {
  return api.post('/orders/bulk-upload', { csv: csvContent }).then((res) => res.data);
}

// User management
export function getUsers() {
  return api.get('/users').then((res) => res.data).catch(() => []);
}

export function getCurrentUser() {
  return api.get('/users/me').then((res) => res.data).catch(() => null);
}

export function createUser(payload) {
  return api.post('/users', payload).then((res) => res.data);
}

export function updateUser(id, payload) {
  return api.put(`/users/${id}`, payload).then((res) => res.data);
}

export function deleteUser(id) {
  return api.delete(`/users/${id}`).then((res) => res.data);
}

// Webhook management
export function getWebhooks() {
  return api.get('/webhooks').then((res) => res.data).catch(() => []);
}

export function createWebhook(payload) {
  return api.post('/webhooks', payload).then((res) => res.data);
}

export function updateWebhook(id, payload) {
  return api.put(`/webhooks/${id}`, payload).then((res) => res.data);
}

export function deleteWebhook(id) {
  return api.delete(`/webhooks/${id}`).then((res) => res.data);
}

export function getWebhookLogs() {
  return api.get('/webhooks/logs').then((res) => res.data).catch(() => []);
}
