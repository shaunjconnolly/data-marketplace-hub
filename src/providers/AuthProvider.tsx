import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  display_name: string | null;
  company: string | null;
  primary_role: "buyer" | "seller" | "both" | null;
  onboarding_completed: boolean;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, display_name, company, primary_role, onboarding_completed",
      )
      .eq("id", userId)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }

  async function loadRoles(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setIsAdmin((data ?? []).some((r) => r.role === "admin"));
  }

  useEffect(() => {
    // Listener FIRST, then read existing session.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer DB call out of the auth callback to avoid deadlocks
        setTimeout(() => {
          loadProfile(newSession.user.id);
          loadRoles(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        Promise.all([
          loadProfile(existing.user.id),
          loadRoles(existing.user.id),
        ]).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    isAdmin,
    loading,
    refreshProfile: async () => {
      if (user) {
        await Promise.all([loadProfile(user.id), loadRoles(user.id)]);
      }
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
