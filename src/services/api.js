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

export function getDonationChart(params = {}) {
  return api.get('/donations/chart', { params }).then((res) => res.data).catch(() => []);
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

export function deleteStaff(id) {
  return api.delete(`/staff/${id}`).then((res) => res.data);
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

// Analytics
export function getTopDonors(params = {}) {
  return api.get('/top-donors', { params }).then((res) => res.data).catch(() => []);
}

export function getCampaigns() {
  return api.get('/campaigns').then((res) => res.data).catch(() => []);
}

export function getCampaignChart(params = {}) {
  return api.get('/donations/campaign-chart', { params }).then((res) => res.data).catch(() => []);
}

export function getMonthlyReport(params = {}) {
  return api.get('/reports/monthly', { params }).then((res) => res.data).catch(() => null);
}

// Donor notes
export function getDonorNotes(donorId) {
  return api.get(`/customers/${donorId}/notes`).then((res) => res.data).catch(() => []);
}
export function addDonorNote(donorId, content) {
  return api.post(`/customers/${donorId}/notes`, { content }).then((res) => res.data);
}
export function deleteDonorNote(donorId, noteId) {
  return api.delete(`/customers/${donorId}/notes/${noteId}`).then((res) => res.data);
}

// Charts
export function getDonorGrowthChart(params = {}) {
  return api.get('/charts/donor-growth', { params }).then((res) => res.data).catch(() => []);
}
export function getNewVsReturningChart(params = {}) {
  return api.get('/charts/new-vs-returning', { params }).then((res) => res.data).catch(() => []);
}
export function getSourceBreakdown() {
  return api.get('/charts/source-breakdown').then((res) => res.data).catch(() => []);
}
export function getYoyComparison() {
  return api.get('/charts/yoy-comparison').then((res) => res.data).catch(() => ({ data: [], current_year: new Date().getFullYear(), previous_year: new Date().getFullYear() - 1 }));
}

// Duplicates
export function getDuplicates() {
  return api.get('/donors/duplicates').then((res) => res.data).catch(() => []);
}
export function mergeDonors(payload) {
  return api.post('/donors/merge', payload).then((res) => res.data);
}

// Marketing costs
export function getMarketingCosts(params = {}) {
  return api.get('/marketing-costs', { params }).then((res) => res.data).catch(() => ({ costs: [], total: 0 }));
}
export function createMarketingCost(payload) {
  return api.post('/marketing-costs', payload).then((res) => res.data);
}
export function deleteMarketingCost(id) {
  return api.delete(`/marketing-costs/${id}`).then((res) => res.data);
}
export function getMarketingRoi(params = {}) {
  return api.get('/marketing-roi', { params }).then((res) => res.data).catch(() => []);
}
export function bulkUploadMarketingCosts(rows) {
  return api.post('/marketing-costs/bulk', { rows }).then((res) => res.data);
}
