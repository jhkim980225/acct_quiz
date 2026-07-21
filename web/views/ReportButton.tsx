"use client";

import { useState } from "react";
import { getSessionUser } from "@/models/auth";
import { reportQuestion } from "@/models/attempt";

const REASONS = ["정답오류", "보기깨짐", "해설오류", "기타"];

/** 문제 신고(F8). 로그인 유저만 접수(RLS). */
export default function ReportButton({ questionId }: { questionId: string }) {
  const [state, setState] = useState<"idle" | "pick" | "done" | "needLogin" | "error">("idle");
  const [busy, setBusy] = useState(false);

  if (state === "done")
    return <p className="text-[12px] font-semibold text-green">신고 접수됨. 확인 후 수정할게요.</p>;
  if (state === "needLogin")
    return <p className="text-[12px] text-muted">신고는 로그인 후 가능해요.</p>;
  if (state === "error")
    return <p className="text-[12px] text-red">접수 실패. 잠시 후 다시 시도해주세요.</p>;

  if (state === "pick")
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {REASONS.map((r) => (
          <button
            key={r}
            className="press rounded-full bg-background px-3 py-1.5 text-[12px] font-semibold text-sub hover:bg-red-soft hover:text-red"
            disabled={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              const user = await getSessionUser();
              if (!user) return setState("needLogin");
              const ok = await reportQuestion(user.id, questionId, r);
              setState(ok ? "done" : "error");
            }}
          >
            {r}
          </button>
        ))}
        <button className="px-2 text-[12px] text-muted" onClick={() => setState("idle")}>
          취소
        </button>
      </div>
    );

  return (
    <button
      className="text-[12px] text-muted underline-offset-2 hover:underline"
      onClick={() => setState("pick")}
    >
      문제 신고
    </button>
  );
}
