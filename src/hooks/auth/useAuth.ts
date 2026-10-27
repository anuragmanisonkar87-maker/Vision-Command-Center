// Single auth hook. Wraps Supabase session + role fetch.
// Components everywhere get { user, loading, signIn, signOut, refresh }.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserProfile } from "@/services/users/userService";
import type { UserProfile } from "@/types/auth";

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const p = await getCurrentUserProfile();
      setUser(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Subscribe FIRST, then fetch — avoids race per Supabase guidance.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setLoading(false);
        return;
      }
      // Defer to avoid auth-listener deadlock
      setTimeout(() => { void refresh(); }, 0);
    });
    void refresh();
    return () => subscription.unsubscribe();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    await refresh();
  }, [refresh]);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: displayName ? { display_name: displayName } : undefined,
      },
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return { user, loading, signIn, signUp, signOut, refresh };
}
