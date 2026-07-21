import { createClient } from "@supabase/supabase-js";

// 익명 읽기 전용 클라이언트. MVP는 로그인 없음(M3에서 auth 추가).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
