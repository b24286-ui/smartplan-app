import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

// Screens
import LandingPage    from "./screens/LandingPage";
import OnboardingPage from "./screens/OnboardingPage";
import Dashboard      from "./screens/Dashboard";
import SubjectsPage   from "./screens/SubjectsPage";
import TopicsPage     from "./screens/TopicsPage";
import SchedulePage   from "./screens/SchedulePage";
import FocusPage      from "./screens/FocusPage";
import QuizPage       from "./screens/QuizPage";
import AnalyticsPage  from "./screens/AnalyticsPage";
import ProfilePage    from "./screens/ProfilePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes ─────────────────────────────── */}
        <Route path="/"           element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* ── Protected routes ──────────────────────────── */}
        <Route path="/dashboard"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/subjects"   element={<ProtectedRoute><SubjectsPage /></ProtectedRoute>} />
        <Route path="/topics/:subjectId" element={<ProtectedRoute><TopicsPage /></ProtectedRoute>} />
        <Route path="/schedule"   element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
        <Route path="/focus"      element={<ProtectedRoute><FocusPage /></ProtectedRoute>} />
        <Route path="/quiz"       element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
        <Route path="/analytics"  element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/profile"    element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}