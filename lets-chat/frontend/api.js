const API_URL = 'https://lets-chat-9dy1.onrender.com/api';

async function apiRequest(endpoint, method = 'GET', body = null, isFormData = false) {
  const token = localStorage.getItem('token');
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (body && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : null)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
}
