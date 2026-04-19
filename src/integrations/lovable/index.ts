import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft", opts?: SignInOptions) => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: opts?.redirect_uri },
      });
      if (error) return { error, redirected: false };
      return { error: null, redirected: true };
    },
  },
};
