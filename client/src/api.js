import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:4000/api' });

export const searchCustomers = (q) =>
  api.get('/customers/search', { params: { q } });

export const getCustomers = () =>
  api.get('/customers');

export const createCustomer = (data) =>
  api.post('/customers', data);

export const updateCustomer = (id, data) =>
  api.put(`/customers/${id}`, data);

export const deleteCustomer = (id) =>
  api.delete(`/customers/${id}`);

export const getFreeRooms = () =>
  api.get('/rooms/free');

export const getAllRooms = () =>
  api.get('/rooms');

export const checkIn = (data) =>
  api.post('/visits', data);

export const getActiveVisits = () =>
  api.get('/visits/active');

export const checkOut = (id, data) =>
  api.patch(`/visits/${id}/checkout`, data);

export const checkOutMember = (visitId, memberId, data) =>
  api.patch(`/visits/${visitId}/members/${memberId}/checkout`, data);

export const checkOutMain = (visitId, data) =>
  api.patch(`/visits/${visitId}/main/checkout`, data);

export const getTodayReport = () =>
  api.get('/reports/today');

export const getHistory = () =>
  api.get('/reports/history');
