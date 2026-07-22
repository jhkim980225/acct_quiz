import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "회계 문제은행 개인정보처리방침",
};

const UPDATED = "2026년 7월 22일";

/** 애드센스 심사·운영 필수. 실제 수집 항목만 정직하게 기술. */
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 leading-relaxed">
      <header className="rise">
        <h1 className="text-2xl font-bold tracking-tight">개인정보처리방침</h1>
        <p className="mt-1 text-[13px] text-muted">최종 수정: {UPDATED}</p>
      </header>

      {[
        {
          h: "1. 수집하는 정보",
          body: (
            <>
              <p>회계 문제은행(이하 “서비스”)은 다음 정보만 수집합니다.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <b>계정 정보(선택)</b>: 로그인 시 이메일 주소. 구글 로그인 또는
                  이메일 링크 로그인에 사용되며, 오답노트 동기화에만 쓰입니다.
                </li>
                <li>
                  <b>학습 기록</b>: 문제 풀이 결과(문제 ID, 선택한 보기, 정답
                  여부). 로그인하지 않은 경우 브라우저(localStorage)에만 저장되고
                  서버로 전송되지 않습니다.
                </li>
              </ul>
              <p className="mt-2">
                이름·연락처·결제정보는 수집하지 않습니다. 로그인 없이 모든 문제
                풀이 기능을 사용할 수 있습니다.
              </p>
            </>
          ),
        },
        {
          h: "2. 이용 목적",
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>오답노트 저장·기기 간 동기화</li>
              <li>문제별 오답률 등 익명 통계 산출(개인 식별 불가 형태)</li>
            </ul>
          ),
        },
        {
          h: "3. 보관 및 파기",
          body: (
            <p>
              계정과 학습 기록은 탈퇴(삭제 요청) 시 지체 없이 파기합니다. 삭제를
              원하시면 아래 문의처로 로그인에 사용한 이메일 주소와 함께 요청해
              주세요.
            </p>
          ),
        },
        {
          h: "4. 제3자 제공 및 처리 위탁",
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>Supabase</b>: 데이터베이스·인증 처리(계정 정보, 학습 기록 저장)
              </li>
              <li>
                <b>Vercel</b>: 웹 호스팅
              </li>
              <li>
                <b>Google</b>: 구글 로그인(OAuth) 인증
              </li>
            </ul>
          ),
        },
        {
          h: "5. 쿠키 및 광고",
          body: (
            <p>
              서비스는 로그인 세션 유지를 위해 브라우저 저장소를 사용합니다. 광고
              게재 시 Google AdSense 등 제3자 광고 사업자가 쿠키를 사용해 이용자의
              이전 방문 기록을 기반으로 광고를 게재할 수 있습니다. 이용자는{" "}
              <a
                className="text-blue underline"
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google 광고 설정
              </a>
              에서 맞춤 광고를 해제할 수 있습니다.
            </p>
          ),
        },
        {
          h: "6. 문의",
          body: (
            <p>
              개인정보 관련 문의·삭제 요청:{" "}
              <a className="text-blue underline" href="mailto:jhkimgpt4@gmail.com">
                jhkimgpt4@gmail.com
              </a>
            </p>
          ),
        },
      ].map((s) => (
        <section key={s.h} className="card space-y-2 p-6 text-[14.5px] text-sub">
          <h2 className="text-[16px] font-bold text-foreground">{s.h}</h2>
          {s.body}
        </section>
      ))}
    </article>
  );
}
