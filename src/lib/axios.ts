import axios from "axios";

// Accessing environment variable for baseUrl, fallback to localhost:8080 or 3000
// For now, hardcoding to 8080 as per Expo config or 3000 if json-server default.
// The user installed webmasterdevlin/json-server.
const baseURL = "http://localhost:8080";

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error);
    return Promise.reject(error);
  },
);
