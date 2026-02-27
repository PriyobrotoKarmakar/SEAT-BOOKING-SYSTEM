import { API_BASE_URL } from "./endpoints";
import { auth } from "../lib/firebase";

const getAuthHeader = async () => {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
};

export const adminApi = {
  getAllUsers: async () => {
    try {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: authHeader,
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  updateUserBatch: async (userId, batch) => {
    try {
      const authHeader = await getAuthHeader();
      const response = await fetch(
        `${API_BASE_URL}/admin/users/${userId}/batch`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
          },
          body: JSON.stringify({ batch }),
        },
      );
      if (!response.ok) throw new Error("Failed to update user batch");
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  overrideBookSeat: async (userId, userName, batch, date, seatId) => {
    try {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/admin/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ userId, userName, batch, date, seatId }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to override booking");
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  releaseSeat: async (userId, date) => {
    try {
      const authHeader = await getAuthHeader();
      const response = await fetch(`${API_BASE_URL}/admin/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ userId, date }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to release seat");
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  setSpecialDay: async (date, type) => {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/admin/special-days`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ date, type }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to set special day");
    }
    return response.json();
  },

  removeSpecialDay: async (date) => {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${API_BASE_URL}/admin/special-days/${date}`, {
      method: "DELETE",
      headers: { ...authHeader },
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to remove special day");
    }
    return response.json();
  },
};
