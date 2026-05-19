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

export function getCustomers() {
  return api.get('/customers').then((res) => res.data).catch(() => []);
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
