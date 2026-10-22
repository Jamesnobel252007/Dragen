import axios from "axios";

const rawBaseURL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const baseURL = rawBaseURL.endsWith("/") ? rawBaseURL : `${rawBaseURL}/`;

const api = axios.create({
  baseURL,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Never force application/json on FormData uploads.
    // Allow the browser and Axios to compute the proper multipart/form-data boundary.
    if (config.data instanceof FormData) {
      if (config.headers) {
        if (typeof config.headers.delete === "function") {
          config.headers.delete("Content-Type");
          config.headers.delete("content-type");
        } else {
          delete config.headers["Content-Type"];
          delete config.headers["content-type"];
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    // Do not attempt refresh on auth endpoints to prevent loops
    const requestUrl = originalRequest.url || "";
    if (
      requestUrl.includes("token/") ||
      requestUrl.includes("token/refresh/") ||
      requestUrl.includes("register/") ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refresh");
    if (!refreshToken) {
      localStorage.removeItem("access");
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshResponse = await axios.post(`${baseURL}token/refresh/`, {
        refresh: refreshToken,
      });

      const newAccessToken = refreshResponse.data.access;
      localStorage.setItem("access", newAccessToken);

      if (refreshResponse.data.refresh) {
        localStorage.setItem("refresh", refreshResponse.data.refresh);
      }

      api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      processQueue(null, newAccessToken);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;