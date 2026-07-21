import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

/** 현재 세션 유저(로컬 세션 기준, 네트워크 호출 없음). */
export async function getSessionUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export function signInWithGoogle(redirectPath = "/wrong") {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin + redirectPath },
  });
}

/** 이메일 매직링크(가입 겸용). 구글 설정 전에도 동작. */
export function signInWithEmail(email: string, redirectPath = "/wrong") {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + redirectPath },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}

export function onAuthChange(cb: (user: User | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_e, session) =>
    cb(session?.user ?? null),
  );
  return () => data.subscription.unsubscribe();
}
