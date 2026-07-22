// 메모리 누수·커넥션 소크 하네스. 로컬 전용:
//   1) npm run build && npx next start -p 3100
//   2) node tests/soak.mjs [요청수=200]
// 하는 일:
//   · 주요 경로를 라운드로빈으로 N회 타격
//   · next-server 프로세스 RSS를 25요청마다 샘플 → 첫/끝 비교로 누수 감지
//   · 앞 20%/뒤 20% 평균 지연 비교 → 커넥션 고갈/풀 누수 증상(점진 슬로다운) 감지
// 판정: RSS 증가 > 60% 또는 지연 증가 > 100% 면 FAIL.
// ponytail: supabase-js는 REST(fetch)라 진짜 커넥션 풀은 없음 — 여기서 보는 건
// 핸들/리스너 누수의 증상(RSS·지연 드리프트). DB 풀 도입하면 pg 지표로 교체.
import { execSync } from "node:child_process";

const BASE = "http://localhost:3100";
const N = Number(process.argv[2] ?? 200);
const PATHS = ["/", "/quiz", "/전산회계1급/재고자산", "/전산회계1급/분개", "/api/wrong-stats"];

function serverRssMb() {
  // next start 자식(next-server)을 커맨드라인으로 식별
  const out = execSync(
    `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -match 'next' } | ForEach-Object { $_.ProcessId }"`,
    { encoding: "utf-8" },
  ).trim();
  if (!out) return null;
  const pids = out.split(/\r?\n/).map(Number);
  let total = 0;
  for (const pid of pids) {
    const ws = execSync(
      `powershell -NoProfile -Command "(Get-Process -Id ${pid}).WorkingSet64"`,
      { encoding: "utf-8" },
    ).trim();
    total += Number(ws);
  }
  return Math.round(total / 1024 / 1024);
}

const latencies = [];
const rssSamples = [];
const rss0 = serverRssMb();
if (rss0 === null) {
  console.log("next 서버 프로세스를 못 찾음 — npx next start -p 3100 먼저 실행");
  process.exit(1);
}
rssSamples.push(rss0);

for (let i = 0; i < N; i++) {
  const path = PATHS[i % PATHS.length];
  const t0 = performance.now();
  const res = await fetch(BASE + encodeURI(path));
  await res.arrayBuffer();
  if (res.status !== 200) {
    console.log(`FAIL ${path} HTTP ${res.status} (요청 ${i + 1})`);
    process.exit(1);
  }
  latencies.push(performance.now() - t0);
  if ((i + 1) % 25 === 0) {
    const mb = serverRssMb();
    rssSamples.push(mb);
    console.log(`${i + 1}/${N}  RSS ${mb}MB`);
  }
}

const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const k = Math.max(1, Math.floor(N * 0.2));
const early = avg(latencies.slice(0, k));
const late = avg(latencies.slice(-k));
const rssEnd = rssSamples[rssSamples.length - 1];
const rssGrowth = ((rssEnd - rss0) / rss0) * 100;
const latGrowth = ((late - early) / early) * 100;

console.log(`\nRSS: ${rss0}MB → ${rssEnd}MB (${rssGrowth.toFixed(0)}%)`);
console.log(`지연: 초반 ${early.toFixed(0)}ms → 후반 ${late.toFixed(0)}ms (${latGrowth.toFixed(0)}%)`);

const leak = rssGrowth > 60;
const drift = latGrowth > 100;
if (leak) console.log("FAIL: RSS 증가 — 메모리 누수 의심");
if (drift) console.log("FAIL: 지연 드리프트 — 커넥션/핸들 누수 의심");
if (!leak && !drift) console.log("통과: 누수 증상 없음");
process.exit(leak || drift ? 1 : 0);
