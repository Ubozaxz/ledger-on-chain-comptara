import { supabase } from "@/integrations/supabase/client";

export async function getAuthHeader(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return `Bearer ${token}`;
  } catch {
    // ignore
  }
  return `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
}

export async function buildJsonHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
    Authorization: await getAuthHeader(),
    ...(extra ?? {}),
  };
}
