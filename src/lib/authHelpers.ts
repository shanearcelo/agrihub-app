import { supabase } from "./supabase";

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Please sign in to continue.");
  return user;
}
