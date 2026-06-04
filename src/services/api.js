import axios from "axios";

// ─── Base Instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});

// ─── Request Interceptor: attach JWT ─────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("sp_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: handle 401 globally ───────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const hasStoredToken = !!localStorage.getItem("sp_token");
    if (error.response?.status === 401 && hasStoredToken) {
      localStorage.removeItem("sp_token");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export default api;


// ════════════════════════════════════════════════════════════════════════════
// AUTH  (/api/auth)
// ════════════════════════════════════════════════════════════════════════════
export const authAPI = {
  register : (data) => api.post("/auth/register", data),
  login    : (data) => api.post("/auth/login",    data),
  getMe    : ()     => api.get("/auth/me"),
};


// ════════════════════════════════════════════════════════════════════════════
// SUBJECTS  (/api/subjects)
// ════════════════════════════════════════════════════════════════════════════
export const subjectsAPI = {
  getAll  : ()           => api.get("/subjects"),
  getOne  : (id)         => api.get(`/subjects/${id}`),
  create  : (data)       => api.post("/subjects", data),
  update  : (id, data)   => api.put(`/subjects/${id}`, data),
  remove  : (id)         => api.delete(`/subjects/${id}`),
};


// ════════════════════════════════════════════════════════════════════════════
// TOPICS  (/api/topics)
// ════════════════════════════════════════════════════════════════════════════
export const topicsAPI = {
  getBySubject : (subjectId)    => api.get(`/topics?subject=${subjectId}`),
  getOne       : (id)           => api.get(`/topics/${id}`),
  create       : (data)         => api.post("/topics", data),
  update       : (id, data)     => api.put(`/topics/${id}`, data),
  remove       : (id)           => api.delete(`/topics/${id}`),
};


// ════════════════════════════════════════════════════════════════════════════
// SCHEDULE  (/api/schedule)
// ════════════════════════════════════════════════════════════════════════════
export const scheduleAPI = {
  getAll       : (params)       => api.get("/schedule", { params }),  // ?date= or ?week=
  getOne       : (id)           => api.get(`/schedule/${id}`),
  create       : (data)         => api.post("/schedule", data),
  update       : (id, data)     => api.put(`/schedule/${id}`, data),
  remove       : (id)           => api.delete(`/schedule/${id}`),

  // ── Used by AI Schedule Generator ─────────────────────────────────────────
  // Sends a sessions[] array; backend POST /api/schedule/bulk handles it.
  // Route must be registered BEFORE /:id in routes/schedule.js.
  bulkCreate   : (sessions)     => api.post("/schedule/bulk", { sessions }),

  // ── Used by PostSessionQuiz / FocusPage to mark a session done ────────────
  markComplete : (id, data)     => api.put(`/schedule/${id}/complete`, data),
};


// ════════════════════════════════════════════════════════════════════════════
// SESSIONS (Focus)  (/api/sessions)
// ════════════════════════════════════════════════════════════════════════════
export const sessionsAPI = {
  getAll  : (params)     => api.get("/sessions", { params }),
  getOne  : (id)         => api.get(`/sessions/${id}`),
  start   : (data)       => api.post("/sessions/start", data),
  end     : (id, data)   => api.put(`/sessions/${id}/end`, data),
  remove  : (id)         => api.delete(`/sessions/${id}`),
};


// ════════════════════════════════════════════════════════════════════════════
// QUIZ  (/api/quiz)
// ════════════════════════════════════════════════════════════════════════════
export const quizAPI = {
  getQuestions : (params) => api.get("/quiz/questions", { params }),  // ?subject=&topic=
  submit       : (data)   => api.post("/quiz/submit", data),
  getHistory   : (params) => api.get("/quiz/history",  { params }),
};


// ════════════════════════════════════════════════════════════════════════════
// ANALYTICS  (/api/analytics)
// ════════════════════════════════════════════════════════════════════════════
export const analyticsAPI = {
  getSummary  : ()       => api.get("/analytics/summary"),
  getWeekly   : (params) => api.get("/analytics/weekly",   { params }),
  getSubjects : ()       => api.get("/analytics/subjects"),
  getStreak   : ()       => api.get("/analytics/streak"),
};


// ════════════════════════════════════════════════════════════════════════════
// PROFILE  (/api/profile)
// ════════════════════════════════════════════════════════════════════════════
export const profileAPI = {
  get          : ()         => api.get("/profile"),
  update       : (data)     => api.put("/profile", data),
  uploadAvatar : (formData) =>
    api.put("/profile/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};