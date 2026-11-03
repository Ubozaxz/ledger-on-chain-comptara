import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isProActive } from "@/lib/pro";

export function usePro() {
  const [isPro, setIsPro] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsPro(false); setLoading(false); return; }
    const [{ data: sub }, { data: admin }] = await Promise.all([
      supabase.from("pro_subscriptions").select("expires_at").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle(),
    ]);
    setExpiresAt(sub?.expires_at ?? null);
    setIsPro(!!admin || isProActive(sub?.expires_at));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { isPro, expiresAt, loading, refresh };
}
