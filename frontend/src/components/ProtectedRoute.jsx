import { Navigate, useLocation } from "react-router-dom";

/**
 * Route guard component that verifies an active access token is present
 * before rendering protected application views. Redirects to login if unauthenticated.
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem("access");

  if (!token) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
