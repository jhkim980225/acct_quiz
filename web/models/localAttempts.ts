/** 익명 풀이 기록(localStorage). M3 로그인 시 attempts 테이블로 이관 예정. */
export type LocalAttempt = {
  question_id: string;
  chosen_idx: number;
  is_correct: boolean;
  at: number;
};

const KEY = "acct_quiz_attempts";

export function recordLocal(a: Omit<LocalAttempt, "at">): void {
  if (typeof window === "undefined") return;
  const list = loadLocal();
  list.push({ ...a, at: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(list.slice(-500))); // 최근 500개만
}

export function loadLocal(): LocalAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
