import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { Loader2 } from "lucide-react";

type Props = {
  /** If true, only allow users who have completed onboarding. */
  requireOnboarded?: boolean;
};

const DEV_BYPASS = import.meta.env.DEV && localStorage.getItem("dev_bypass") === "true";

export function ProtectedRoute({ requireOnboarded = true }: Props) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (DEV_BYPASS) return <Outlet />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  if (requireOnboarded && profile && !profile.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
