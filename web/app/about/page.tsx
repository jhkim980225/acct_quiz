import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "소개",
  description:
    "회계 문제은행 — 전산회계 1·2급, 전산세무 2급 기출을 유형별로 정리한 무료 학습 도구",
};

/** 사이트 소개(애드센스 심사·신뢰용). */
export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 leading-relaxed">
      <header className="rise">
        <h1 className="text-2xl font-bold tracking-tight">회계 문제은행 소개</h1>
      </header>

      <section className="card space-y-3 p-6 text-[14.5px] text-sub">
        <p>
          <b className="text-foreground">회계 문제은행</b>은 전산회계 1급·2급,
          전산세무 2급 수험생을 위한 무료 기출 연습 도구입니다. 한국세무사회
          공식 기출문제와 확정답안을 유형별로 재구성해, 회원가입 없이 바로 풀고
          바로 채점받을 수 있게 만들었습니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b className="text-foreground">유형별 연습</b> — 재무회계·원가·부가세·소득세
            영역의 26개 유형으로 기출을 분류. 약한 유형만 골라 풀 수 있어요.
          </li>
          <li>
            <b className="text-foreground">즉시 채점 + 공식 해설</b> — 보기를
            누르는 순간 채점되고 확정답안 해설이 바로 표시됩니다.
          </li>
          <li>
            <b className="text-foreground">실무 분개·결산 연습</b> — 실무시험
            분개 문제를 4지선다로 변환해 손으로 풀기 전 감을 잡을 수 있어요.
          </li>
          <li>
            <b className="text-foreground">오답노트</b> — 로그인하면 틀린 문제가
            자동으로 모이고 기기가 바뀌어도 이어집니다.
          </li>
          <li>
            <b className="text-foreground">오답률 통계</b> — 이용자들이 실제로
            많이 틀리는 문제부터 집중 공략할 수 있습니다.
          </li>
        </ul>
        <p>
          문제·해설의 저작권은 원 출제기관에 있으며, 본 서비스는 학습 편의를
          위한 재구성 도구입니다. 오류 제보는 각 문제의 신고 버튼 또는{" "}
          <a className="text-blue underline" href="mailto:jhkimgpt4@gmail.com">
            jhkimgpt4@gmail.com
          </a>
          으로 보내주세요.
        </p>
      </section>

      <div className="flex gap-2">
        <Link
          href="/quiz"
          className="press rounded-xl bg-blue px-5 py-3 text-[14px] font-bold text-white hover:bg-blue-dark"
        >
          바로 문제풀기
        </Link>
        <Link
          href="/privacy"
          className="press rounded-xl bg-surface px-5 py-3 text-[14px] font-bold text-sub shadow-sm hover:text-blue"
        >
          개인정보처리방침
        </Link>
      </div>
    </article>
  );
}
