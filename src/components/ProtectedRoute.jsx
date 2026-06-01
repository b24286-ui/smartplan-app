import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps any route that requires authentication.
 * Shows nothing while auth is being verified (avoids flash of wrong screen).
 *
 * Usage in App.jsx:
 *   <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // You can swap this for a full-screen spinner/skeleton later
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9faf3]">
        <div className="w-8 h-8 border-4 border-[#5150b1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/" replace />;
}