"use client";

import { useState } from "react";
import { signInWithGoogle, signInWithEmail } from "@/models/auth";

/** 로그인 카드. 구글 OAuth + 이메일 매직링크(가입 겸용). */
export default function LoginCard({ message }: { message?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="card rise mx-auto max-w-sm space-y-4 p-7 text-center">
      <p className="text-lg font-bold">로그인</p>
      <p className="text-[14px] leading-relaxed text-sub">
        {message ?? "오답노트는 로그인하면 기기가 바뀌어도 이어져요."}
      </p>

      <button
        onClick={() => signInWithGoogle(location.pathname)}
        className="press flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 font-bold hover:bg-background"
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
        </svg>
        구글로 계속하기
      </button>

      <div className="flex items-center gap-3 text-[12px] text-muted">
        <span className="h-px flex-1 bg-line" />또는<span className="h-px flex-1 bg-line" />
      </div>

      {sent ? (
        <p className="pop rounded-xl bg-green-soft p-4 text-[14px] font-semibold text-green">
          메일함을 확인하세요! 로그인 링크를 보냈어요.
        </p>
      ) : (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!email || busy) return;
            setBusy(true);
            const { error } = await signInWithEmail(email, location.pathname);
            setBusy(false);
            if (!error) setSent(true);
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-[14px] outline-none focus:border-blue"
          />
          <button
            type="submit"
            disabled={busy}
            className="press w-full rounded-xl bg-blue px-4 py-3 font-bold text-white hover:bg-blue-dark disabled:opacity-50"
          >
            {busy ? "전송 중…" : "이메일로 로그인 링크 받기"}
          </button>
        </form>
      )}
    </div>
  );
}
