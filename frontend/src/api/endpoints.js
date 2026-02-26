import { auth } from '../lib/firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Get the current Firebase user's ID token to attach to API calls
const getAuthHeader = async () => {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
};

export const api = {
  auth: {
    login: async (credentials) => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      return response.json();
    },
    signup: async (data) => {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },
  },
  seats: {
    bookDesignated: async (user) => {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/bookings/book/designated`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        // Backend expects: { userId, userName, batch, date (optional, defaults to today) }
        body: JSON.stringify({ 
          userId: user.uid || user.name, // Use uid if available from login
          userName: user.name, 
          batch: user.batch 
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to book designated seat");
      }
      return response.json();
    },
    bookFloating: async (user) => {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/bookings/book/floating`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ 
          userId: user.uid || user.name, 
          userName: user.name, 
          batch: user.batch 
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to book floating seat");
      }
      return response.json();
    },
    release: async (user) => {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/bookings/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ 
          userId: user.uid || user.name, 
          date: new Date().toISOString().split('T')[0] 
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to release seat");
      }
      return response.json();
    },
    getStatus: async (userId) => {
      const today = new Date().toISOString().split('T')[0];
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/bookings/status?userId=${userId}&date=${today}`, {
        headers: { ...authHeader }
      });
      if (!response.ok) {
        throw new Error("Failed to get status");
      }
      return response.json();
    }
  }
};
