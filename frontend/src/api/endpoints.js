import { auth } from "../lib/firebase";
import { io } from "socket.io-client";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api", "")
  : "http://localhost:5000";

export const socket = io(SOCKET_URL, {
  autoConnect: false, // Connect manually when needed
});

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
    updateProfile: async (data) => {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update profile");
      }
      return response.json();
    },
  },
  seats: {
    bookDesignated: async (user, date) => {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/bookings/book/designated`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          userId: user.uid || user.name,
          userName: user.name,
          batch: user.batch,
          date,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to book designated seat");
      }
      return response.json();
    },
    bookFloating: async (user, date) => {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/bookings/book/floating`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          userId: user.uid || user.name,
          userName: user.name,
          batch: user.batch,
          date,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to book floating seat");
      }
      return response.json();
    },
    release: async (user, date) => {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/bookings/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          userId: user.uid || user.name,
          date,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to release seat");
      }
      return response.json();
    },
    getStatus: async (userId, date) => {
      const authHeader = await getAuthHeader();
      const response = await fetch(
        `${API_BASE_URL}/bookings/status?userId=${userId}&date=${date}`,
        {
          headers: { ...authHeader },
        },
      );
      if (!response.ok) {
        throw new Error("Failed to get status");
      }
      return response.json();
    },
    getWeekly: async (startDate, endDate) => {
      const authHeader = await getAuthHeader();
      const response = await fetch(
        `${API_BASE_URL}/bookings/weekly?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: { ...authHeader },
        },
      );
      if (!response.ok) {
        throw new Error("Failed to get weekly data");
      }
      return response.json();
    },
  },
};
