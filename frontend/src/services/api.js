import axios from 'axios';

const api = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`,
});

api.interceptors.request.use((config)=> {
    const token = localStorage.getItem("token");

    if(token){
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
} );

// Response interceptor: auto-logout on 401 (expired/invalid JWT) (BUG-09)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token expired or invalid — clear session and redirect to login
            localStorage.removeItem("token");
            localStorage.removeItem("role");
            localStorage.removeItem("user");
            // Only redirect if not already on login page
            if (window.location.pathname !== "/" && window.location.pathname !== "/login") {
                window.location.href = "/";
            }
        }
        return Promise.reject(error);
    }
);

export default api;
