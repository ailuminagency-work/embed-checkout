import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!active) return;
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", u.id)
            .eq("role", "admin")
            .maybeSingle();
          if (active) setIsAdmin(!!data);
        } else {
          setIsAdmin(false);
        }
        if (active) setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", u.id)
          .eq("role", "admin")
          .maybeSingle()
          .then(({ data }) => {
            if (!active) return;
            setIsAdmin(!!data);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = () => supabase.auth.signOut();

  return { user, isAdmin, loading, signOut };
}
